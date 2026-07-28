#!/usr/bin/env bash
set -euo pipefail

# work-launch.sh — Grid mechanics for /work skill
# Handles grid creation, agent launch, and pane teardown
# Supports both cmux and tmux via $DISPATCH env var

DISPATCH="${DISPATCH:-}"

# cmux prints deprecation notices to STDOUT for legacy command aliases, which
# corrupts parsed output. Export once rather than per call site.
export CMUX_QUIET=1

# Max seconds to wait for a fresh shell to accept input (see cmux_wait_shell).
SHELL_READY_TIMEOUT="${SHELL_READY_TIMEOUT:-30}"

usage() {
  cat <<EOF
Usage: work-launch.sh <command> [options]

Commands:
  grid <count>   Create a grid of <count> panes, print surface/pane IDs (one per line)
  launch         Boot claude with /implement as initial prompt in a surface
  bootstrap      Create a tmux session and boot claude with /work as initial prompt
  close          Close a pane (exit claude, remove split)
  close-workspace <ws>  Close a whole cmux grid workspace (cmux only)
  status         Check if a surface still exists

Note: for DISPATCH=cmux, `grid` prints a leading "workspace=<ref>" line before
the surface refs. Record it so the grid workspace can be closed on teardown.

Environment:
  DISPATCH       Required. "cmux" or "tmux"
  TMUX_SESSION   tmux session name (default: "work")
  GRID_NAME      Title for the created cmux workspace (default: "work-grid")
  SHELL_READY_TIMEOUT  Max seconds to wait for a fresh shell (default: 30)
EOF
  exit 1
}

# --- JSON helper ---

# Extract a field from cmux --json output (flat {"field":"val"} shape)
json_get() {
  local field="$1"
  python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d.get('$field', ''))
"
}

# Poll a surface until its shell accepts input.
#
# A freshly spawned shell can drop the leading characters of anything sent too
# early (observed via `workspace create --command "echo X"` arriving as
# "cho X"), so sending immediately is a race. Send a sentinel repeatedly until
# its OUTPUT appears; the quoting splits the token so the echoed command line
# itself cannot match. Costs ~1s and is self-correcting.
cmux_wait_shell() {
  local surface="$1" i
  for ((i = 0; i < SHELL_READY_TIMEOUT; i++)); do
    cmux send --surface "$surface" 'echo work_r"e"ady_ok' >/dev/null 2>&1 || true
    cmux send-key --surface "$surface" enter >/dev/null 2>&1 || true
    sleep 1
    if cmux read-screen --surface "$surface" --lines 40 2>/dev/null \
         | grep -qE '^work_ready_ok'; then
      return 0
    fi
  done
  echo "surface $surface never became ready after ${SHELL_READY_TIMEOUT}s" >&2
  return 1
}

# --- cmux helpers ---
# cmux 0.64.20+ refs (e.g. surface:19, workspace:8) are globally resolvable —
# send/send-key/close-surface only need --surface, no --workspace tracking required.

cmux_grid() {
  local count="$1"

  [[ "$count" =~ ^[1-9][0-9]*$ ]] || { echo "count must be a positive integer" >&2; return 1; }

  # Grid dimensions — prefer 2 columns for terminal readability
  local cols rows
  case "$count" in
    1) cols=1; rows=1 ;;
    2) cols=2; rows=1 ;;
    3|4) cols=2; rows=2 ;;
    5|6) cols=3; rows=2 ;;
    7|8) cols=4; rows=2 ;;
    *) cols=$(python3 -c "import math; print(min(math.ceil(math.sqrt($count)), 4))")
       rows=$(python3 -c "import math; print(math.ceil($count / $cols))") ;;
  esac

  # Create a new workspace for the agent grid; --json returns workspace_ref
  # and the surface_ref of its initial pane directly.
  local ws_json workspace first_surface
  ws_json=$(cmux --json workspace create --name "${GRID_NAME:-work-grid}" --focus false 2>/dev/null)
  workspace=$(echo "$ws_json" | json_get workspace_ref)
  first_surface=$(echo "$ws_json" | json_get surface_ref)
  [ -z "$workspace" ] && { echo "failed to create cmux workspace" >&2; return 1; }
  [ -z "$first_surface" ] && { echo "could not resolve initial surface" >&2; return 1; }

  # Emit the workspace ref first, prefixed so it is distinguishable from the
  # surface lines. Without this the grid workspace can never be closed and every
  # wave orphans one in cmux.
  echo "workspace=$workspace"

  if [ "$count" -le 1 ]; then
    echo "$first_surface"
    return
  fi

  # col_heads[i] = surface ref of the top cell in column i.
  # new-split takes --surface directly, so no focus step is needed.
  local col_heads=("$first_surface")
  for ((c = 1; c < cols; c++)); do
    local new_id
    new_id=$(cmux --json new-split right --workspace "$workspace" --surface "${col_heads[$((c-1))]}" --focus false 2>/dev/null | json_get surface_ref)
    [ -z "$new_id" ] && { echo "column split $c failed" >&2; return 1; }
    col_heads+=("$new_id")
  done

  # Collect all surfaces (first row = col_heads)
  local all_surfaces=("${col_heads[@]}")
  local created="$cols"

  # Create rows: for each column, split down from the previous cell in that column
  for ((c = 0; c < cols && created < count; c++)); do
    local anchor="${col_heads[$c]}"
    for ((r = 1; r < rows && created < count; r++)); do
      local new_id
      new_id=$(cmux --json new-split down --workspace "$workspace" --surface "$anchor" --focus false 2>/dev/null | json_get surface_ref)
      [ -z "$new_id" ] && { echo "row split failed in column $c" >&2; return 1; }
      all_surfaces+=("$new_id")
      anchor="$new_id"
      created=$((created + 1))
    done
  done

  printf '%s\n' "${all_surfaces[@]}"
}

cmux_launch() {
  local surface="$1" issue="$2" worktree="$3"
  local quoted_worktree
  printf -v quoted_worktree '%q' "$worktree"

  # Wait for the shell before typing — a fresh surface may still be starting up.
  cmux_wait_shell "$surface" || return 1

  # %q the worktree: an unquoted path containing spaces splits into extra args
  # and `cd` fails, leaving claude booted in the wrong directory.
  # Redirect: cmux echoes "OK <surface> <workspace>" per call, which would
  # pollute stdout — callers parse this function's output as the surface ref.
  cmux send --surface "$surface" \
    "cd $quoted_worktree && claude $(printf '%q' "/implement $issue")" >/dev/null
  cmux send-key --surface "$surface" enter >/dev/null

  echo "$surface"
}

cmux_close() {
  local surface="$1"

  # Escape first in case claude is mid-prompt, then exit claude.
  cmux send-key --surface "$surface" escape >/dev/null 2>&1 || true
  cmux send --surface "$surface" "/exit" >/dev/null 2>&1 || true
  cmux send-key --surface "$surface" enter >/dev/null 2>&1 || true
  sleep 3

  # Close the surface outright — more reliable than sending "exit" and hoping
  # the shell is back at a prompt.
  cmux close-surface --surface "$surface" >/dev/null 2>&1 || true
}

cmux_status() {
  local surface="$1"
  CMUX_QUIET=1 cmux --json tree --all 2>/dev/null | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
except Exception:
    print('closed')
    sys.exit()
target = '$surface'
found = False
for w in d.get('windows', []):
    for ws in w.get('workspaces', []):
        for p in ws.get('panes', []):
            for s in p.get('surfaces', []):
                if s.get('ref') == target:
                    found = True
print('exists' if found else 'closed')
" || echo "closed"
}

# --- tmux helpers ---
# Assumes we're inside tmux (Phase 5 of SKILL.md guarantees this).

tmux_grid() {
  local count="$1"
  local session="${TMUX_SESSION:-$(tmux display-message -p '#S')}"
  local panes=()

  # First pane: create a new window in the session
  local first_pane
  first_pane=$(tmux new-window -t "$session" -P -F '#{pane_id}')
  panes+=("$first_pane")

  for ((i = 1; i < count; i++)); do
    local pane_id
    # Alternate h/v splits; tmux tiled layout evens them out
    if ((i % 2 == 1)); then
      pane_id=$(tmux split-window -t "$session" -h -P -F '#{pane_id}')
    else
      pane_id=$(tmux split-window -t "$session" -v -P -F '#{pane_id}')
    fi
    panes+=("$pane_id")
    tmux select-layout -t "$session" tiled 2>/dev/null || true
  done

  printf '%s\n' "${panes[@]}"
}

tmux_launch() {
  local pane_id="$1" issue="$2" worktree="$3"

  tmux send-keys -t "$pane_id" "cd $worktree && claude \"/implement $issue\"" Enter

  echo "$pane_id"
}

tmux_close() {
  local pane_id="$1"

  tmux send-keys -t "$pane_id" "/exit" Enter
  sleep 3
  tmux kill-pane -t "$pane_id" 2>/dev/null || true
}

tmux_status() {
  local pane_id="$1"
  # -x: without a whole-line match, pane %1 also matches %11.
  if tmux list-panes -a -F '#{pane_id}' 2>/dev/null | grep -qFx "$pane_id"; then
    echo "exists"
  else
    echo "closed"
  fi
}

# Bootstrap: create a detached tmux session, boot claude, send /work <args>.
# Used when the user is OUTSIDE tmux. The new claude instance inside tmux
# will detect $TMUX and proceed with grid dispatch normally.
tmux_bootstrap() {
  local project_dir="$1" work_args="$2"
  local session="${TMUX_SESSION:-work}"

  # Kill stale session if it exists
  tmux kill-session -t "$session" 2>/dev/null || true

  # Create detached session in the project directory
  tmux new-session -d -s "$session" -c "$project_dir"

  # Boot claude with /work as initial prompt
  tmux send-keys -t "$session" "claude \"/work $work_args\"" Enter

  echo "$session"
}

# --- Main dispatch ---

cmd="${1:-}"
shift || true

case "$cmd" in
  grid)
    count="${1:-}"
    [[ -z "$count" ]] && { echo "Required: pane count" >&2; exit 1; }
    [[ -z "$DISPATCH" ]] && { echo "DISPATCH env var required" >&2; exit 1; }
    case "$DISPATCH" in
      cmux) cmux_grid "$count" ;;
      tmux) tmux_grid "$count" ;;
      *) echo "Unsupported DISPATCH: $DISPATCH" >&2; exit 1 ;;
    esac
    ;;

  launch)
    surface="" issue="" worktree=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --surface) surface="$2"; shift 2 ;;
        --issue) issue="$2"; shift 2 ;;
        --worktree) worktree="$2"; shift 2 ;;
        *) echo "Unknown option: $1" >&2; exit 1 ;;
      esac
    done
    [[ -z "$surface" || -z "$issue" || -z "$worktree" ]] && { echo "Required: --surface, --issue, --worktree" >&2; exit 1; }
    [[ -z "$DISPATCH" ]] && { echo "DISPATCH env var required" >&2; exit 1; }
    case "$DISPATCH" in
      cmux) cmux_launch "$surface" "$issue" "$worktree" ;;
      tmux) tmux_launch "$surface" "$issue" "$worktree" ;;
      *) echo "Unsupported DISPATCH: $DISPATCH" >&2; exit 1 ;;
    esac
    ;;

  bootstrap)
    project_dir="${1:-$(pwd)}"
    work_args="${2:-}"
    tmux_bootstrap "$project_dir" "$work_args"
    ;;

  close)
    surface="${1:-}"
    [[ -z "$surface" ]] && { echo "Required: surface/pane ID" >&2; exit 1; }
    [[ -z "$DISPATCH" ]] && { echo "DISPATCH env var required" >&2; exit 1; }
    case "$DISPATCH" in
      cmux) cmux_close "$surface" ;;
      tmux) tmux_close "$surface" ;;
      *) echo "Unsupported DISPATCH: $DISPATCH" >&2; exit 1 ;;
    esac
    ;;

  close-workspace)
    ws="${1:-}"
    [[ -z "$ws" ]] && { echo "Required: workspace ref" >&2; exit 1; }
    [[ "$DISPATCH" != "cmux" ]] && { echo "close-workspace is cmux-only" >&2; exit 1; }
    cmux close-workspace --workspace "$ws" >/dev/null 2>&1 || true
    echo "closed $ws"
    ;;

  status)
    surface="${1:-}"
    [[ -z "$surface" ]] && { echo "Required: surface/pane ID" >&2; exit 1; }
    [[ -z "$DISPATCH" ]] && { echo "DISPATCH env var required" >&2; exit 1; }
    case "$DISPATCH" in
      cmux) cmux_status "$surface" ;;
      tmux) tmux_status "$surface" ;;
      *) echo "Unsupported DISPATCH: $DISPATCH" >&2; exit 1 ;;
    esac
    ;;

  *) usage ;;
esac
