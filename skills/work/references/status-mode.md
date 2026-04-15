# `/work status`

Read all active agent status and render a summary table.

## Flow

1. Glob for `.olvrcc/status/issue-*.json`.
2. Read each file; parse JSON.
3. For interactive dispatch, check if the surface / pane still exists:

   ```bash
   DISPATCH=<dispatch> "$SCRIPT_DIR/work-launch.sh" status <surface>
   ```

   Returns `exists` or `closed`.

4. Print a summary table:

   | Issue | Title | Status | Wave | Branch | Pane | PR |
   | ----- | ----- | ------ | ---- | ------ | ---- | -- |
   | #N    | Title | in_progress    | 1 | branch-name | surface-id | — |
   | #M    | Title | agent_complete | 1 | branch-name | surface-id | PR #42 (draft) |

5. If no status files exist, print "No active agents".

## Status values

| Status | Meaning |
| ------ | ------- |
| `pending`        | Worktree created, agent not yet started. |
| `in_progress`    | Agent is implementing. |
| `agent_complete` | Draft PR created, all checks pass. |
| `in_review`      | PR taken out of draft (human-set). |
| `complete`       | PR merged (human-set). |
| `failed`         | Agent bailed after 2 attempts. |
