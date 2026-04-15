#!/usr/bin/env bash
# Move a GitHub Project (v2) item to a named status using cached config.
#
# Reads .github/project.yml (from bootstrap.sh) and performs the move in
# 2 GraphQL calls: resolve the project item for the issue, then set the Status
# field. If the issue isn't on the board, it is added first.
#
# Usage:
#   move.sh <issue-number> <status-name> [--close|--reopen] [-p <config>]
#
# Examples:
#   move.sh 42 "In Progress"
#   move.sh 42 Done --close
#   move.sh 42 "In Progress" --reopen

set -euo pipefail

CONFIG=".github/project.yml"
CLOSE=0
REOPEN=0
ISSUE=""
STATUS=""

usage() {
  cat <<EOF
Move a project item to a named Status.

Usage: $(basename "$0") <issue-number> <status-name> [options]

Options:
  --close        Also close the issue (for terminal statuses like Done)
  --reopen       Also reopen the issue (for resuming work)
  -p <path>      Config path (default: .github/project.yml)
  -h             Show this help

Requires .github/project.yml. Run bootstrap.sh once to create it.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --close)  CLOSE=1; shift ;;
    --reopen) REOPEN=1; shift ;;
    -p)       CONFIG="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    -*)       echo "error: unknown flag $1" >&2; usage >&2; exit 1 ;;
    *)
      if   [[ -z "$ISSUE"  ]]; then ISSUE="$1"
      elif [[ -z "$STATUS" ]]; then STATUS="$1"
      else echo "error: too many positional args" >&2; exit 1
      fi
      shift ;;
  esac
done

[[ -n "$ISSUE" && -n "$STATUS" ]] || { usage >&2; exit 1; }

if (( CLOSE + REOPEN > 1 )); then
  echo "error: --close and --reopen are mutually exclusive" >&2
  exit 1
fi

command -v gh >/dev/null || { echo "error: gh CLI not installed" >&2; exit 1; }
command -v jq >/dev/null || { echo "error: jq not installed"     >&2; exit 1; }
command -v yq >/dev/null || { echo "error: yq not installed (brew install yq)" >&2; exit 1; }

if [[ ! -f "$CONFIG" ]]; then
  echo "error: $CONFIG not found." >&2
  echo "Run: $(dirname "$0")/bootstrap.sh" >&2
  exit 1
fi

# Read cached IDs via YAML → JSON → jq (portable across yq variants)
CONFIG_JSON=$(yq -o=json '.' "$CONFIG" 2>/dev/null || yq '.' "$CONFIG")

PROJECT_ID=$(jq -r   '.project.id'                            <<<"$CONFIG_JSON")
PROJECT_NUMBER=$(jq -r '.project.number'                      <<<"$CONFIG_JSON")
PROJECT_OWNER=$(jq -r  '.project.owner'                       <<<"$CONFIG_JSON")
FIELD_ID=$(jq -r     '.project.fields.status.id'              <<<"$CONFIG_JSON")
OPTION_ID=$(jq -r --arg s "$STATUS" '.project.fields.status.options[$s] // ""' <<<"$CONFIG_JSON")

if [[ -z "$OPTION_ID" || "$OPTION_ID" == "null" ]]; then
  echo "error: status '$STATUS' not in $CONFIG. Available:" >&2
  jq -r '.project.fields.status.options | keys[]' <<<"$CONFIG_JSON" | sed 's/^/  - /' >&2
  exit 1
fi

REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
OWNER="${REPO%/*}"
NAME="${REPO#*/}"

# 1 GraphQL call: resolve the project-item ID for this issue
ITEM_ID=$(gh api graphql \
  -F owner="$OWNER" -F repo="$NAME" -F issue="$ISSUE" \
  -f query='
    query($owner:String!, $repo:String!, $issue:Int!) {
      repository(owner:$owner, name:$repo) {
        issue(number:$issue) {
          projectItems(first:20) { nodes { id project { id } } }
        }
      }
    }' \
  --jq ".data.repository.issue.projectItems.nodes[] | select(.project.id==\"$PROJECT_ID\") | .id" \
  | head -n1)

# Not on board → add it (1 extra GraphQL call, one-off per issue)
if [[ -z "$ITEM_ID" ]]; then
  echo "#$ISSUE not on board — adding..."
  ITEM_ID=$(gh project item-add "$PROJECT_NUMBER" --owner "$PROJECT_OWNER" \
    --url "https://github.com/$REPO/issues/$ISSUE" --format json \
    | jq -r '.id')
fi

# 1 GraphQL mutation: set the Status field
gh api graphql \
  -F project="$PROJECT_ID" -F item="$ITEM_ID" -F field="$FIELD_ID" -F option="$OPTION_ID" \
  -f query='
    mutation($project:ID!, $item:ID!, $field:ID!, $option:String!) {
      updateProjectV2ItemFieldValue(input:{
        projectId:$project, itemId:$item, fieldId:$field,
        value:{singleSelectOptionId:$option}
      }) { projectV2Item { id } }
    }' > /dev/null

echo "moved #$ISSUE → $STATUS"

if (( CLOSE )); then
  gh issue close "$ISSUE" >/dev/null && echo "closed #$ISSUE"
elif (( REOPEN )); then
  gh issue reopen "$ISSUE" >/dev/null && echo "reopened #$ISSUE"
fi
