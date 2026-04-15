#!/usr/bin/env bash
# Bootstrap .github/project.yml from a GitHub Projects v2 board.
#
# Caches project ID, Status (or other single-select) field ID, and option IDs
# so routine status moves skip the lookup chain (4 GraphQL calls → 2).
#
# Usage:
#   bootstrap.sh [-n <number>] [-o <owner>] [-f <field>] [-p <path>]
#
# Defaults: owner=@me, field=Status, path=.github/project.yml
# If -n is omitted, prints a picker from `gh project list`.

set -euo pipefail

OWNER="@me"
FIELD="Status"
NUMBER=""
CONFIG=".github/project.yml"

usage() {
  cat <<EOF
Bootstrap a GitHub Projects v2 coordinate cache.

Usage: $(basename "$0") [-n <number>] [-o <owner>] [-f <field>] [-p <path>]
  -n  Project number (prompted if omitted)
  -o  Owner: user login, org login, or @me (default: @me)
  -f  Single-select field to cache (default: Status)
  -p  Output path (default: .github/project.yml)
  -h  Show this help

Writes the config file. Does not git-add or commit.
EOF
}

while getopts "n:o:f:p:h" opt; do
  case "$opt" in
    n) NUMBER="$OPTARG" ;;
    o) OWNER="$OPTARG" ;;
    f) FIELD="$OPTARG" ;;
    p) CONFIG="$OPTARG" ;;
    h) usage; exit 0 ;;
    *) usage >&2; exit 1 ;;
  esac
done

command -v gh >/dev/null || { echo "error: gh CLI not installed" >&2; exit 1; }
command -v jq >/dev/null || { echo "error: jq not installed" >&2; exit 1; }

# Auth scope check — project scope is required for Projects v2
if ! gh auth status 2>&1 | grep -qE "(project|Token scopes:.*project)"; then
  echo "error: gh token missing 'project' scope. Run: gh auth refresh -s project" >&2
  exit 1
fi

# Resolve @me → real login so the cached config is portable across teammates
if [[ "$OWNER" == "@me" ]]; then
  RESOLVED=$(gh api user --jq .login)
  echo "Resolved @me → $RESOLVED"
  OWNER="$RESOLVED"
fi

# Interactive project picker if -n not provided
if [[ -z "$NUMBER" ]]; then
  echo ""
  echo "Projects owned by $OWNER:"
  gh project list --owner "$OWNER" --format json \
    | jq -r '.projects[] | "  [\(.number)] \(.title)\(if .closed then " (closed)" else "" end)"'
  echo ""
  read -rp "Project number: " NUMBER
  [[ -n "$NUMBER" ]] || { echo "error: no number provided" >&2; exit 1; }
fi

echo "Fetching project $NUMBER from $OWNER..."

PROJECT_JSON=$(gh project view "$NUMBER" --owner "$OWNER" --format json)
PROJECT_ID=$(jq -r '.id'    <<<"$PROJECT_JSON")
PROJECT_TITLE=$(jq -r '.title' <<<"$PROJECT_JSON")

FIELD_JSON=$(gh project field-list "$NUMBER" --owner "$OWNER" --format json -L 100)
FIELD_ID=$(jq -r --arg f "$FIELD" '.fields[] | select(.name==$f) | .id' <<<"$FIELD_JSON")

if [[ -z "$FIELD_ID" || "$FIELD_ID" == "null" ]]; then
  echo "error: field '$FIELD' not found. Available fields:" >&2
  jq -r '.fields[] | "  - \(.name) (\(.type // "?"))"' <<<"$FIELD_JSON" >&2
  exit 1
fi

OPTIONS_YAML=$(jq -r --arg f "$FIELD" '
  .fields[] | select(.name==$f) | .options // [] |
  .[] | "        \"\(.name)\": \"\(.id)\""
' <<<"$FIELD_JSON")

if [[ -z "$OPTIONS_YAML" ]]; then
  echo "error: field '$FIELD' has no options — not a single-select field?" >&2
  exit 1
fi

FIELD_KEY=$(tr '[:upper:]' '[:lower:]' <<<"$FIELD" | tr -cd 'a-z0-9_')

mkdir -p "$(dirname "$CONFIG")"
cat > "$CONFIG" <<EOF
# GitHub Projects v2 coordinates — cached by github-project-status skill.
# Regenerate with: $(basename "$0")
project:
  title: "$PROJECT_TITLE"
  number: $NUMBER
  owner: "$OWNER"
  id: "$PROJECT_ID"
  fields:
    $FIELD_KEY:
      name: "$FIELD"
      id: "$FIELD_ID"
      options:
$OPTIONS_YAML
EOF

echo ""
echo "Wrote $CONFIG:"
echo ""
sed 's/^/  /' "$CONFIG"
echo ""
echo "Next: git add $CONFIG && git commit -m 'chore: cache GitHub project coordinates'"
