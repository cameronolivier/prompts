---
name: audit-tests
description: |
  Audit test quality for a branch or PR — find gaps, rate by priority, and optionally implement fixes. Trigger on "audit tests", "review test quality", "check test coverage", "are my tests good enough", "missing test cases", or when dispatched by another skill (e.g. `/implement` QA loop) as a post-implementation quality gate. Supports interactive mode (report + ask user what to implement) and QA-loop mode (auto-implement P1 gaps, emit structured status).

  <example>
  Context: User finished a feature and wants to check test quality
  user: "Audit the tests on this branch"
  assistant: "Running /audit-tests — diff current branch vs main, review changed test files, report gaps by priority."
  <commentary>
  Default interactive mode — reports findings and asks what to implement.
  </commentary>
  </example>

  <example>
  Context: User wants to audit a specific PR
  user: "/audit-tests 42"
  assistant: "Fetching PR #42 changed files and auditing test quality."
  <commentary>
  PR mode — scope is the PR's file list.
  </commentary>
  </example>

  <example>
  Context: /implement dispatches this as a QA-loop worker
  user: "[dispatched by /implement step 7 — audit tests on feature branch, P1 only, auto-implement, report COMMITS/STATUS/NOTES]"
  assistant: "QA-loop mode: auditing branch, implementing P1 gaps, reporting structured status."
  <commentary>
  QA-loop mode — skips user prompt, implements P1 only, emits the fresh-subagent contract.
  </commentary>
  </example>
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
  - Bash(git diff:*)
  - Bash(git log:*)
  - Bash(git status:*)
  - Bash(git add:*)
  - Bash(git commit:*)
  - Bash(git rev-parse:*)
  - Bash(gh pr diff:*)
  - Bash(gh pr view:*)
  - Bash(ls:*)
  - Bash(npx:*)
  - Bash(pnpm:*)
  - Bash(npm:*)
  - Bash(yarn:*)
  - Bash(bun:*)
  - Bash(turbo:*)
  - Bash(vitest:*)
  - Bash(jest:*)
  - Bash(playwright:*)
  - Bash(cypress:*)
model: sonnet
---

Audit test quality for a piece of work. Find weaknesses, classify by priority, implement what was requested.

**Arguments:** `$ARGUMENTS` — optional PR number, branch name, or path. Default: current branch vs main.

**Composes with:** `/tdd` (when writing new tests), `/simplify` (sibling QA gate in `/implement`). Cross-reference [`skill-conventions`](../skill-conventions/SKILL.md) and [`github-cli-rate-limits`](../github-cli-rate-limits/SKILL.md) when this skill is extended.

## Workflow index

1. [Detect mode](#1-detect-mode)
2. [Detect scope](#2-detect-scope)
3. [Detect framework & conventions](#3-detect-framework--conventions)
4. [Analyse](#4-analyse)
5. [Report](#5-report)
6. [Implement](#6-implement)
7. [Verify & exit](#7-verify--exit)

Detailed rubric in [`RUBRIC.md`](RUBRIC.md). Test-writing patterns in [`IMPLEMENTATION.md`](IMPLEMENTATION.md).

## 1. Detect mode

Two modes. Pick one up front:

| Mode | Trigger | Behaviour |
|------|---------|-----------|
| **interactive** | User invoked directly (`/audit-tests`, free-form request) | Report findings, ask user what to implement, then implement. |
| **QA-loop** | Dispatched by another skill (e.g. `/implement` step 7) with instructions to auto-implement and report structured status | Skip the user prompt. Auto-implement P1 only. Emit the [QA-loop contract](#qa-loop-contract). |

When in doubt, assume interactive. If the dispatching prompt says "report `COMMITS/STATUS/NOTES`", that is QA-loop mode.

## 2. Detect scope

Determine which files to audit:

- **No argument / branch name:** `git diff --name-only main...HEAD`
- **PR number:** `gh pr diff <number> --name-only`
- **Explicit path/glob:** use the given path

From the changed files, classify:

- **Source files** — the code under test
- **Test files** — existing tests covering that code
- **Untested source files** — changed source with no corresponding test file

## 3. Detect framework & conventions

### Framework

Auto-detect from project config and dependencies:

| Signal | Framework |
|--------|-----------|
| `vitest.config.*` or `vitest` in deps | Vitest |
| `jest.config.*` or `jest` in deps | Jest |
| `playwright.config.*` | Playwright (E2E) |
| `cypress.config.*` or `cypress/` dir | Cypress (E2E) |
| `@testing-library/*` in deps | Testing Library (component) |

If ambiguous, inspect imports in existing test files. If still unclear and in interactive mode, ask the user. In QA-loop mode, skip gracefully — report no framework detected and exit CLEAN.

### Conventions

Read `CLAUDE.md` and 2–3 existing test files. Extract:

- File naming (`*.test.ts` vs `*.spec.ts`)
- Location (co-located vs `__tests__/`)
- `describe`/`it` structure, factory patterns, mock style

**Rule:** follow project conventions when their quality is sufficient. If conventions are sloppy (over-mocking, snapshot abuse, empty assertions), defer to the rubric. Always respect explicit instructions in `CLAUDE.md`.

### Test command

Find the runner:

1. `CLAUDE.md` for an explicit command
2. `package.json` scripts: `test`, `test:unit`, `test:e2e`
3. Monorepo config: `turbo.json`, workspace root
4. Fall back to `npx vitest` / `npx jest` based on detected framework

## 4. Analyse

Read every test file in scope. Evaluate against the dimensions in [`RUBRIC.md`](RUBRIC.md).

### Priority tiers

| Tier | Label | Criteria |
|------|-------|----------|
| P1 | **Critical** | Real bugs could ship — missing failure paths on business-critical logic, untested auth/money/deletion/tenancy, no boundary testing on state transitions |
| P2 | **Recommended** | Meaningful confidence gains — edge cases, weak assertions, missing test types, absent negative cases |
| P3 | **Nice-to-have** | Readability, naming, structural DRY opportunities |

### Test type classification

Group findings by test type:

- **Unit** — pure logic, validation, transformations, domain rules
- **Integration** — API + DB, service + persistence, auth middleware
- **Component** — rendered output, interaction, accessibility (frontend only)
- **E2E** — critical user journeys only

**Only suggest types whose framework is present in the project.** Exception: always suggest component tests for frontend code if `@testing-library` is available, even if none exist yet.

### No-gap outcome

If analysis surfaces zero P1 findings and no changed source files are untested, the audit is CLEAN. Do not manufacture P2/P3 work to justify the run. In QA-loop mode, emit the full QA-loop contract (see §7) with `STATUS: CLEAN` and exit. In interactive mode, report CLEAN and ask whether to proceed with P2/P3.

## 5. Report

### Chat summary

Always produce this, in both modes:

```
## Test Audit: <branch-name>

### Overview
- Files analysed: N test files, M source files
- Framework: Vitest + Testing Library
- Test command: `pnpm test`

### Findings
#### Unit Tests
- P1 Critical: N
- P2 Recommended: N
- P3 Nice-to-have: N
#### Component Tests
- P1 Critical: N
...

### Top critical gaps
1. <brief>
2. <brief>
3. <brief>
```

### Plan file

**Interactive mode only.** Write detailed findings to `plans/test-audit-<branch>.md` (or `~/.claude/plans/` outside a repo). Structure:

```markdown
# Test Audit: <branch-name>
Date: <date>
Framework: <detected>
Branch: <name> vs main

## Unit Tests
### P1 Critical
- [ ] <file>: <what's missing and why it matters>

### P2 Recommended
- [ ] <file>: <suggestion>

### P3 Nice-to-have
- [ ] <file>: <suggestion>

## Component Tests
...

## Implementation notes
<conventions, framework specifics, patterns to follow>
```

### Interactive prompt

**Only in interactive mode.** After the summary, ask what to implement. Accept natural language — examples: "all critical", "all unit tests", "all critical unit tests", "everything", or item numbers from the plan file.

## 6. Implement

Follow [`IMPLEMENTATION.md`](IMPLEMENTATION.md) for writing style.

### Selection

- **Interactive mode:** implement what the user selected.
- **QA-loop mode:** implement P1 findings only. Skip P2/P3.

### Per-finding loop

1. Create, extend, or refactor the test file.
2. Run the detected test command on the affected file(s).
3. **If tests fail:** read the error, fix, re-run. Max 3 attempts per finding.
4. **If still failing after 3 attempts:** log the failure in the plan file, move on. Do not delete the test.
5. **Commit** atomically per logical group:
   ```bash
   git add <specific-test-files>
   git commit -m "test(<scope>): <what was added/improved>"
   ```

### Implementation order (within a tier)

1. Tests for completely untested source files
2. Missing failure/edge-case tests in existing files
3. Refactoring weak existing tests

## 7. Verify & exit

Run the full test suite to confirm nothing broke:

```bash
<detected-test-command>
```

Follow verification-before-completion discipline: do not claim success before seeing green output.

### Interactive mode exit

Report:
- Items implemented
- Items that failed after 3 attempts
- Final test-suite status
- Path to the plan file

### QA-loop contract

In QA-loop mode, end the run by emitting **exactly** this block (no extra prose) so the dispatching orchestrator can parse it:

```
COMMITS: <n>
STATUS: CLEAN | DIRTY
NOTES: <one-line summary>
```

- `COMMITS` — number of commits this invocation made.
- `STATUS` — `CLEAN` when no P1 gaps remain (either none found or all fixed). `DIRTY` when P1 gaps remain unfixed.
- `NOTES` — one line: the dominant finding or blocker.

The dispatching skill (`/implement`, `/work`) terminates the loop on `CLEAN`, on a zero-commit iteration, or after its iteration cap. See `skills/implement/SKILL.md` §7.

## Rules

- **Never delete passing tests** — improve or add alongside.
- **Concise tests** — sufficient for confidence, no bloat. No tests for coverage's sake.
- **Behaviour over implementation** — test what the system does, not how.
- **One assertion cluster per test** — multiple assertions fine when they describe the same behaviour.
- **Mock only at real boundaries** — network, filesystem, external services, time, randomness.
- **Deterministic** — control time, randomness, async, environment.
- **Name tests like requirements** — `rejects updates from unauthorized users`, not `test1`.
- **No work manufacturing** — if tests are good, say so and exit.
