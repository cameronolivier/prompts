---
name: audit-tests
description: |
  Audit test quality for a branch or PR — find gaps, rate by priority, and implement improvements. Use when user says "audit tests", "review test quality", "check test coverage", "are my tests good enough", or when invoked by other skills post-implementation.

  <example>
  Context: User finished a feature and wants to check test quality
  user: "Audit the tests on this branch"
  assistant: "I'll audit all test files changed on this branch against main and report gaps by priority."
  <commentary>
  Default mode — diffs current branch vs main, reviews changed/added test files.
  </commentary>
  </example>

  <example>
  Context: User wants to audit a specific PR
  user: "/audit-tests 42"
  assistant: "I'll fetch PR #42's changed files and audit test quality."
  <commentary>
  PR mode — fetches file list from GitHub, scopes audit to those files.
  </commentary>
  </example>

  <example>
  Context: Post-implementation agent wants test quality check
  user: "[invoked by /implement after completing work]"
  assistant: "Running test audit on the implementation branch."
  <commentary>
  Composable — other skills invoke this as a quality gate.
  </commentary>
  </example>
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - AskUserQuestion
---

Audit test quality for a piece of work. Find weaknesses, suggest improvements by priority, implement what the user chooses.

**Arguments:** `$ARGUMENTS` — optional PR number, branch name, or path. Default: current branch vs main.

## Phase 1: Detect

### Scope

Determine which files to audit:

- **No argument / branch name:** `git diff --name-only main...HEAD` — all changed/added files
- **PR number:** `gh pr diff <number> --name-only` — files changed in PR
- **Explicit path:** Use the given path/glob

From the changed files, identify:
- **Source files** — the code being tested
- **Test files** — existing tests for that code
- **Untested source files** — changed source with no corresponding tests

### Framework Detection

Auto-detect from project config and dependencies:

| Signal | Framework |
|--------|-----------|
| `vitest.config.*` or `vitest` in package.json | Vitest |
| `jest.config.*` or `jest` in package.json | Jest |
| `playwright.config.*` | Playwright (E2E) |
| `cypress.config.*` or `cypress/` dir | Cypress (E2E) |
| `@testing-library/*` in deps | Testing Library (component) |

If ambiguous, check existing test file imports. If still unclear, ask the user.

### Convention Detection

Read CLAUDE.md and project config for test instructions. Then read 2-3 existing test files to learn:
- File naming: `*.test.ts` vs `*.spec.ts`
- Location: co-located vs `__tests__/` directory
- Import style, describe/it structure, factory patterns
- Mock approach, assertion style

**Rule:** Follow project conventions when their quality is sufficient. If conventions are sloppy (over-mocking, snapshot abuse, no assertions), defer to best practices. Always respect explicit project instructions.

### Test Command Detection

Find the test runner command:
1. Check CLAUDE.md for explicit test commands
2. Check `package.json` scripts: `test`, `test:unit`, `test:e2e`
3. Check for `turbo.json`, monorepo workspace config
4. Fall back to `npx vitest` / `npx jest` based on detected framework

## Phase 2: Analyse

Read every test file in scope. For each file, evaluate against the rubric in [RUBRIC.md](RUBRIC.md).

For each gap found, classify:

### Priority Tiers

| Tier | Label | Criteria |
|------|-------|----------|
| P1 | **Critical** | Gaps that would let real bugs through — missing failure paths, no boundary testing on auth/money/deletion, untested business-critical logic |
| P2 | **Recommended** | Meaningful confidence improvements — edge cases, assertion quality, missing test types, negative testing |
| P3 | **Nice-to-have** | Readability, naming, structural improvements, minor DRY opportunities |

### Test Type Classification

Group all findings by test type:
- **Unit** — pure logic, validation, transformations, domain rules
- **Integration** — API routes + DB, service + persistence, auth middleware
- **Component** — React/UI component behavior (frontend only)
- **E2E** — critical user journeys, smoke tests

**Important:** Only suggest test types whose framework is already in the project. Exception: always suggest component tests for frontend code if `@testing-library` is available, even if none exist yet.

## Phase 3: Report

### Chat Summary

Present a concise summary:

```
## Test Audit: <branch-name>

### Overview
- Files analysed: N test files, M source files
- Framework: Vitest + Testing Library
- Test command: `pnpm test`

### Findings

#### Unit Tests
- P1 Critical: N items
- P2 Recommended: N items
- P3 Nice-to-have: N items

#### Component Tests
- P1 Critical: N items
...

### Top Critical Gaps
1. <brief description>
2. <brief description>
3. <brief description>
```

### Plan File

Write detailed findings to `plans/test-audit-<branch>.md`:

```markdown
# Test Audit: <branch-name>
Date: <date>
Framework: <detected>
Branch: <name> vs main

## Unit Tests

### P1 Critical
- [ ] <file>: <what's missing and why it matters>
- [ ] <file>: <what's missing and why it matters>

### P2 Recommended
- [ ] <file>: <suggestion>

### P3 Nice-to-have
- [ ] <file>: <suggestion>

## Component Tests
...

## Implementation Notes
<any context about conventions, patterns to follow, framework specifics>
```

### Prompt User

After presenting findings, ask:

> What would you like me to implement? Options:
> - "all critical" — all P1 across all test types
> - "all unit tests" — all priorities for unit tests
> - "all critical unit tests" — P1 unit tests only
> - "everything" — all findings
> - Or specify by number from the plan file

## Phase 4: Implement

Follow [IMPLEMENTATION.md](IMPLEMENTATION.md) for test writing best practices.

For each selected finding:

1. **Create, extend, or refactor** the test file as needed
2. **Run the tests** using the detected test command
3. **If tests fail:** read the error, fix, re-run (max 3 attempts)
4. **If still failing after 3 attempts:** report what's broken and move to next item
5. **Commit** each logical group of test improvements atomically:
   ```bash
   git add <specific-test-files>
   git commit -m "test(scope): <what was added/improved>"
   ```

### Implementation Order

Within a priority tier, implement in this order:
1. Tests for completely untested source files
2. Missing failure/edge case tests in existing files
3. Refactoring weak existing tests

### Verification

After all selected items are implemented:

```bash
# Run full test suite to confirm nothing broke
<detected-test-command>
```

Report final results: how many items implemented, any that couldn't be resolved, overall test health.

## Rules

- **Never delete passing tests** — improve or add alongside
- **Concise tests** — enough for confidence, not bloated. No unnecessary tests.
- **Behaviour over implementation** — test what the system does, not how
- **One assertion cluster per test** — multiple assertions OK if same behaviour
- **Mock only at real boundaries** — network, filesystem, external services, time
- **Deterministic** — control time, randomness, async, environment
- **Name tests like requirements** — "rejects updates from unauthorized users" not "test1"
