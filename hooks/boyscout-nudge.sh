#!/usr/bin/env bash
# boyscout-nudge.sh <clear|mark|check>
#
# Auto-invokes the `boyscout` skill at the end of any turn where SOURCE CODE
# was edited — regardless of which (if any) PR/workflow skills fired. Planning
# turns stay silent because nothing gets marked.
#
# Wired to three hook events (see ~/.claude/settings.json):
#   clear  (UserPromptSubmit)          -> reset the per-session marker (fresh turn)
#   mark   (PostToolUse Edit|Write|..) -> flag that a code file was edited
#   check  (Stop)                      -> if flagged & not already inside a
#                                         stop-hook continuation, exit 2 so Claude
#                                         runs boyscout, then clear the flag
#
# Loop-safe: the `check` mode bails when stop_hook_active=true (the forced
# boyscout run re-marks via PostToolUse; that second Stop is ignored), and the
# next real prompt clears the stale marker via `clear`.
set -uo pipefail

mode="${1:-}"
dir="$HOME/.claude/cache/boyscout"
mkdir -p "$dir" 2>/dev/null || exit 0

input="$(cat)"
command -v node >/dev/null 2>&1 || exit 0   # need node to parse the hook JSON

# Pull one field out of the hook's stdin JSON. Arg is a JS expression on `o`.
field() {
  printf '%s' "$input" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const o=JSON.parse(s);process.stdout.write(String(($1) ?? ''))}catch(e){}})" 2>/dev/null
}

sid="$(field 'o.session_id')"
[ -n "$sid" ] || sid="default"
marker="$dir/pending-$sid"

case "$mode" in
  clear)
    rm -f "$marker" 2>/dev/null
    exit 0
    ;;

  mark)
    fp="$(field 'o.tool_input && o.tool_input.file_path')"
    [ -n "$fp" ] || exit 0
    # Skip planning / docs / non-source surfaces.
    case "$fp" in
      *.md|*.mdx|*.markdown|*.txt|*.mdc)                      exit 0 ;;
      */plans/*|*/.claude/*|*/scratchpad/*|*/.git/*|*/node_modules/*) exit 0 ;;
    esac
    : > "$marker" 2>/dev/null
    exit 0
    ;;

  check)
    [ "$(field 'o.stop_hook_active')" = "true" ] && exit 0   # loop guard
    [ -f "$marker" ] || exit 0                               # no code edited this turn
    rm -f "$marker" 2>/dev/null
    printf '%s\n' "Source files were edited this turn. Before finishing, invoke the boyscout skill (Skill tool, skill name: \"boyscout\") to leave the files you touched a little cleaner against the project's coding rules — auto-apply safe fixes, flag risky/structural items. If boyscout is genuinely unavailable or there is nothing worth cleaning, say so in one line and stop." >&2
    exit 2
    ;;

  *)
    exit 0
    ;;
esac
