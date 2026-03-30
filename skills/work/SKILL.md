---
name: work
description: Orchestrate GitHub issue implementation via parallel terminal sessions and git worktrees. Supports subcommands - `/work <labels>` (orchestrate), `/work status` (check progress), `/work cleanup` (tear down). Use when user wants to batch-implement GitHub issues, check agent status, or clean up completed worktrees.
allowed-tools:
  - Read
  - Write
  - Bash
  - Bash(gh issue list *)
  - Bash(gh issue view *)
  - Bash(cmux *)
  - Bash(tmux *)
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

## Dispatch Method Detection

Before spawning agents, detect the available terminal multiplexer:

```bash
command -v cmux && echo "cmux" || (command -v tmux && echo "tmux" || echo "none")
```

- **cmux** → preferred, richer UI
- **tmux** → fallback, widely available
- **none** → **stop immediately** and tell the user: "cmux or tmux is required to run /work. Install one and try again." Do not proceed.

Store the result as `$DISPATCH` for use in later steps.

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

## Status Mode (`/work status`)

1. Glob for `.olvrcc/status/issue-*.json`
2. Read each file, parse JSON
3. Print summary table:

| Issue | Title | Status      | Branch      | Session | PR     |
| ----- | ----- | ----------- | ----------- | ------- | ------ |
| #N    | Title | in_progress | branch-name | session | —      |
| #M    | Title | complete    | branch-name | session | PR #42 |

4. If no status files exist, print "No active agents"

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

Then regardless of dispatch method:

   c. **Remove worktree and its branch:**
      ```bash
      git worktree remove .claude/worktrees/<issue>-<slug>
      git branch -D worktree-<issue>-<slug>
      ```
      If the worktree has uncommitted changes, prompt the user before force-removing with `--force`.

   d. **Delete status file:** `rm .olvrcc/status/issue-<n>.json`

5. If no completed/failed agents, print "Nothing to clean up"
