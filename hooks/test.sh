#!/usr/bin/env bash
# Self-contained tests for the hooks. Uses a throwaway HOME and a fixture
# project with a fake `prettier` that fails on any file containing "BAD",
# so no real repo, network or installed linter is needed. Requires node.
#
#   ./hooks/test.sh
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
TL="$HERE/typecheck-lint.sh"
BS="$HERE/boyscout-nudge.sh"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
export HOME="$work/home"
proj="$work/proj"
mkdir -p "$HOME" "$proj/node_modules/.bin" "$proj/node_modules/pkg" "$proj/src"
export CLAUDE_PROJECT_DIR="$proj"

cat > "$proj/package.json" <<'EOF'
{ "name": "fixture", "scripts": { "format:check": "prettier --check ." } }
EOF
cat > "$proj/node_modules/.bin/prettier" <<'EOF'
#!/usr/bin/env bash
rc=0
for a in "$@"; do case "$a" in -*) ;; *) grep -q BAD "$a" && { echo "[warn] $a"; rc=1; } ;; esac; done
exit $rc
EOF
chmod +x "$proj/node_modules/.bin/prettier"
echo "ok" > "$proj/src/good.js"
echo "BAD" > "$proj/src/bad.js"
echo "BAD" > "$proj/node_modules/pkg/README.md"
echo "BAD" > "$work/outside.js"

pass=0; fail=0
track() { printf '{"session_id":"%s","tool_input":{"file_path":"%s"}}' "$1" "$2" | bash "$TL" track; }
check() { printf '{"session_id":"%s","stop_hook_active":%s}' "$1" "$2" | bash "$TL" check 2>/dev/null; echo $?; }
expect() { # $1 name, $2 expected, $3 actual
  if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "ok   $1"
  else fail=$((fail+1)); echo "FAIL $1 (expected $2, got $3)"; fi
}

expect "no edits -> allow stop"                 0 "$(check s1 false)"
track s2 "$proj/node_modules/pkg/README.md"
expect "node_modules edit -> skipped"           0 "$(check s2 false)"
track s3 "$proj/src/good.js"
expect "clean edited file -> allow stop"        0 "$(check s3 false)"
track s4 "$proj/src/bad.js"
expect "bad edited file -> block once"          2 "$(check s4 false)"
expect "bad file + stop_hook_active -> allow"   0 "$(check s4 true)"
track s5 "$work/outside.js"
expect "file outside project -> skipped"        0 "$(check s5 false)"
# Pre-existing bad file the session never touched must not block.
track s6 "$proj/src/good.js"
expect "untouched bad file -> ignored"          0 "$(check s6 false)"

msg="$(printf '{"session_id":"s4","stop_hook_active":false}' | bash "$TL" check 2>&1 >/dev/null)"
case "$msg" in *"suggest an ignore entry"*) r=yes ;; *) r=no ;; esac
expect "block message asks before ignoring"     yes "$r"

bs() { printf '{"session_id":"b","stop_hook_active":%s,"tool_input":{"file_path":"%s"}}' "$2" "${3:-}" | bash "$BS" "$1" 2>/dev/null; echo $?; }
bs mark false "$proj/src/good.js" >/dev/null
expect "boyscout: code edit -> nudge once"      2 "$(bs check false)"
bs mark false "$proj/src/good.js" >/dev/null
expect "boyscout: stop_hook_active -> allow"    0 "$(bs check true)"

echo; echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
