---
name: work
description: Orchestrate GitHub issue implementation via parallel agents and git worktrees. Supports subcommands - `/work <labels>` (terminal dispatch), `/work epic <number>` (autonomous subagent orchestration), `/work status` (check progress), `/work cleanup` (tear down). Use when user wants to batch-implement GitHub issues, orchestrate an epic, check agent status, or clean up completed worktrees.
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

Automate implementation of GitHub issues for the given label(s) or epic.

**Arguments:** `$ARGUMENTS` — GitHub labels, subcommand (`status`, `cleanup`), or `epic <number>`

## Mode Detection

Parse `$ARGUMENTS`:

- First arg is `status` → Status mode
- First arg is `cleanup` → Cleanup mode
- First arg is `epic` → Epic mode (autonomous subagent orchestration)
- Otherwise → Terminal mode (args are GitHub labels)

---

## Terminal Mode (`/work <labels>`)

Interactive dispatch — each agent runs in a visible terminal session you can attach to and interact with.

### Dispatch Method Detection

Detect the available terminal multiplexer:

```bash
command -v cmux && echo "cmux" || (command -v tmux && echo "tmux" || echo "none")
```

- **cmux** → preferred, richer UI
- **tmux** → fallback, widely available
- **none** → **stop immediately** and tell the user: "cmux or tmux is required for terminal mode. Install one, or use `/work epic <number>` for autonomous mode." Do not proceed.

Store the result as `$DISPATCH` for use in later steps.

### Step 1: Detect Project

Determine the GitHub repo from the current directory:

```bash
gh repo view --json nameWithOwner -q '.nameWithOwner'
```

Read CLAUDE.md or package.json to understand the project structure (monorepo layout, package manager, test commands).

### Step 2: Fetch Issues

If multiple labels are provided (space-separated), split them into separate `--label` flags:

```bash
gh issue list --label "<label>" --state open --json number,title,body,labels --limit 100
```

Parse the JSON output. Sort issues by number ascending.

### Step 3: Group by Phase

Group issues by their phase label. Phase labels follow the pattern `epic:<epic-name>:phase-N` (e.g., `epic:video-gen:phase-1`). Issues without a phase label go into an "unphased" group at the end.

Order phases numerically.

### Step 4: Find Current Batch

The current batch is the first phase that still has open issues.

**Look-ahead:** Check the next phase for issues that:

- Touch different workspace packages than current batch issues
- Have no explicit "blocked by" references to current batch issues
- Would not create merge conflicts (different directories/files)

Include safe candidates from the next phase.

### Step 5: Exclude Active Agents

Read all files matching `.olvrcc/status/issue-*.json`. Exclude any issue numbers that have `pending` or `in_progress` status from the current batch.

### Step 6: Determine Parallelism

Maximum 4-5 concurrent agents.

**Rules:**

- Issues modifying the same workspace package → **serial**
- Issues in different packages → **parallel candidate**
- If uncertain about overlap → **serial** (conservative default)

### Step 7: Create Status Files

For each issue in the batch:

```bash
mkdir -p .olvrcc/status
```

Write `.olvrcc/status/issue-<n>.json`:

```json
{
  "issue": <n>,
  "title": "<title>",
  "status": "pending",
  "branch": "worktree-<issue>-<slug>",
  "worktree": ".claude/worktrees/<issue>-<slug>",
  "dispatch": "<cmux|tmux>",
  "session": null
}
```

The `session` field stores the cmux workspace UUID or tmux session name, set during spawn.

### Step 8: Spawn Agents

For each issue, follow the dispatch method below:

<details>
<summary><strong>cmux dispatch</strong></summary>

1. **Create cmux workspace:**

   ```bash
   cmux --json new-workspace
   ```

   Parse the workspace UUID from JSON output.

2. **Get surface reference:**

   ```bash
   cmux --json list-pane-surfaces --workspace <uuid>
   ```

   Parse the surface ref (e.g., `surface:32`).

3. **Update status file** — set `session` to the workspace UUID. Also store the surface ref in the status file as `"surface": "<ref>"`.

4. **Send Claude command with worktree flag:**

   ```bash
   cmux send --surface <ref> "claude --worktree <issue>-<slug>\n"
   ```

5. **Wait for Claude to boot:** Poll with `cmux read-screen --surface <ref>` until the Claude prompt is visible. Timeout after 30 seconds.

6. **Send implement command:**

   ```bash
   cmux send --surface <ref> "/implement <issue-number>\n"
   ```

</details>

<details>
<summary><strong>tmux dispatch</strong></summary>

1. **Create tmux session:**

   ```bash
   tmux new-session -d -s "work-<issue>-<slug>"
   ```

2. **Update status file** — set `session` to `"work-<issue>-<slug>"`.

3. **Send Claude command with worktree flag:**

   ```bash
   tmux send-keys -t "work-<issue>-<slug>" "claude --worktree <issue>-<slug>" Enter
   ```

4. **Wait for Claude to boot:** Poll with `tmux capture-pane -t "work-<issue>-<slug>" -p` until the Claude prompt is visible. Timeout after 30 seconds.

5. **Send implement command:**

   ```bash
   tmux send-keys -t "work-<issue>-<slug>" "/implement <issue-number>" Enter
   ```

**User interaction:** The user can attach to any session with `tmux attach -t "work-<issue>-<slug>"` and detach with `Ctrl+B, D`.

</details>

### Step 9: Report

Print a summary table:

| Issue | Title | Branch | Session |
| ----- | ----- | ------ | ------- |
| #N    | Title | worktree-\<issue\>-\<slug\> | \<cmux surface or tmux session name\> |

If using tmux, also print: `Attach with: tmux attach -t "work-<issue>-<slug>"`

**Stop here.** The user monitors progress via `/work status` and cleans up via `/work cleanup`.

---

## Epic Mode (`/work epic <number>`)

Autonomous orchestration — spawns Claude subagents via the Agent tool, each in an isolated worktree. You cannot interact with agents mid-flight, but the orchestrator monitors, unblocks, and reviews automatically.

### Step 1: Fetch Epic & Child Issues

```bash
gh issue view <number> --json number,title,body,labels
gh issue list --label "epic:<slug>" --state open --json number,title,body,labels --limit 100
```

If the epic body contains a task list with issue references (`- [ ] #N`), also fetch those directly. Deduplicate.

### Step 2: Analyze Dependency Graph

For each child issue, determine:

1. **File scope** — which files/directories/packages it touches (from issue body, labels, or your codebase knowledge)
2. **Blocking dependencies** — explicit "blocked by #N" or "depends on #N" in issue body
3. **Implicit conflicts** — issues modifying the same files or packages

Build a dependency graph. Identify:
- **Independent sets** — groups of issues with no shared files or dependencies that can run in parallel
- **Serial chains** — issues that must complete in order
- **Conflict clusters** — issues touching the same files that need sequential handling

### Step 3: Plan Execution Order

Organize into waves:

- **Wave 1:** All issues with no dependencies and no file conflicts with each other
- **Wave 2:** Issues that depend on Wave 1, plus any independent issues that conflict with Wave 1
- **Wave N:** Continue until all issues are scheduled

Maximum 4-5 agents per wave.

Print the execution plan and ask the user to confirm before proceeding.

### Step 4: Execute Waves

For each wave, spawn all agents in parallel using the Agent tool with worktree isolation:

```
For each issue in the wave, call the Agent tool with:
  - description: "Implement issue #<n>"
  - isolation: "worktree"
  - prompt: (see below)
```

**Agent prompt template:**

```
You are implementing GitHub issue #<number> for the <repo> project.

Issue title: <title>
Issue body:
<body>

Follow the /implement skill workflow exactly:
1. Detect project conventions (read CLAUDE.md, detect package manager)
2. Create status file at <repo-root>/.olvrcc/status/issue-<n>.json with status "in_progress"
3. Gather context — read the issue, related code, and any plan files
4. Implement using TDD (red-green-refactor) with atomic conventional commits
5. Run full verification (test, typecheck, lint)
6. Push branch and create PR via `gh pr create`
7. Update status file to "complete" with PR URL
8. Comment on the issue with the PR link

Branch name: <issue>-<slug>
Status file: <repo-root>/.olvrcc/status/issue-<n>.json

If blocked after two attempts, push current state, update status to "failed" with blocker description, and comment on the issue.
```

Launch all agents in a single message (parallel tool calls). Do NOT wait for one to finish before starting the next within the same wave.

### Step 5: Monitor Wave Completion

After spawning a wave, wait for all agents to return. As each completes:

1. Read its status file to confirm outcome
2. If any agent returned changes in a worktree branch, note the branch name and PR URL

When all agents in a wave complete:

1. **Check for failures** — if any agent failed, read the blocker and attempt to diagnose:
   - Can you unblock it by merging a completed PR first? Do so, then re-spawn.
   - Is it a genuine blocker? Note it for the final report and move on.

2. **Cross-cutting review** — check for conflicts between the wave's PRs:
   ```bash
   # For each pair of branches in this wave
   git diff <branch-a>...<branch-b> -- <shared-paths>
   ```
   If conflicts exist, flag them in the final report.

3. Proceed to the next wave.

### Step 6: Final Status Report

After all waves complete, produce a report:

```
## Epic #<number> — Orchestration Report

### Summary
- Total issues: N
- Completed: N (PRs created)
- Failed/Blocked: N

### PRs Created
| Issue | Title | PR | CI Status |
|-------|-------|----|-----------|
| #N    | Title | PR #M | passing/failing |

### Blocked Issues
| Issue | Title | Blocker |
|-------|-------|---------|
| #N    | Title | Description |

### Cross-Cutting Concerns
- [any file conflicts between PRs]
- [any shared dependency issues]

### Recommended Next Steps
- [merge order if PRs have dependencies]
- [manual fixes needed for blocked issues]
```

Check CI status for each PR:
```bash
gh pr checks <pr-number>
```

---

## Status Mode (`/work status`)

1. Glob for `.olvrcc/status/issue-*.json`
2. Read each file, parse JSON
3. Print summary table:

| Issue | Title | Status      | Branch      | Dispatch | Session | PR     |
| ----- | ----- | ----------- | ----------- | -------- | ------- | ------ |
| #N    | Title | in_progress | branch-name | tmux     | session | —      |
| #M    | Title | complete    | branch-name | agent    | —       | PR #42 |

4. If no status files exist, print "No active agents"

---

## Cleanup Mode (`/work cleanup`)

1. Glob for `.olvrcc/status/issue-*.json`
2. Read each file, filter to `complete` or `failed` status
3. For each, ask the user: "Issue #N (<status>, PR #X) — clean up? (y/n)"
4. If yes, follow the teardown for the `dispatch` method stored in the status file:

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

   No terminal session to close. If the agent worktree still exists (changes were made), it will be removed in the next step.

</details>

Then regardless of dispatch method:

   c. **Remove worktree and its branch:**
      ```bash
      git worktree remove .claude/worktrees/<issue>-<slug>
      git branch -D worktree-<issue>-<slug>
      ```
      If the worktree has uncommitted changes, prompt the user before force-removing with `--force`.

   d. **Delete status file:** `rm .olvrcc/status/issue-<n>.json`

5. If no completed/failed agents, print "Nothing to clean up"
