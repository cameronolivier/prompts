---
name: work
description: Orchestrate GitHub issue implementation via parallel agents and git worktrees. Use when the user says "work on these issues in parallel", "implement this epic", "dispatch issues labelled X", "check work status" (/work status), "clean up completed agents" (/work cleanup), or invokes /work <labels>, /work epic <number>. Auto-detects cmux/tmux for interactive grid layouts; falls back to autonomous subagents.
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - Agent
  - Bash(gh issue list:*)
  - Bash(gh issue view:*)
  - Bash(gh issue comment:*)
  - Bash(gh pr:*)
  - Bash(gh repo view:*)
  - Bash(git worktree:*)
  - Bash(git branch:*)
  - Bash(git diff:*)
  - Bash(git log:*)
  - Bash(cmux:*)
  - Bash(tmux:*)
  - Bash(mkdir:*)
  - Bash(cp:*)
  - Bash(rm:*)
  - Bash(grep:*)
  - Bash(echo:*)
---

Orchestrate implementation of GitHub issues in parallel using git worktrees.

**Arguments:** `$ARGUMENTS` — GitHub labels, `epic <number>`, `status`, or `cleanup`.

Composes with: `/implement` (per-issue agent), `work/scripts/work-launch.sh` (surface management).

## Workflow index

1. [Mode detection](#mode-detection)
2. [Phase 1: Detect project](#phase-1-detect-project)
3. [Phase 2: Fetch issues](#phase-2-fetch-issues)
4. [Phase 3: Analyze dependency graph](#phase-3-analyze-dependency-graph)
5. [Phase 4: Plan execution waves](#phase-4-plan-execution-waves)
6. [Phase 5: Detect dispatch method](#phase-5-detect-dispatch-method)
7. [Phase 6: Execute waves](#phase-6-execute-waves)
8. [Phase 7: Final report](#phase-7-final-report)

## References

- `references/dispatch-methods.md` — cmux / tmux / agent internals; surface and teardown details. Load when executing Phase 5 or Phase 6c.
- `references/status-mode.md` — `/work status` flow. Load only when `$ARGUMENTS` begins with `status`.
- `references/cleanup-mode.md` — `/work cleanup` flow. Load only when `$ARGUMENTS` begins with `cleanup`.

## Status model

```
pending → in_progress → agent_complete → in_review → complete
                    ↘ failed
```

| Status | Set by | Trigger |
|--------|--------|---------|
| `pending`        | `/work`            | Worktree created, agent not yet started |
| `in_progress`    | `/implement`       | Agent begins work |
| `agent_complete` | `/implement`       | Draft PR created, all checks pass |
| `in_review`      | human / orchestrator | PR taken out of draft |
| `complete`       | human / orchestrator | PR merged |
| `failed`         | `/implement`       | Blocker after 2 attempts |

Status files live at `.olvrcc/status/issue-<n>.json`.

---

## Mode detection

Parse `$ARGUMENTS`:

- `status` → load `references/status-mode.md` and follow it.
- `cleanup` → load `references/cleanup-mode.md` and follow it.
- `epic <number>` → epic mode (fetch issues from the epic body + matching `epic:<slug>` label).
- Anything else → treat arguments as GitHub labels.

## Phase 1: Detect project

```bash
gh repo view --json nameWithOwner -q '.nameWithOwner'
```

Read `CLAUDE.md` or `package.json` to understand monorepo layout, package manager, and test commands.

## Phase 2: Fetch issues

**Label mode:**

```bash
gh issue list --label "<label>" --state open \
  --json number,title,body,labels --limit 100
```

**Epic mode:**

```bash
gh issue view <number> --json number,title,body,labels
gh issue list --label "epic:<slug>" --state open \
  --json number,title,body,labels --limit 100
```

If the epic body contains `- [ ] #N` task references, fetch those too. Deduplicate. Sort ascending by issue number.

## Phase 3: Analyze dependency graph

For each issue determine:

1. **File scope** — files / directories / packages touched (from body, labels, codebase knowledge).
2. **Blocking dependencies** — explicit `blocked by #N` / `depends on #N` in the body.
3. **Implicit conflicts** — issues mutating the same files or packages.

Build the graph. Identify:

- **Independent sets** — no shared files, no deps → parallel candidates.
- **Serial chains** — must complete in order.
- **Conflict clusters** — touch shared files → sequential.

## Phase 4: Plan execution waves

Group into waves:

- **Wave 1** — issues with no deps and no file conflicts with each other.
- **Wave 2** — issues dependent on wave 1, plus independent issues that conflicted with wave 1.
- **Wave N** — continue until all issues scheduled.

Cap each wave at 4–5 agents.

### Exclude active agents

Read every `.olvrcc/status/issue-*.json`. Exclude issues with status `pending`, `in_progress`, or `agent_complete`.

### Present the plan

```
Wave 1 (parallel):
  #12 - Add auth middleware (packages/api)
  #14 - Add user avatar component (packages/ui)

Wave 2 (after wave 1):
  #15 - Add auth to API routes — depends on #12
  #16 - Add avatar to profile page — depends on #14

Wave 3:
  #18 - E2E tests for auth flow — depends on #12, #15
```

Confirm with the user before proceeding.

## Phase 5: Detect dispatch method

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

- **cmux** — new workspace with grid layout (preferred). See `references/dispatch-methods.md#cmux-dispatch`.
- **tmux** — new window with tiled grid in the current session. See `references/dispatch-methods.md#tmux-dispatch`.
- **tmux-outside** — tmux installed but the user is not inside it. Prompt to bootstrap a `work` session; details in `references/dispatch-methods.md#tmux-outside-bootstrap`. After bootstrap, stop — the bootstrapped session handles the rest.
- **agent** — autonomous subagents via the `Agent` tool. Warn: "No cmux/tmux found — agents run non-interactively." See `references/dispatch-methods.md#agent-dispatch`.

Store as `$DISPATCH`. Tell the user which was detected.

### Ensure `.olvrcc/` is gitignored

```bash
grep -qx '.olvrcc/' .gitignore 2>/dev/null || echo '.olvrcc/' >> .gitignore
```

## Phase 6: Execute waves

For each wave:

### 6a. Create worktrees

```bash
mkdir -p .claude/worktrees
git worktree add .claude/worktrees/<issue>-<slug> -b <issue>-<slug>
```

Resuming an existing branch:

```bash
git worktree add .claude/worktrees/<issue>-<slug> <issue>-<slug>
```

If `.worktreeinclude` exists in the repo root, copy matching gitignored files into the worktree.

### 6b. Create status files

```bash
mkdir -p .olvrcc/status
```

Write `.olvrcc/status/issue-<n>.json`:

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

### 6c. Spawn agents

Resolve the launch script:

```bash
SCRIPT_DIR=""
for dir in \
  "$HOME/.claude/skills/work/scripts" \
  "$(pwd)/skills/work/scripts"; do
  [ -f "$dir/work-launch.sh" ] && SCRIPT_DIR="$dir" && break
done
```

If `work-launch.sh` is missing, stop and tell the user: "Launch script not found. Run `install.sh -s work` from the prompts repo to install it."

Spawn agents per the selected dispatch — full per-mode steps (grid creation, per-surface launch, status-file `surface` field updates) are in `references/dispatch-methods.md`.

Every agent runs the `/implement` skill, which internally runs the simplify / audit-tests / review QA loops (see `skills/implement/SKILL.md`).

### 6d. Report the launch

| Issue | Title | Branch | Surface |
| ----- | ----- | ------ | ------- |
| #N    | Title | `<issue>-<slug>` | `<surface-ref>` |

For tmux, remind the user: `Ctrl+B, q` shows pane numbers; `Ctrl+B, o` cycles.

### 6e. Monitor wave completion

**Interactive dispatch (cmux / tmux).** Stop after launching. The user monitors via `/work status` and tears down via `/work cleanup`. When ready, the next `/work <labels>` or `/work epic <number>` skips already-in-flight issues automatically via status files.

**Agent dispatch.** Await all Agent returns, then:

1. Read each status file. For `failed`:
   - Ask before merging any predecessor PR.
   - Re-spawn if approved.
   - Note genuine blockers for the final report.
   - **Never auto-merge PRs.**
2. Cross-cutting review for shared paths:

   ```bash
   git diff <branch-a>...<branch-b> -- <shared-paths>
   ```

3. Proceed to the next wave.

## Phase 7: Final report

```
## Orchestration Report

### Summary
- Total issues: N
- Dispatched: N
- Completed: N
- Failed/Blocked: N
- Remaining waves: N

### PRs Created
| Issue | Title | PR    | CI              |
|-------|-------|-------|-----------------|
| #N    | Title | PR #M | passing/failing |

### Blocked Issues
| Issue | Title | Blocker     |
|-------|-------|-------------|
| #N    | Title | Description |

### Cross-Cutting Concerns
- <file conflicts between PRs>
- <shared dependency issues>

### Next Steps
- <merge order if PRs have dependencies>
- <manual fixes for blocked issues>
- <remaining waves to dispatch>
```

CI status:

```bash
gh pr checks <pr-number>
```
