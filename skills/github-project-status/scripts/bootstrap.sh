#!/usr/bin/env bash
# Bootstrap .github/project.json from a GitHub Projects v2 board.
#
# Caches project ID, Status (or other single-select) field ID, and option IDs
# so routine status moves skip the lookup chain (4 GraphQL calls → 2).
#
# Usage:
#   bootstrap.sh [-n <number>] [-o <owner>] [-f <field>] [-p <path>]
#
# Defaults: owner=@me, field=Status, path=.github/project.json
# If -n is omitted, prints a picker from `gh project list`.

set -euo pipefail

OWNER="@me"
FIELD="Status"
NUMBER=""
CONFIG=".github/project.json"

usage() {
  cat <<EOF
Bootstrap a GitHub Projects v2 coordinate cache.

Usage: $(basename "$0") [-n <number>] [-o <owner>] [-f <field>] [-p <path>]
  -n  Project number (prompted if omitted)
  -o  Owner: user login, org login, or @me (default: @me)
  -f  Single-select field to cache (default: Status)
  -p  Output path (default: .github/project.json)
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

OPTIONS=$(jq -c --arg f "$FIELD" '
  [.fields[] | select(.name==$f) | .options // [] | .[] | {key: .name, value: .id}] | from_entries
' <<<"$FIELD_JSON")

if [[ "$OPTIONS" == "{}" ]]; then
  echo "error: field '$FIELD' has no options — not a single-select field?" >&2
  exit 1
fi

[[ "$NUMBER" =~ ^[0-9]+$ ]] || { echo "error: project number must be numeric, got '$NUMBER'" >&2; exit 1; }

FIELD_KEY=$(tr '[:upper:]' '[:lower:]' <<<"$FIELD" | tr -cd 'a-z0-9_')

mkdir -p "$(dirname "$CONFIG")"
jq -n \
  --arg gen "github-project-status skill. Regenerate with: $(basename "$0")" \
  --arg title "$PROJECT_TITLE" --argjson number "$NUMBER" --arg owner "$OWNER" \
  --arg id "$PROJECT_ID" --arg key "$FIELD_KEY" --arg field "$FIELD" \
  --arg field_id "$FIELD_ID" --argjson options "$OPTIONS" '
  {
    _generated_by: $gen,
    project: {
      title: $title, number: $number, owner: $owner, id: $id,
      fields: { ($key): { name: $field, id: $field_id, options: $options } }
    }
  }' > "$CONFIG"

LEGACY="${CONFIG%.json}.yml"
[[ -f "$LEGACY" ]] && echo "note: $LEGACY is superseded — git rm it."

echo ""
echo "Wrote $CONFIG:"
echo ""
sed 's/^/  /' "$CONFIG"
echo ""
echo "Next: git add $CONFIG && git commit -m 'chore: cache GitHub project coordinates'"
