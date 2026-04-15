---
name: github-project-status
description: Move GitHub Project (v2) board items between columns by setting the Status field via gh CLI, using a per-repo config cache so routine moves cost one API call. Auto-moves items on lifecycle events (start → In Progress, PR open → In Review, close → Done). Use when user asks to move an issue on a project board, change column, update status, OR when starting/finishing/reviewing work on an issue that belongs to a project.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash(gh project:*)
  - Bash(gh issue close:*)
  - Bash(gh issue reopen:*)
  - Bash(gh api graphql:*)
  - Bash(gh api rate_limit:*)
  - Bash(gh auth status:*)
  - Bash(gh auth refresh:*)
  - Bash(jq:*)
  - Bash(yq:*)
model: haiku
---

# GitHub Project Status

> **Recommended model: Haiku** — bundled scripts (`bootstrap.sh`, `move.sh`) do the work; the skill is "decide which option name to pass to move.sh". Pure dispatch.

Projects v2 boards have no "columns" — "columns" are values of the **Status** single-select field. Moving = editing the Status field via `gh project item-edit`. `gh project move` does not exist.

**Every `gh project *` call is GraphQL.** Uncached, a single move costs 3–4 GraphQL calls. With a repo-committed config, it's 1 mutation. Always lead with the config. See `github-cli-rate-limits` for the rate-limit discipline this skill depends on.

## The config file (source of truth)

Each repo caches its project coordinates in `.github/project.yml`. This file is **committed** so every agent / machine reads it without hitting the API.

```yaml
# .github/project.yml
project:
  number: 7
  owner: "@me"              # or org / user login
  id: PVT_kwHOA...          # project node ID
  fields:
    status:
      id: PVTSSF_lAHOA...   # Status field ID
      options:              # name → option ID
        Backlog:       "abc12345"
        Todo:          "def67890"
        "In Progress": "ghi13579"
        "In Review":   "jkl24680"
        Done:          "mno11223"
        Blocked:       "pqr44556"
```

Treat this as cache, not secrets — these IDs are not sensitive.

## Steady-state move

Always use the bundled script — it reads `.github/project.yml`, resolves the item ID, and sets the status in 2 GraphQL calls (1 query + 1 mutation). Regenerating the graphql by hand for each move is wasteful and error-prone.

```bash
./scripts/move.sh 42 "In Progress"
./scripts/move.sh 42 Done --close          # terminal status — also closes issue
./scripts/move.sh 42 "In Progress" --reopen # resuming — also reopens issue
```

The script:
- Fails fast with a clear error if the status name isn't in the config (lists available).
- Auto-adds the issue to the board if it's not already on it.
- Is idempotent — re-running with the same status is a no-op mutation.
- Only touches `gh issue close/reopen` when `--close`/`--reopen` is passed.

If you need to do the move without the script (e.g. from another tool), the 2-call shape is: `gh api graphql` query for `repository.issue(number:N).projectItems.nodes[] | select(.project.id==$PROJECT_ID) | .id` → `gh api graphql` mutation `updateProjectV2ItemFieldValue` with `value: { singleSelectOptionId: $option }`.

## Auto-move triggers

When other skills operate on an issue, this skill must move the card. Apply the mapping — don't ask the user each time.

| Event | Command |
|---|---|
| Start implementing (`/implement`, `/work`, picking up a ticket) | `move.sh <n> "In Progress"` |
| Open PR for the issue (`/create-pr`) | `move.sh <n> "In Review"` |
| Work complete (merge / manual close) | `move.sh <n> Done --close` |
| Blocked / waiting on external | `move.sh <n> Blocked` |
| Resume a closed or stalled ticket | `move.sh <n> "In Progress" --reopen` |

Rules:
- Pair `Done` with `--close` and `In Progress` with `--reopen` — status and issue state must stay in sync.
- Even if the project has a built-in workflow that auto-moves closed issues, run the explicit `move.sh ... --close` anyway — workflows can be disabled silently and the call is idempotent.
- If the mapped status name isn't in `.github/project.yml`, `move.sh` fails with the list of available options. Pick the nearest match (`Review` → `In Review`, `WIP` → `In Progress`) and re-run. Don't invent new statuses.

## Bootstrap (one-time, per repo)

When `.github/project.yml` is missing, run the bundled script from this skill:

```bash
# Interactive — shows a picker
./scripts/bootstrap.sh

# Or non-interactive
./scripts/bootstrap.sh -n 7 -o my-org -f Status
```

The script resolves `@me` to the real login (so the committed config works for teammates), fetches the project + Status field + all options in 2 GraphQL calls, and writes `.github/project.yml`. It does not auto-commit — review, then commit manually.

If the target is outside the current repo, pass `-p path/to/project.yml`. To cache a non-Status single-select (e.g. `Priority`), pass `-f Priority` and the key in the YAML becomes `priority`.

## Fallback (no config / stale IDs)

If `.github/project.yml` is missing, mutation fails with `Could not resolve to a node`, or option names have drifted:

1. Re-run bootstrap.
2. If that's not possible right now, degrade to the uncached 4-call path: `gh project view` → `field-list` → `item-list -L 200` → `item-edit`. Cache the result into memory for the rest of the session, and offer to persist it.

Do **not** silently make 4 calls per move in a loop — that's how the rate limit gets burned.

## Pitfalls

- **Item ID ≠ issue number** (`PVTI_*` opaque ID from the project).
- **Project ID ≠ project number** (`PVT_*` node ID — cached in config).
- **Drafts** (`.content.type=="DraftIssue"`) don't need `--project-id` on `item-edit`.
- **Issue not on board**: `gh project item-add <n> --owner <o> --url <issue-url>` first.
- **Default `-L` is 30** on `item-list` fallbacks — use `-L 200+`.
- **Case-sensitive status names** — `"in progress"` ≠ `"In Progress"`.

## Verifying

```bash
gh api graphql -F owner="${REPO%/*}" -F repo="${REPO#*/}" -F issue=$ISSUE -f query='
  query($owner:String!,$repo:String!,$issue:Int!) {
    repository(owner:$owner,name:$repo) {
      issue(number:$issue) {
        title
        projectItems(first:5) { nodes {
          fieldValueByName(name:"Status") {
            ... on ProjectV2ItemFieldSingleSelectValue { name }
          }
        }}
      }
    }
  }' --jq '.data.repository.issue | {title, status: .projectItems.nodes[0].fieldValueByName.name}'
```
