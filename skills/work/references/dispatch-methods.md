# Dispatch methods

Details for the three dispatch modes selected in Phase 5 of `SKILL.md`. Each
describes how to spawn `/implement` agents, how to track surfaces (panes,
workspaces) on the status file, and how to tear down on `/work cleanup`.

## Claude CLI caveat

Only these forms exist:

- `claude` — interactive session.
- `claude "query"` — interactive session with an initial prompt.
- `claude -p "query"` — non-interactive print mode (exits after the response).

There is **no** `--prompt` flag. Never use `claude --prompt`.

## cmux dispatch

The orchestrator stays in its current workspace. Agents get a **new workspace**
with a grid layout (2×2, 2×3, 2×4 depending on wave size).

1. Create a grid workspace:

   ```bash
   SURFACES=$(DISPATCH=cmux "$SCRIPT_DIR/work-launch.sh" grid <wave-size>)
   ```

   Returns one surface ID per line. Grid dimensions are auto-calculated:

   | Wave size | Grid |
   | --------- | ---- |
   | 1–2       | 1×2  |
   | 3–4       | 2×2  |
   | 5–6       | 2×3  |
   | 7–8       | 2×4  |

2. Launch one agent per surface. Read surface IDs line-by-line; for each
   issue+surface pair:

   ```bash
   DISPATCH=cmux "$SCRIPT_DIR/work-launch.sh" launch \
     --surface <surface-id> \
     --issue <n> \
     --worktree "$(pwd)/.claude/worktrees/<issue>-<slug>"
   ```

3. Update the status file: set `"surface": "<surface-id>"`.

The user switches to the agent workspace to watch the grid. Click any pane to
interact.

### cmux teardown

```bash
DISPATCH=cmux "$SCRIPT_DIR/work-launch.sh" close <surface>
```

## tmux dispatch

By Phase 5 the orchestrator is guaranteed to be inside tmux. The grid appears
as a new window in the current session.

1. Create the grid window:

   ```bash
   PANES=$(DISPATCH=tmux TMUX_SESSION="$(tmux display-message -p '#S')" \
     "$SCRIPT_DIR/work-launch.sh" grid <wave-size>)
   ```

   Returns one pane ID per line. tmux auto-rebalances to a `tiled` layout.

2. Launch one agent per pane:

   ```bash
   DISPATCH=tmux TMUX_SESSION="$(tmux display-message -p '#S')" \
     "$SCRIPT_DIR/work-launch.sh" launch \
     --surface <pane-id> \
     --issue <n> \
     --worktree "$(pwd)/.claude/worktrees/<issue>-<slug>"
   ```

3. Update the status file: set `"surface": "<pane-id>"`.

Interaction: `Ctrl+B, q` shows pane numbers; `Ctrl+B, <number>` selects;
`Ctrl+B, o` cycles.

### tmux teardown

```bash
DISPATCH=tmux "$SCRIPT_DIR/work-launch.sh" close <pane-id>
```

### tmux-outside bootstrap

When tmux is installed but the user is not inside it, ask:

> You're not in a tmux session. Create one and kick off the work there? Attach
> with `tmux attach -t work`.

On yes:

```bash
"$SCRIPT_DIR/work-launch.sh" bootstrap "$(pwd)" "<original-args>"
```

This creates a detached tmux session `work`, boots claude inside it, and sends
`/work <args>`. The new claude instance detects `$TMUX`, resolves to `tmux`
dispatch, and proceeds with grid creation automatically.

Print the attach hint and stop — the bootstrapped session handles the rest.

## agent dispatch

No terminal multiplexer available. Use the `Agent` tool, one call per issue,
all issued in a single message for parallelism:

```
Agent tool:
  description: "Implement issue #<n>"
  isolation: "worktree"
  prompt: |
    You are implementing GitHub issue #<number> for the <repo> project.

    Issue title: <title>
    Issue body:
    <body>

    Follow the /implement skill workflow exactly:
    1. Detect project conventions (read CLAUDE.md, detect package manager).
    2. Create status file at <repo-root>/.olvrcc/status/issue-<n>.json with
       status "in_progress".
    3. Gather context — read the issue, related code, plan files.
    4. Implement using TDD (red-green-refactor) with atomic conventional
       commits.
    5. Run the simplify and audit-tests QA loops (scripts/qa-loop.sh).
    6. Run full verification (test, typecheck, lint).
    7. Push branch and create draft PR via `gh pr create --draft`.
    8. Run the review QA loop against the new PR.
    9. Update status to "agent_complete" with PR URL.
    10. Comment on the issue with the PR link.

    Branch name: <issue>-<slug>
    Status file: <repo-root>/.olvrcc/status/issue-<n>.json

    If blocked after two attempts, push current state, update status to
    "failed" with blocker description, and comment on the issue.
```

### agent teardown

No terminal session to close. Worktree removal happens in the shared cleanup
step (`git worktree remove`).
