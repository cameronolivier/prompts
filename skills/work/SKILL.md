---
name: work
description: Orchestrate GitHub issue implementation via parallel agents and git worktrees. `/work <labels>` or `/work epic <number>` to orchestrate, `/work status` to check progress, `/work cleanup` to tear down. Auto-detects cmux/tmux for interactive sessions, falls back to autonomous subagents.
allowed-tools:
  - Read
  - Write
  - Bash
  - Bash(gh issue list *)
  - Bash(gh issue view *)
  - Bash(gh pr *)
  - Bash(cmux *)
  - Bash(tmux *)
  - Bash(git worktree *)
  - Bash(git branch *)
  - Bash(git diff *)
  - Agent
  - Grep
  - Glob
---

Orchestrate implementation of GitHub issues in parallel using git worktrees.

**Arguments:** `$ARGUMENTS` — GitHub labels, `epic <number>`, `status`, or `cleanup`

## Mode Detection

Parse `$ARGUMENTS`:

- `status` → Status mode
- `cleanup` → Cleanup mode
- `epic <number>` → Fetch issues from epic
- Otherwise → args are GitHub labels

---

## Phase 1: Detect Project

```bash
gh repo view --json nameWithOwner -q '.nameWithOwner'
```

Read CLAUDE.md or package.json to understand project structure (monorepo layout, package manager, test commands).

## Phase 2: Fetch Issues

**Label mode:**

```bash
gh issue list --label "<label>" --state open --json number,title,body,labels --limit 100
```

**Epic mode:**

```bash
gh issue view <number> --json number,title,body,labels
gh issue list --label "epic:<slug>" --state open --json number,title,body,labels --limit 100
```

If the epic body contains a task list with issue references (`- [ ] #N`), also fetch those directly. Deduplicate.

Sort all issues by number ascending.

## Phase 3: Analyze Dependency Graph

For each issue, determine:

1. **File scope** — which files/directories/packages it touches (from issue body, labels, or codebase knowledge)
2. **Blocking dependencies** — explicit "blocked by #N" or "depends on #N" in issue body
3. **Implicit conflicts** — issues modifying the same files or packages

Build a dependency graph. Identify:

- **Independent sets** — groups with no shared files or dependencies → parallel candidates
- **Serial chains** — issues that must complete in order
- **Conflict clusters** — issues touching the same files → sequential

## Phase 4: Plan Execution Waves

Organize into waves:

- **Wave 1:** All issues with no dependencies and no file conflicts with each other
- **Wave 2:** Issues that depend on Wave 1, plus independent issues that conflict with Wave 1
- **Wave N:** Continue until all issues scheduled

Maximum 4-5 agents per wave.

### Exclude Active Agents

Read all files matching `.olvrcc/status/issue-*.json`. Exclude any issue numbers with `pending` or `in_progress` status.

### Present Plan

Print the execution plan:

```
Wave 1 (parallel):
  #12 - Add auth middleware (packages/api)
  #14 - Add user avatar component (packages/ui)

Wave 2 (after wave 1):
  #15 - Add auth to API routes (packages/api) — depends on #12
  #16 - Add avatar to profile page (packages/web) — depends on #14

Wave 3:
  #18 - E2E tests for auth flow — depends on #12, #15
```

Ask the user to confirm before proceeding.

## Phase 5: Detect Dispatch Method

```bash
command -v cmux && echo "cmux" || (command -v tmux && echo "tmux" || echo "agent")
```

- **cmux** → interactive terminal sessions (preferred)
- **tmux** → interactive terminal sessions (fallback)
- **agent** → autonomous subagents via Agent tool (no terminal multiplexer available)

Tell the user which dispatch method was detected. If `agent` mode, warn: "No cmux/tmux found — using autonomous subagents. You won't be able to interact with agents mid-flight."

Store as `$DISPATCH`.

## Phase 6: Execute Waves

For each wave:

### 6a. Create Status Files

```bash
mkdir -p .olvrcc/status
```

Write `.olvrcc/status/issue-<n>.json` for each issue:

```json
{
  "issue": <n>,
  "title": "<title>",
  "status": "pending",
  "branch": "worktree-<issue>-<slug>",
  "worktree": ".claude/worktrees/<issue>-<slug>",
  "dispatch": "<cmux|tmux|agent>",
  "wave": <wave-number>,
  "session": null
}
```

### 6b. Spawn Agents

Launch all agents in the current wave in parallel, using the detected dispatch method:

<details>
<summary><strong>cmux dispatch</strong></summary>

For each issue:

1. **Create cmux workspace:**
   ```bash
   cmux --json new-workspace
   ```
   Parse the workspace UUID.

2. **Name the workspace:**
   ```bash
   cmux rename-workspace --workspace <uuid> "#<issue> - <title>"
   ```
   Truncate the title if needed to keep it readable in the sidebar.

3. **Get surface reference:**
   ```bash
   cmux --json list-pane-surfaces --workspace <uuid>
   ```

4. **Update status file** — set `session` to workspace UUID, store `"surface": "<ref>"`.

5. **Send Claude with worktree:**
   ```bash
   cmux send --surface <ref> "claude --worktree <issue>-<slug>\n"
   ```

6. **Wait for boot:** Poll `cmux read-screen --surface <ref>` for Claude prompt. Timeout 30s.

7. **Send implement:**
   ```bash
   cmux send --surface <ref> "/implement <issue-number>\n"
   ```

</details>

<details>
<summary><strong>tmux dispatch</strong></summary>

For each issue:

1. **Create tmux session:**
   ```bash
   tmux new-session -d -s "work-<issue>-<slug>"
   ```

2. **Name the session window** for easy identification:
   ```bash
   tmux rename-window -t "work-<issue>-<slug>" "#<issue> - <title>"
   ```

3. **Update status file** — set `session` to `"work-<issue>-<slug>"`.

4. **Send Claude with worktree:**
   ```bash
   tmux send-keys -t "work-<issue>-<slug>" "claude --worktree <issue>-<slug>" Enter
   ```

5. **Wait for boot:** Poll `tmux capture-pane -t "work-<issue>-<slug>" -p` for Claude prompt. Timeout 30s.

6. **Send implement:**
   ```bash
   tmux send-keys -t "work-<issue>-<slug>" "/implement <issue-number>" Enter
   ```

**User interaction:** `tmux attach -t "work-<issue>-<slug>"`, detach with `Ctrl+B, D`.

</details>

<details>
<summary><strong>agent dispatch</strong></summary>

For each issue, call the Agent tool:

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
    1. Detect project conventions (read CLAUDE.md, detect package manager)
    2. Create status file at <repo-root>/.olvrcc/status/issue-<n>.json with status "in_progress"
    3. Gather context — read the issue, related code, and plan files
    4. Implement using TDD (red-green-refactor) with atomic conventional commits
    5. Run full verification (test, typecheck, lint)
    6. Push branch and create PR via `gh pr create`
    7. Update status file to "complete" with PR URL
    8. Comment on the issue with the PR link

    Branch name: <issue>-<slug>
    Status file: <repo-root>/.olvrcc/status/issue-<n>.json

    If blocked after two attempts, push current state, update status to "failed" with blocker description, and comment on the issue.
```

Launch all agents in a single message (parallel tool calls).

</details>

### 6c. Report Wave Launch

Print summary table:

| Issue | Title | Branch | Session/Agent |
| ----- | ----- | ------ | ------------- |
| #N    | Title | worktree-\<issue\>-\<slug\> | \<session ref\> |

If using tmux: `Attach with: tmux attach -t "work-<issue>-<slug>"`

### 6d. Monitor Wave Completion

**For interactive dispatch (cmux/tmux):**

Stop after launching the wave. The user monitors via `/work status` and cleans up via `/work cleanup`. When ready for the next wave, the user runs `/work <labels>` or `/work epic <number>` again — the already-completed issues are excluded automatically via status files.

**For agent dispatch:**

Wait for all agents to return, then:

1. **Check for failures** — read each status file:
   - Can you unblock by merging a completed PR first? **Ask the user** before merging, then re-spawn if approved.
   - Genuine blocker? Note for final report and continue.
   - **Never auto-merge PRs.** Always get user confirmation first.

2. **Cross-cutting review** — check for conflicts between the wave's PRs:
   ```bash
   git diff <branch-a>...<branch-b> -- <shared-paths>
   ```
   Flag any conflicts.

3. Proceed to the next wave automatically.

## Phase 7: Final Report

After all waves complete (or after launching for interactive dispatch), produce:

```
## Orchestration Report

### Summary
- Total issues: N
- Dispatched: N
- Completed: N
- Failed/Blocked: N
- Remaining waves: N

### PRs Created
| Issue | Title | PR | CI Status |
|-------|-------|----|-----------|
| #N    | Title | PR #M | passing/failing |

### Blocked Issues
| Issue | Title | Blocker |
|-------|-------|---------|
| #N    | Title | Description |

### Cross-Cutting Concerns
- [file conflicts between PRs]
- [shared dependency issues]

### Next Steps
- [merge order if PRs have dependencies]
- [manual fixes for blocked issues]
- [remaining waves to dispatch]
```

Check CI status:
```bash
gh pr checks <pr-number>
```

---

## Status Mode (`/work status`)

1. Glob for `.olvrcc/status/issue-*.json`
2. Read each file, parse JSON
3. Print summary table:

| Issue | Title | Status      | Wave | Branch      | Dispatch | Session | PR     |
| ----- | ----- | ----------- | ---- | ----------- | -------- | ------- | ------ |
| #N    | Title | in_progress | 1    | branch-name | tmux     | session | —      |
| #M    | Title | complete    | 1    | branch-name | cmux     | surface | PR #42 |

4. If no status files exist, print "No active agents"

---

## Cleanup Mode (`/work cleanup`)

1. Glob for `.olvrcc/status/issue-*.json`
2. Read each file, filter to `complete` or `failed` status
3. For each, ask the user: "Issue #N (<status>, PR #X) — clean up? (y/n)"
4. If yes, follow the teardown for the `dispatch` method in the status file:

<details>
<summary><strong>cmux teardown</strong></summary>

   a. **Exit Claude session:**
      ```bash
      cmux send --surface <surface> "/exit\n"
      ```
      Poll `cmux read-screen --surface <surface>` for shell prompt, timeout 10s.

   b. **Close cmux workspace:**
      ```bash
      cmux close-workspace --workspace <session>
      ```
      Ignore errors if already closed.

</details>

<details>
<summary><strong>tmux teardown</strong></summary>

   a. **Exit Claude session:**
      ```bash
      tmux send-keys -t "<session>" "/exit" Enter
      ```
      Poll `tmux capture-pane -t "<session>" -p` for shell prompt, timeout 10s.

   b. **Kill tmux session:**
      ```bash
      tmux kill-session -t "<session>"
      ```
      Ignore errors if already closed.

</details>

<details>
<summary><strong>agent teardown</strong></summary>

   No terminal session to close. Worktree removed in next step.

</details>

Then regardless of dispatch method:

   c. **Remove worktree and its branch:**
      ```bash
      git worktree remove .claude/worktrees/<issue>-<slug>
      git branch -D worktree-<issue>-<slug>
      ```
      If uncommitted changes, prompt user before `--force`.

   d. **Delete status file:** `rm .olvrcc/status/issue-<n>.json`

5. If no completed/failed agents, print "Nothing to clean up"
