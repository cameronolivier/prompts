#!/usr/bin/env bash
set -euo pipefail

# work-launch.sh — Grid mechanics for /work skill
# Handles grid creation, agent launch, and pane teardown
# Supports both cmux and tmux via $DISPATCH env var

DISPATCH="${DISPATCH:-}"

usage() {
  cat <<EOF
Usage: work-launch.sh <command> [options]

Commands:
  grid <count>   Create a grid of <count> panes, print surface/pane IDs (one per line)
  launch         Boot claude with /implement as initial prompt in a surface
  bootstrap      Create a tmux session and boot claude with /work as initial prompt
  close          Close a pane (exit claude, remove split)
  status         Check if a surface still exists

Environment:
  DISPATCH       Required. "cmux" or "tmux"
  TMUX_SESSION   tmux session name (default: "work")
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

# --- cmux helpers ---
# cmux 0.64.20+ refs (e.g. surface:19, workspace:8) are globally resolvable —
# send/send-key/close-surface only need --surface, no --workspace tracking required.

cmux_grid() {
  local count="$1"

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
  ws_json=$(CMUX_QUIET=1 cmux --json workspace create --name "work-grid")
  workspace=$(echo "$ws_json" | json_get workspace_ref)
  first_surface=$(echo "$ws_json" | json_get surface_ref)

  if [ "$count" -le 1 ]; then
    echo "$first_surface"
    return
  fi

  # col_heads[i] = surface ref of the top cell in column i.
  # new-split takes --surface directly, so no focus step is needed.
  local col_heads=("$first_surface")
  for ((c = 1; c < cols; c++)); do
    local new_id
    new_id=$(CMUX_QUIET=1 cmux --json new-split right --workspace "$workspace" --surface "${col_heads[$((c-1))]}" | json_get surface_ref)
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
      new_id=$(CMUX_QUIET=1 cmux --json new-split down --workspace "$workspace" --surface "$anchor" | json_get surface_ref)
      all_surfaces+=("$new_id")
      anchor="$new_id"
      created=$((created + 1))
    done
  done

  printf '%s\n' "${all_surfaces[@]}"
}

cmux_launch() {
  local surface="$1" issue="$2" worktree="$3"

  cmux send --surface "$surface" "cd $worktree && claude \"/implement $issue\""
  cmux send-key --surface "$surface" enter

  echo "$surface"
}

cmux_close() {
  local surface="$1"

  # Send /exit to claude
  cmux send --surface "$surface" "/exit"
  cmux send-key --surface "$surface" enter
  sleep 3

  # Exit the shell to close the pane
  cmux send --surface "$surface" "exit"
  cmux send-key --surface "$surface" enter
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
  if tmux list-panes -a -F '#{pane_id}' 2>/dev/null | grep -qF "$pane_id"; then
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
