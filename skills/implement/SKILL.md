---
name: implement
description: Implement a single GitHub issue end-to-end using TDD in an isolated worktree. Use when the user asks to "implement issue #N", "work on issue #N", "pick up issue #N", "resume issue #N", or when dispatched by /work. Handles worktree setup, TDD loop, simplify / audit-tests / review QA loops via fresh dispatched subagents, ADR generation, draft PR, and post-PR review.
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Skill
  - Agent
  - EnterWorktree
  - ExitWorktree
  - Bash(gh issue view:*)
  - Bash(gh issue comment:*)
  - Bash(gh pr:*)
  - Bash(gh repo view:*)
  - Bash(gh api:*)
  - Bash(gh run:*)
  - Bash(git worktree:*)
  - Bash(git branch:*)
  - Bash(git diff:*)
  - Bash(git log:*)
  - Bash(git rev-parse:*)
  - Bash(git push:*)
  - Bash(git add:*)
  - Bash(git commit:*)
  - Bash(git status:*)
  - Bash(mkdir:*)
  - Bash(cp:*)
  - Bash(cat:*)
  - Bash(cmux:*)
---

Implement a single GitHub issue end-to-end using TDD in an isolated worktree.

> **Recommended model: Sonnet** for the orchestrator body — it sequences phases and runs TDD. Opus is overkill here because the deep-judgment work is delegated to QA-loop workers (steps 6/7/12) which set their own per-step models. Haiku is too thin for TDD and architecture decisions.

**Arguments:** `$ARGUMENTS` — issue number (e.g. `/implement 12`)

Composes with: `/tdd`, `/simplify`, `/audit-tests`, `/pr-review`, `/create-pr`, `/security-review`, `/handle-pr-feedback`.

## Workflow index

1. [Project detection](#1-project-detection)
2. [Status file](#2-status-file)
3. [Setup worktree](#3-setup-worktree)
4. [Gather context & plan](#4-gather-context--plan)
5. [Implement with TDD](#5-implement-with-tdd)
6. [QA loop: simplify](#6-qa-loop-simplify)
7. [QA loop: audit tests](#7-qa-loop-audit-tests)
8. [ADR check](#8-adr-check)
9. [Verify](#9-verify)
10. [Pre-push review](#10-pre-push-review)
11. [Push & create draft PR](#11-push--create-draft-pr)
12. [QA loop: post-PR review](#12-qa-loop-post-pr-review)
13. [Agent complete](#13-agent-complete)

> Extended post-PR flow (security review, CI watch, CodeRabbit responses) lives in `references/post-pr-review.md`. Load when step 12 surfaces non-trivial review work.

## Status lifecycle

`pending` → `in_progress` → `agent_complete` → `in_review` → `complete` (or `failed`).

Update the status file at each transition. The file is created by `/work` with `pending`. For standalone runs, create it in step 2.

## QA loop pattern

Steps 6, 7, and 12 all follow the same two-level dispatch pattern so every iteration gets a truly fresh review with no carry-over from prior passes.

- **Level 1 — orchestrator.** One `Agent` call from this workflow. Its job is to loop and dispatch, not to review.
- **Level 2 — iteration worker.** The orchestrator dispatches a brand-new `Agent` call per iteration. Each worker has zero context from prior iterations and reviews from scratch.

The full template — orchestrator prompt, worker contract, termination rules, per-step substitutions — lives in `references/qa-loop-prompt.md`. Steps 6, 7, and 12 reference it instead of re-stating the prompt.

---

## 1. Project detection

Run the bundled script — emits a JSON snapshot of repo type, package manager, monorepo tool, and verification commands so the model doesn't re-probe the filesystem on every invocation:

```bash
./scripts/detect-project.sh --pretty
# or single fields:
./scripts/detect-project.sh --field test       # → "pnpm test" / "cargo test" / etc.
./scripts/detect-project.sh --field root       # → main repo root (handles worktrees)
```

Then read `CLAUDE.md` for any project-specific conventions the script can't infer (preferred test patterns, naming, no-mock rules, etc.).

## 2. Status file

Resolve the main repo root via `./scripts/detect-project.sh --field root`.

Status file path: `<main-repo-root>/.olvrcc/status/issue-<n>.json`.

If the file exists, transition it to `in_progress`. If it does not (standalone run), create `.olvrcc/status/` and write the file with `pending` first, then transition.

## 3. Setup worktree

Resolve the run context:

```bash
git rev-parse --show-toplevel
git worktree list --porcelain
```

Inside `.claude/worktrees/`: dispatched by `/work` — skip worktree creation.

Inside the main repo (standalone):

```bash
mkdir -p .claude/worktrees
git worktree add .claude/worktrees/<issue>-<slug> -b <issue>-<slug>
cd .claude/worktrees/<issue>-<slug>
```

If `.worktreeinclude` exists in the repo root, copy matching gitignored files (e.g. `.env`, `.env.local`) into the worktree.

Detect whether this is a resume:

```bash
git branch -a | grep -E "(^|/)(<issue>)-"
```

On resume: run the project's tests, read `git log --oneline -10`, continue from current state.

Fetch full issue context:

```bash
gh issue view <number> --json number,title,body,labels
```

## 4. Gather context & plan

- Read the issue body thoroughly — capture every acceptance criterion and edge case.
- Locate relevant plan files (`docs/`, `plans/`, `PLAN-*.md`).
- Read existing code in the areas to modify.
- Identify which workspace package(s) the issue touches.
- Draft a brief implementation plan — this becomes the PR description in step 11.

## 5. Implement with TDD

**Non-negotiable: every behavior change starts with a failing test.**

Invoke the `/tdd` skill.

Work vertical slice by vertical slice. For each acceptance criterion:

1. **Red** — write a failing test that describes the expected behaviour.
2. Run the test; confirm it fails.
3. **Green** — minimal code to make it pass.
4. Run the test; confirm it passes.
5. **Refactor** — only while tests are green.
6. **Commit** — atomic conventional commit. Never `--no-verify`.

```bash
git add <specific-files>
git commit -m "<type>(scope): <description>"
```

## 6. QA loop: simplify

Dispatch a simplify orchestrator using the template in `references/qa-loop-prompt.md` with these substitutions:

| Field | Value |
|---|---|
| `<DESC>` | `Simplify QA loop orchestrator` |
| `<SKILL>` | `/simplify` |
| `<TARGET>` | `branch <branch-name>` |
| `<COMMIT_RULE>` | `Commit any fixes as atomic conventional commits. Do not push.` |
| `<EXTRA>` | (none) |
| `<ORCH_MODEL>` | `haiku` |
| `<WORKER_MODEL>` | `sonnet` |

## 7. QA loop: audit tests

Dispatch an audit-tests orchestrator using the same template:

| Field | Value |
|---|---|
| `<DESC>` | `Audit-tests QA loop orchestrator` |
| `<SKILL>` | `/audit-tests` |
| `<TARGET>` | `branch <branch-name> vs main` |
| `<COMMIT_RULE>` | `Implement and commit fixes for priority-1 findings only. Do not push.` |
| `<EXTRA>` | `Treat every finding as newly discovered.` |
| `<ORCH_MODEL>` | `haiku` |
| `<WORKER_MODEL>` | `sonnet` |

## 8. ADR check

Assess whether the implementation introduced any architectural decision:

- New dependency.
- New pattern.
- Infrastructure choice.
- Significant trade-off.

If yes, write an ADR in `docs/decisions/` (or the project's ADR directory) matching existing naming conventions. Include context, decision, and consequences.

## 9. Verify

Run the full verification suite using the commands from step 1's `detect-project.sh` output:

```bash
$(./scripts/detect-project.sh --field test)
$(./scripts/detect-project.sh --field typecheck)
$(./scripts/detect-project.sh --field lint)
```

Skip any field that returned empty — the project doesn't define it. Fix-and-rerun until all pass.

## 10. Pre-push review

Review the branch against main before pushing. For each changed file:

1. **Type safety** — no `any` escapes, correct generics, proper nullability.
2. **Imports** — all resolve, no unused, no circular deps.
3. **Dead code** — no unreachable code, no unused variables, no commented-out blocks.
4. **Test coverage** — every changed code path has a corresponding test.

Fix, commit, re-run verification.

## 11. Push & create draft PR

Confirm the branch:

```bash
git branch --show-current   # must match <issue>-<slug>
```

If the branch name is wrong, stop and report failure.

```bash
git push -u origin <branch-name>
```

Invoke `/create-pr` with `--draft`, or fall back to `gh`:

```bash
gh pr create --draft --title "<issue>-<slug>: <title>" --body "<implementation plan>"
```

Capture the PR number and URL — steps 12 and 13 need them.

## 12. QA loop: post-PR review

Dispatch a pr-review orchestrator using the same template. This step is the strongest case for fresh-per-iteration context — review work is substantive, and the risk of a single subagent "remembering" prior findings and short-cutting the next pass is highest here.

| Field | Value |
|---|---|
| `<DESC>` | `PR review QA loop orchestrator` |
| `<SKILL>` | `/pr-review` |
| `<TARGET>` | `PR #<pr-number>` |
| `<COMMIT_RULE>` | `Commit fixes as atomic conventional commits and push.` |
| `<EXTRA>` | `Read the PR end-to-end and form independent principal-engineer judgements.` |
| `<ORCH_MODEL>` | `haiku` |
| `<WORKER_MODEL>` | `opus` |

For security review, CI watch, and CodeRabbit responses beyond this loop, follow `references/post-pr-review.md`.

## 13. Agent complete

Update the status file:

```json
{ "status": "agent_complete", "pr": "<pr-url>" }
```

Comment on the issue:

```bash
gh issue comment <number> --body "Draft PR created: <pr-url>"
```

Notify via cmux if available:

```bash
cmux notify --title "Issue #<n> — draft PR ready" --body "PR: <pr-url>"
```

**Do not remove the worktree.** Cleanup is `/work cleanup` or manual.

`in_review` and `complete` transitions are human-driven.

---

## Error handling

On failure (test unfixable, build broken, etc.):

1. **First attempt** — try a different approach. Re-read the issue, check plan files, look at similar patterns in the codebase.
2. **Second failure** — stop.

   Push current state:

   ```bash
   git push -u origin <branch-name>
   ```

   Update status to `failed`:

   ```json
   { "status": "failed", "blocker": "<what failed and what was tried>" }
   ```

   Comment on the issue:

   ```bash
   gh issue comment <number> --body "Blocked: <description>"
   ```

   Notify via cmux if available.

## Examples

### Standalone

> User: "Implement issue #12"
> The agent creates a worktree, runs the TDD loop, the simplify loop, the audit-tests loop, creates a draft PR, runs the post-PR review loop, and hands off at `agent_complete`.

### Resume

> User: "Pick up issue #15 where the agent left off"
> Detects the existing branch, runs tests to assess state, reads recent commits, continues from current state.

### Dispatched by /work

> Already inside a `.claude/worktrees/` worktree — skip setup (step 3), run the full workflow autonomously.
