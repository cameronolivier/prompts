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

## Status Model

```
pending → in_progress → agent_complete → in_review → complete
                    ↘ failed
```

| Status | Set by | Trigger |
|--------|--------|---------|
| `pending` | `/work` orchestrator | Worktree created, agent not yet started |
| `in_progress` | `/implement` agent | Agent begins work |
| `agent_complete` | `/implement` agent | Draft PR created, all checks pass |
| `in_review` | Human / orchestrator | PR taken out of draft |
| `complete` | Human / orchestrator | PR merged |
| `failed` | `/implement` agent | Blocker after 2 attempts |

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

Read all files matching `.olvrcc/status/issue-*.json`. Exclude any issue numbers with `pending`, `in_progress`, or `agent_complete` status.

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
if [ -n "${CMUX_WORKSPACE_ID:-}" ] || (command -v cmux >/dev/null && cmux ping >/dev/null 2>&1); then
  echo "cmux"
elif [ -n "${TMUX:-}" ]; then
  echo "tmux"
elif command -v tmux >/dev/null; then
  echo "tmux-outside"
else
  echo "agent"
fi
```

- **cmux** → grid workspace via cmux socket (preferred)
- **tmux** → grid window in current session (inside tmux)
- **tmux-outside** → tmux is installed but user is NOT inside a tmux session. **Ask the user:**

  > You're not in a tmux session. Would you like me to create one and kick off the work there? You'll just need to `tmux attach -t work` in a terminal to watch the grid.

  If the user says yes, bootstrap a tmux session via the launch script:

  ```bash
  "$SCRIPT_DIR/work-launch.sh" bootstrap "$(pwd)" "<original-args>"
  ```

  This creates a detached tmux session `work`, boots claude inside it, and sends `/work <args>`. The new claude instance detects `$TMUX`, resolves to `tmux` dispatch, and proceeds with grid creation automatically.

  Print:

  > Agents are spinning up in tmux session `work`. Open a terminal and run:
  > ```
  > tmux attach -t work
  > ```
  > to see the grid.

  **Stop here.** The bootstrapped session handles everything from here.

- **agent** → autonomous subagents via Agent tool (no terminal multiplexer available)

Tell the user which dispatch method was detected. If `agent` mode, warn: "No cmux/tmux found — using autonomous subagents. You won't be able to interact with agents mid-flight."

Store as `$DISPATCH`.

### Ensure .olvrcc is gitignored

On first run, ensure `.olvrcc/` is in the project's `.gitignore`:

```bash
if ! grep -qx '.olvrcc/' .gitignore 2>/dev/null; then
  echo '.olvrcc/' >> .gitignore
fi
```

## Phase 6: Execute Waves

For each wave:

### 6a. Create Worktrees

For each issue, create a worktree manually (gives us clean branch names without the `worktree-` prefix):

```bash
mkdir -p .claude/worktrees
git worktree add .claude/worktrees/<issue>-<slug> -b <issue>-<slug>
```

If the branch already exists (resuming):
```bash
git worktree add .claude/worktrees/<issue>-<slug> <issue>-<slug>
```

**Copy gitignored files:** If a `.worktreeinclude` file exists in the repo root, copy matching gitignored files into the worktree (e.g., `.env`, `.env.local`):
```bash
if [ -f .worktreeinclude ]; then
  while IFS= read -r pattern; do
    for f in $pattern; do
      [ -f "$f" ] && cp "$f" ".claude/worktrees/<issue>-<slug>/$f"
    done
  done < .worktreeinclude
fi
```

### 6b. Create Status Files

```bash
mkdir -p .olvrcc/status
```

Write `.olvrcc/status/issue-<n>.json` for each issue:

```json
{
  "issue": <n>,
  "title": "<title>",
  "status": "pending",
  "branch": "<issue>-<slug>",
  "worktree": ".claude/worktrees/<issue>-<slug>",
  "dispatch": "<cmux|tmux|agent>",
  "wave": <wave-number>,
  "surface": null
}
```

### 6c. Spawn Agents

Launch all agents in the current wave in parallel, using the detected dispatch method.

**Locate the launch script:**

```bash
SCRIPT_DIR="$(dirname "$(readlink -f "$(which claude 2>/dev/null || echo claude)")")/../skills/work/scripts"
# Fallback paths
for dir in \
  "$(pwd)/skills/work/scripts" \
  "$HOME/.claude/skills/work/scripts"; do
  [ -f "$dir/work-launch.sh" ] && SCRIPT_DIR="$dir" && break
done
```

<details>
<summary><strong>cmux dispatch — new workspace with grid layout</strong></summary>

The orchestrator stays in its current workspace. Agents get a **new workspace** with a grid layout (2x2, 2x3, 2x4 depending on wave size).

1. **Create grid workspace:**
   ```bash
   SURFACES=$(DISPATCH=cmux "$SCRIPT_DIR/work-launch.sh" grid <wave-size>)
   ```
   Returns one surface ID per line. Grid dimensions are auto-calculated:
   - 1–2 issues → 1×2
   - 3–4 issues → 2×2
   - 5–6 issues → 2×3
   - 7–8 issues → 2×4

2. **Launch agents in each surface:**
   Read surface IDs line-by-line. For each issue+surface pair:
   ```bash
   DISPATCH=cmux "$SCRIPT_DIR/work-launch.sh" launch \
     --surface <surface-id> \
     --issue <n> \
     --worktree "$(pwd)/.claude/worktrees/<issue>-<slug>"
   ```

3. **Update status file** — set `"surface": "<surface-id>"`.

After all agents launch, the user can switch to the agent workspace to see the grid. Click any pane to interact.

</details>

<details>
<summary><strong>tmux dispatch — new window with tiled grid</strong></summary>

By Phase 5, we're guaranteed to be **inside tmux**. Grid appears as a new window in the current session.

1. **Create grid window:**
   ```bash
   PANES=$(DISPATCH=tmux TMUX_SESSION="$(tmux display-message -p '#S')" \
     "$SCRIPT_DIR/work-launch.sh" grid <wave-size>)
   ```
   Returns one pane ID per line. tmux auto-rebalances to a `tiled` layout.

2. **Launch agents in each pane:**
   Read pane IDs line-by-line. For each issue+pane pair:
   ```bash
   DISPATCH=tmux TMUX_SESSION="$(tmux display-message -p '#S')" \
     "$SCRIPT_DIR/work-launch.sh" launch \
     --surface <pane-id> \
     --issue <n> \
     --worktree "$(pwd)/.claude/worktrees/<issue>-<slug>"
   ```

3. **Update status file** — set `"surface": "<pane-id>"`.

**Interacting with agents:** `Ctrl+B, q` to show pane numbers, `Ctrl+B, <number>` to select. Or `Ctrl+B, o` to cycle.

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
    6. Push branch and create draft PR via `gh pr create --draft`
    7. Update status file to "agent_complete" with PR URL
    8. Comment on the issue with the PR link
    9. Only set status to "complete" after PR is merged (not when opened)

    Branch name: <issue>-<slug>
    Status file: <repo-root>/.olvrcc/status/issue-<n>.json

    If blocked after two attempts, push current state, update status to "failed" with blocker description, and comment on the issue.
```

Launch all agents in a single message (parallel tool calls).

</details>

### 6d. Report Wave Launch

Print summary table:

| Issue | Title | Branch | Pane |
| ----- | ----- | ------ | ---- |
| #N    | Title | \<issue\>-\<slug\> | \<surface/pane ref\> |

For tmux: remind the user `Ctrl+B, q` shows pane numbers, `Ctrl+B, o` cycles panes.

### 6e. Monitor Wave Completion

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
3. For interactive dispatch, check if surface/pane still exists:
   ```bash
   DISPATCH=<dispatch> "$SCRIPT_DIR/work-launch.sh" status <surface>
   ```
   Returns `exists` or `closed`.
4. Print summary table:

| Issue | Title | Status | Wave | Branch | Pane | PR |
| ----- | ----- | ------ | ---- | ------ | ---- | -- |
| #N    | Title | in_progress | 1 | branch-name | surface-id | — |
| #M    | Title | agent_complete | 1 | branch-name | surface-id | PR #42 (draft) |

5. If no status files exist, print "No active agents"

---

## Cleanup Mode (`/work cleanup`)

1. Glob for `.olvrcc/status/issue-*.json`
2. Read each file, filter to `agent_complete`, `complete`, or `failed` status
3. For each, ask the user: "Issue #N (<status>, PR #X) — clean up? (y/n)"
4. If yes, follow the teardown for the `dispatch` method in the status file:

<details>
<summary><strong>cmux teardown</strong></summary>

   Close the pane via the launch script:
   ```bash
   DISPATCH=cmux "$SCRIPT_DIR/work-launch.sh" close <surface>
   ```

</details>

<details>
<summary><strong>tmux teardown</strong></summary>

   Close the pane via the launch script:
   ```bash
   DISPATCH=tmux "$SCRIPT_DIR/work-launch.sh" close <pane-id>
   ```

</details>

<details>
<summary><strong>agent teardown</strong></summary>

   No terminal session to close. Worktree removed in next step.

</details>

Then regardless of dispatch method:

   c. **Remove worktree and its branch:**
      ```bash
      git worktree remove .claude/worktrees/<issue>-<slug>
      git branch -D <issue>-<slug>
      ```
      If uncommitted changes, prompt user before `--force`.

   d. **Delete status file:** `rm .olvrcc/status/issue-<n>.json`

5. If no completed/failed agents, print "Nothing to clean up"

### Manual Pane Cleanup

The user can also request cleanup of a specific pane at any time:

> "Close the pane for issue #12"

Use the launch script to close just that pane without removing the worktree or status file. This lets the user continue working on the issue from the orchestrator pane (which is in the main repo, not a worktree).
