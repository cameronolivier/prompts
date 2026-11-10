#!/usr/bin/env bash
# typecheck-lint.sh <track|check>
#
# Session-scoped typecheck + lint for Claude Code.
#
#   track (PostToolUse Edit|Write|MultiEdit|NotebookEdit)
#       Append the edited file path to a per-session list.
#   check (Stop, default)
#       Check ONLY files Claude edited this session. Pre-existing problems
#       elsewhere in the repo never block. Exits 2 (block + feed errors back)
#       at most once per stop: when stop_hook_active=true it exits 0, so
#       Claude can always end its turn and ask the user.
#
# Self-gating: silent no-op unless the project has package.json, node, and
# the relevant tool. node_modules paths are always skipped.
set -uo pipefail

mode="${1:-check}"
input="$(cat)"
command -v node >/dev/null 2>&1 || exit 0

field() {
  printf '%s' "$input" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const o=JSON.parse(s);process.stdout.write(String(($1) ?? ''))}catch(e){}})" 2>/dev/null
}

dir="$HOME/.claude/cache/typecheck-lint"
mkdir -p "$dir" 2>/dev/null || exit 0
sid="$(field 'o.session_id')"
[ -n "$sid" ] || sid="default"
list="$dir/edited-$sid"

case "$mode" in
  track)
    fp="$(field 'o.tool_input && (o.tool_input.file_path || o.tool_input.notebook_path)')"
    [ -n "$fp" ] || exit 0
    case "$fp" in */node_modules/*) exit 0 ;; esac
    printf '%s\n' "$fp" >> "$list"
    exit 0
    ;;
  check) ;;
  *) exit 0 ;;
esac

# Loop guard: block at most once, then let Claude stop and ask the user.
[ "$(field 'o.stop_hook_active')" = "true" ] && exit 0
[ -s "$list" ] || exit 0

root="${CLAUDE_PROJECT_DIR:-$PWD}"
cd "$root" 2>/dev/null || exit 0
root="$(pwd -P)"
[ -f package.json ] || exit 0

# Edited files that still exist, sit inside this project, and are not in
# node_modules. Paths are made relative to the project root.
files=()
while IFS= read -r f; do
  [ -f "$f" ] || continue
  abs="$(cd "$(dirname "$f")" 2>/dev/null && pwd -P)/$(basename "$f")"
  case "$abs" in
    "$root"/*) rel="${abs#"$root"/}" ;;
    *) continue ;;
  esac
  case "/$rel" in */node_modules/*) continue ;; esac
  files+=("$rel")
done < <(sort -u "$list")
[ "${#files[@]}" -gt 0 ] || exit 0

scripts="$(node -e "process.stdout.write(JSON.stringify(require('./package.json').scripts||{}))" 2>/dev/null)"
uses() { printf '%s' "$scripts" | grep -q "$1"; }
bin() { [ -x "node_modules/.bin/$1" ] && printf '%s' "node_modules/.bin/$1"; }
pick() { # $1 = regex of extensions
  local f
  for f in "${files[@]}"; do printf '%s\n' "$f"; done | grep -E "\.($1)\$"
}

out=""
status=0
fail() { out="${out}
=== $1 ===
$2"; status=2; }

# Typecheck: whole-project run, but only errors in edited files count.
ts_files="$(pick 'ts|tsx|mts|cts|vue|svelte')"
if [ -n "$ts_files" ] && node -e "process.exit((require('./package.json').scripts||{}).typecheck?0:1)" 2>/dev/null; then
  pm=npm
  pm_field="$(node -e "try{process.stdout.write((require('./package.json').packageManager||'').split('@')[0])}catch(e){}" 2>/dev/null)"
  case "$pm_field" in pnpm|yarn|npm|bun) pm="$pm_field" ;; *)
    if [ -f pnpm-lock.yaml ]; then pm=pnpm; elif [ -f yarn.lock ]; then pm=yarn
    elif [ -f bun.lockb ] || [ -f bun.lock ]; then pm=bun; fi ;;
  esac
  if command -v "$pm" >/dev/null 2>&1; then
    tc="$("$pm" run typecheck 2>&1)" || {
      hits="$(printf '%s\n' "$tc" | grep -F -f <(printf '%s\n' "$ts_files") | grep -i 'error')"
      [ -n "$hits" ] && fail "typecheck (errors in edited files)" "$hits"
    }
  fi
fi

# ESLint on edited JS/TS files.
js_files="$(pick 'js|jsx|mjs|cjs|ts|tsx|mts|cts|vue|svelte')"
if [ -n "$js_files" ] && uses eslint && e="$(bin eslint)"; then
  flag=""
  major="$("$e" --version 2>/dev/null | sed -E 's/^v?([0-9]+).*/\1/')"
  [ "${major:-0}" -ge 9 ] 2>/dev/null && flag="--no-warn-ignored"
  # shellcheck disable=SC2086
  r="$(printf '%s\n' "$js_files" | xargs "$e" $flag 2>&1)" || fail "eslint" "$r"
fi

# Prettier check on all edited files (unknown types ignored).
if uses prettier && p="$(bin prettier)"; then
  r="$("$p" --check --ignore-unknown "${files[@]}" 2>&1)" || fail "prettier --check (fix: prettier --write <files>)" "$r"
fi

# markdownlint on edited Markdown files.
md_files="$(pick 'md|mdx|markdown')"
if [ -n "$md_files" ] && uses markdownlint && m="$(bin markdownlint-cli2)"; then
  r="$(printf '%s\n' "$md_files" | xargs "$m" 2>&1)" || fail "markdownlint" "$r"
fi

if [ "$status" -ne 0 ]; then
  msg="Checks failed on files you edited this session. For each failing file:
- Project source you wrote or own: fix it (prefer the tool's own fixer, e.g. prettier --write, markdownlint-cli2 --fix, eslint --fix).
- Generated, vendored or third-party (node_modules, package-manager or tool output such as .tessl/, build output, symlinks into vendored packages): do NOT edit or delete it. Instead suggest an ignore entry: name the exact config file (e.g. .prettierignore, .markdownlint-cli2.jsonc \"ignores\", eslint.config ignores) and the exact glob, then ask the user whether to add it.
- Unsure which kind it is: ask the user.
Then stop. This hook will not block again this turn."
  printf '%s\n\n%s\n' "$msg" "$out" >&2
fi
exit "$status"
