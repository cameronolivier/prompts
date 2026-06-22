---
name: comment-triage
description: Triage comments in source code — remove noise, keep genuine why-comments, and flag what/how comments as refactor candidates because clearer code beats an explanatory comment. Use when the user says "clean up comments", "remove unnecessary comments", "triage comments", "prune comments", "tidy up the comments", "strip redundant comments", or "review the comments". Defaults to the current branch's work (changed + new files vs the base branch); accepts a different containment — staged only, working tree, whole repo, a PR number, or explicit paths/globs.
allowed-tools:
  - Read
  - Edit
  - Grep
  - Glob
  - AskUserQuestion
  - Bash(bash:*/comment-triage/scripts/scope.sh:*)
  - Bash(BASE_BRANCH=*:*/comment-triage/scripts/scope.sh:*)
  - Bash(git diff:*)
  - Bash(git status:*)
model: sonnet
---

# comment-triage

> **Model: Sonnet** — judging *why vs. what* and proposing a refactor is contextual reasoning, not a regex.

Triages comments with a **clarity-first** stance. The goal is not fewer comments — it's that every surviving comment earns its place, and that code which *needs* a comment to be understood gets fixed instead of annotated.

**Core principle (embed this in every judgment):**
> If you need a comment to explain *what* the code does, that's a signal the code is mis-architected. Prefer fixing the code (rename, extract, simplify) over keeping the comment. A comment explaining *why* is legitimate — keep it.

This is not an anti-comment skill. Meaningful comments are respected and preserved; only noise is removed, and unclear code is surfaced for a refactor rather than left under a what-comment.

## The three buckets

Classify every comment in scope into exactly one:

1. **REMOVE** (auto-applied) — pure noise, no information loss:
   - Restates the code: `// increment i` over `i++`, `# return result` over `return result`.
   - Commented-out code (keep only if tagged with a reason, e.g. `// kept: flaky in CI #1234`).
   - AI/scaffold filler: `// Here's the function`, `// Step 1:` narration, `// TODO: implement` over finished code, banner comments restating an obvious section.
   - Stale attribution / changelog noise: `// added by X`, `// modified for ticket` — git records this.

2. **KEEP** (untouched) — irreducible *why*-signal that clean code still can't express:
   - Rationale, trade-offs, why a non-obvious approach was chosen.
   - Warnings, ordering constraints, gotchas, concurrency notes.
   - `TODO`/`FIXME`/`HACK`/`XXX` pointing at real outstanding work.
   - External references: specs, RFCs, issue links, vendor bug IDs.
   - Tool directives (functional, not comments): `eslint-disable`, `ts-expect-error`, `# type: ignore`, `# noqa`, `pragma`, `# pylint:`.
   - Legal: license headers, copyright, SPDX.
   - Public-API docs documenting units, ranges, nullability, throwing behavior, contracts not evident from the signature.

3. **REFACTOR CANDIDATE** (triaged, not auto-applied) — a *what/how* comment that only exists because the code is hard to follow. The comment is a symptom; the fix is clearer code, after which the comment is unnecessary. Typical remedies:
   - Extract a well-named function/variable so the comment becomes the name (`// check token valid and device not banned` → `isTokenUsable(t)`).
   - Rename a cryptic identifier so the explanation is redundant.
   - Simplify tangled control flow / split a dense expression.
   - Replace a magic value with a named constant (keep any *why* for the value).

When genuinely unsure between KEEP and REFACTOR, prefer KEEP — never delete intent.

## Workflow

```
1. SCOPE    — resolve the containment to a file list
2. TRIAGE   — read files, classify every comment into the three buckets (one pass)
3. APPLY    — remove the REMOVE bucket directly (safe, reversible)
4. PRESENT  — show one triage overview: what was removed + every refactor candidate
5. RESOLVE  — user picks per candidate (apply / skip / modify); apply approved refactors
6. VERIFY   — run the project's typecheck/tests/build if present; report results
```

### 1. Scope

Invoke the bundled script by its absolute path under this skill's base directory (`$SKILL_DIR`), run from the target repo. Default is the current branch's work:

```bash
bash "$SKILL_DIR/scripts/scope.sh"               # default: branch changes + new files vs base
bash "$SKILL_DIR/scripts/scope.sh" --staged      # staged changes only
bash "$SKILL_DIR/scripts/scope.sh" --uncommitted # working-tree changes (staged + unstaged + untracked)
bash "$SKILL_DIR/scripts/scope.sh" --all         # every tracked file in the repo
bash "$SKILL_DIR/scripts/scope.sh" --pr 42       # files in PR #42 (needs gh)
bash "$SKILL_DIR/scripts/scope.sh" src/ utils.ts # explicit paths / globs / dirs
```

Pass the user's stated containment through verbatim; run the default if they gave none. Override the base branch with `BASE_BRANCH=develop bash "$SKILL_DIR/scripts/scope.sh"`. Skip binary, generated, vendored, and minified files (`*.min.*`, `dist/`, `build/`, `node_modules/`, lockfiles, snapshots).

### 2–3. Triage and apply the safe layer

Read each file, classify every comment, and **remove the REMOVE bucket now** (working-tree edits only — never stage or commit unless asked). Remove whole comment lines plus any leftover empty line; never touch executable code, strings, or kept comments. Leave KEEP comments exactly as-is.

### 4. Present the triage overview

One consolidated report, e.g.:

```
PRUNE-COMMENTS — scope: current branch (7 files)

✓ REMOVED 9 noise comments (applied)
   src/auth.ts        4    src/parse.ts   2    src/sync.ts   3
✓ KEPT 12 why-comments (untouched)

REFACTOR CANDIDATES — code clearer than the comment (your call):

[1] src/auth.ts:42   what-comment masks an unclear conditional
    // check token still valid and device not banned
    → extract `isTokenUsable(t)`; the name replaces the comment
[2] src/parse.ts:88  magic skip needs a name
    → const hasBom = bytes[0] === 0xEF …; keep the why, drop the what
[3] src/sync.ts:120  dense control flow explained line-by-line
    → split into guard clauses; larger change, lower confidence
```

### 5. Resolve interactively

Let the user act per candidate — apply this, skip that, modify the suggestion — the way `handle-pr-feedback` resolves review comments. Use `AskUserQuestion` (multiSelect) to collect the picks in one go, or accept a bulk "do all" / "do 1 and 2". Apply each approved refactor as a focused edit. Skipped candidates are left untouched (comment stays). Do **not** auto-apply refactors without approval — they change code, not just comments.

### 6. Verify

If a refactor was applied and the project has them, run typecheck / tests / build and report results (per the user's quality-gate convention). If only noise was removed, no verification needed — note that. Commit only if the user asks.

## Notes

- All comment removal is reversible via git; refactors are gated behind explicit approval.
- Large scope (>40 files): summarize the triage and confirm before applying anything.
- This skill judges comments and proposes clarity refactors. For broader cleanup pair it with `/simplify`; for bug-hunting pair with `/code-review`.
