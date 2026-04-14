#!/usr/bin/env bash
set -euo pipefail

# work-launch.sh — Grid mechanics for /work skill
# Handles grid creation, agent launch, and pane teardown
# Supports both cmux and tmux via $DISPATCH env var

DISPATCH="${DISPATCH:-}"
BOOT_TIMEOUT="${BOOT_TIMEOUT:-15}"

usage() {
  cat <<EOF
Usage: work-launch.sh <command> [options]

Commands:
  grid <count>   Create a grid of <count> panes, print surface/pane IDs (one per line)
  launch         Send cd + claude + /implement to a specific surface
  bootstrap      Create a tmux session, boot claude, send /work (for outside-tmux use)
  close          Close a pane (exit claude, remove split)
  status         Check if a surface still exists

Environment:
  DISPATCH       Required. "cmux" or "tmux"
  BOOT_TIMEOUT   Seconds to wait for claude to boot (default: 15)
  TMUX_SESSION   tmux session name (default: "work")
EOF
  exit 1
}

# --- JSON helper ---

# Extract a field from cmux --json output
# Handles {"result":{"field":"val"}} and {"field":"val"}
json_get() {
  local field="$1"
  python3 -c "
import sys, json
d = json.load(sys.stdin)
r = d.get('result', d)
print(r.get('$field', d.get('$field', '')))
"
}

# --- cmux helpers ---

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

  # Create a new workspace for the agent grid
  cmux new-workspace >/dev/null 2>&1

  # Get the initial surface in the new workspace
  local first_surface
  first_surface=$(cmux --json list-surfaces | python3 -c "
import sys, json
d = json.load(sys.stdin)
r = d.get('result', d)
surfs = r if isinstance(r, list) else r.get('surfaces', [r])
for s in surfs:
    sid = s.get('surface_id', s.get('id', ''))
    if sid:
        print(sid)
        break
")

  if [ "$count" -le 1 ]; then
    echo "$first_surface"
    return
  fi

  # col_heads[i] = surface ID of the top cell in column i
  local col_heads=("$first_surface")

  # Create columns: split right from the first surface (cols-1) times
  cmux focus-surface --surface "$first_surface"
  for ((c = 1; c < cols; c++)); do
    local new_id
    new_id=$(cmux --json new-split right | json_get surface_id)
    col_heads+=("$new_id")
  done

  # Collect all surfaces (first row = col_heads)
  local all_surfaces=("${col_heads[@]}")
  local created="$cols"

  # Create rows: for each column, focus it and split down
  for ((c = 0; c < cols && created < count; c++)); do
    cmux focus-surface --surface "${col_heads[$c]}"
    for ((r = 1; r < rows && created < count; r++)); do
      local new_id
      new_id=$(cmux --json new-split down | json_get surface_id)
      all_surfaces+=("$new_id")
      created=$((created + 1))
    done
  done

  printf '%s\n' "${all_surfaces[@]}"
}

cmux_launch() {
  local surface="$1" issue="$2" worktree="$3"

  # cd into worktree and boot claude
  cmux send-surface --surface "$surface" "cd $worktree && claude"
  cmux send-key-surface --surface "$surface" enter

  # Wait for claude to boot (no read-screen API — use timed wait)
  sleep "$BOOT_TIMEOUT"

  # Send /implement command
  cmux send-surface --surface "$surface" "/implement $issue"
  cmux send-key-surface --surface "$surface" enter

  echo "$surface"
}

cmux_close() {
  local surface="$1"

  # Send /exit to claude
  cmux send-surface --surface "$surface" "/exit"
  cmux send-key-surface --surface "$surface" enter
  sleep 3

  # Exit the shell to close the pane
  cmux send-surface --surface "$surface" "exit"
  cmux send-key-surface --surface "$surface" enter
}

cmux_status() {
  local surface="$1"
  # Check if the surface still exists
  cmux --json list-surfaces | python3 -c "
import sys, json
d = json.load(sys.stdin)
r = d.get('result', d)
surfs = r if isinstance(r, list) else r.get('surfaces', [])
found = any(
    s.get('surface_id', s.get('id', '')) == '$surface'
    for s in surfs
)
print('exists' if found else 'closed')
" 2>/dev/null || echo "closed"
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

  tmux send-keys -t "$pane_id" "cd $worktree && claude" Enter
  sleep "$BOOT_TIMEOUT"
  tmux send-keys -t "$pane_id" "/implement $issue" Enter

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

  # Boot claude in the first pane
  tmux send-keys -t "$session" "claude" Enter

  # Wait for claude to boot
  sleep "$BOOT_TIMEOUT"

  # Send the /work command with the original arguments
  tmux send-keys -t "$session" "/work $work_args" Enter

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
