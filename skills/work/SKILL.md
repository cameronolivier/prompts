---
name: work
description: Orchestrate GitHub issue implementation via cmux tabs and Claude's built-in git worktrees. Supports subcommands - `/work <labels>` (orchestrate), `/work status` (check progress), `/work cleanup` (tear down). Use when user wants to batch-implement GitHub issues, check agent status, or clean up completed worktrees.
allowed-tools:
  - Read
  - Write
  - Bash
  - Bash(gh issue list *)
  - Bash(gh issue view *)
  - Bash(cmux *)
  - Bash(git worktree *)
  - Bash(git branch *)
  - Grep
  - Glob
---

Automate implementation of GitHub issues for the given label(s).

**Arguments:** `$ARGUMENTS` — GitHub labels OR subcommand (`status`, `cleanup`)

## Mode Detection

Parse `$ARGUMENTS`:

- First arg is `status` → Status mode
- First arg is `cleanup` → Cleanup mode
- Otherwise → Orchestrate mode (args are GitHub labels)

## Orchestrate Mode (`/work <labels>`)

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

Read all files matching `.claude/worktrees/status/issue-*.json`. Exclude any issue numbers that have `pending` or `in_progress` status from the current batch.

### Step 6: Determine Parallelism

Maximum 4-5 concurrent agents.

**Rules:**

- Issues modifying the same workspace package → **serial**
- Issues in different packages → **parallel candidate**
- If uncertain about overlap → **serial** (conservative default)

### Step 7: Spawn Agents

For each issue in the batch:

1. **Create status directory and file:**

   ```bash
   mkdir -p .claude/worktrees/status
   ```

   Write `.claude/worktrees/status/issue-<n>.json`:

   ```json
   {
     "issue": <n>,
     "title": "<title>",
     "status": "pending",
     "branch": "worktree-<issue>-<slug>",
     "worktree": ".claude/worktrees/<issue>-<slug>",
     "cmuxWorkspace": null,
     "cmuxSurface": null
   }
   ```

2. **Create cmux workspace:**

   ```bash
   cmux --json new-workspace
   ```

   Parse the workspace UUID from JSON output.

3. **Get surface reference:**

   ```bash
   cmux --json list-pane-surfaces --workspace <uuid>
   ```

   Parse the surface ref (e.g., `surface:32`).

4. **Update status file** with `cmuxWorkspace` and `cmuxSurface` values.

5. **Send Claude command with worktree flag:**

   Claude's built-in `--worktree` (`-w`) flag creates an isolated worktree at `.claude/worktrees/<name>` and branches from `origin/HEAD`:

   ```bash
   cmux send --surface <ref> "claude --worktree <issue>-<slug>\n"
   ```

6. **Wait for Claude to boot:** Poll with `cmux read-screen --surface <ref>` until the Claude prompt is visible. Timeout after 30 seconds.

7. **Send implement command:**
   ```bash
   cmux send --surface <ref> "/implement <issue-number>\n"
   ```

### Step 8: Report

Print a summary table:

| Issue | Title | Branch | cmux Surface |
| ----- | ----- | ------ | ------------ |
| #N    | Title | worktree-\<issue\>-\<slug\> | surface:N |

**Stop here.** The user monitors progress via `/work status` and cleans up via `/work cleanup`.

## Status Mode (`/work status`)

1. Glob for `.claude/worktrees/status/issue-*.json`
2. Read each file, parse JSON
3. Print summary table:

| Issue | Title | Status      | Branch      | PR     |
| ----- | ----- | ----------- | ----------- | ------ |
| #N    | Title | in_progress | branch-name | —      |
| #M    | Title | complete    | branch-name | PR #42 |

4. If no status files exist, print "No active agents"

## Cleanup Mode (`/work cleanup`)

1. Glob for `.claude/worktrees/status/issue-*.json`
2. Read each file, filter to `complete` or `failed` status
3. For each, ask the user: "Issue #N (<status>, PR #X) — clean up? (y/n)"
4. If yes:
   a. Close cmux workspace: `cmux close-workspace --workspace <uuid>` (ignore errors if workspace already closed)
   b. Remove worktree and its branch:
      ```bash
      git worktree remove .claude/worktrees/<issue>-<slug>
      git branch -D worktree-<issue>-<slug>
      ```
      If the worktree has uncommitted changes, prompt the user before force-removing with `--force`.
   c. Delete status file: `rm .claude/worktrees/status/issue-<n>.json`
5. If no completed/failed agents, print "Nothing to clean up"
