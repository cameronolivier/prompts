# `/work cleanup`

Tear down finished / failed agents: close surfaces, remove worktrees, delete
branches, delete status files.

## Flow

1. Glob for `.olvrcc/status/issue-*.json`.
2. Filter to status `agent_complete`, `complete`, or `failed`.
3. For each: ask the user — "Issue #N (<status>, PR #X) — clean up? (y/n)".
4. On yes, tear down per the `dispatch` field in the status file.

### cmux teardown

```bash
DISPATCH=cmux "$SCRIPT_DIR/work-launch.sh" close <surface>
```

### tmux teardown

```bash
DISPATCH=tmux "$SCRIPT_DIR/work-launch.sh" close <pane-id>
```

### agent teardown

No terminal session to close.

### Shared teardown (all dispatches)

1. Remove the worktree and its branch:

   ```bash
   git worktree remove .claude/worktrees/<issue>-<slug>
   git branch -D <issue>-<slug>
   ```

   If the worktree has uncommitted changes, prompt the user before adding
   `--force`.

2. Delete the status file:

   ```bash
   rm .olvrcc/status/issue-<n>.json
   ```

5. If there is nothing in the `agent_complete` / `complete` / `failed` set,
   print "Nothing to clean up".

## Manual pane cleanup

The user may request closing a specific pane without tearing down its worktree:

> "Close the pane for issue #12"

Use `work-launch.sh close <surface>` alone — leave the worktree and status
file intact so the user can continue from the orchestrator pane.
