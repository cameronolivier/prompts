---
name: boyscout
description: Boy Scout Rule for code — as you finish touching source files, leave them a little cleaner against the project's coding rules. Auto-applies safe fixes; flags structural/risky items for the user (fix now / create issue / ignore). Use when wrapping up edits to source files before declaring work done, or on demand — "run boyscout", "boyscout this PR", "tidy the files I touched", "leave it cleaner than I found it". Also sets up a project's rules file — "boyscout init", "set up code rules". Defers comments to comment-triage, test gaps to audit-tests, bug-hunting to /code-review.
allowed-tools:
  - Read
  - Edit
  - Write
  - Grep
  - Glob
  - AskUserQuestion
  - Bash(bash:*/boyscout/scripts/scope.sh:*)
  - Bash(BASE_BRANCH=*:*/boyscout/scripts/scope.sh:*)
  - Bash(git diff:*)
  - Bash(git status:*)
model: sonnet
---

# boyscout

> **Model: Sonnet** — judging what's safe to auto-fix vs. what needs a human call,
> against the project's rules, is contextual reasoning, not a regex.

Leave the campsite cleaner than you found it. As the agent touches source files —
during normal work, or on demand against a PR/branch — it makes **small, scoped**
improvements to *those files* and corrects drift toward the project's coding rules.
This is opportunistic cleanup, **not** a refactor project.

**Core principle: No Broken Windows.** Fix small rot the moment you're in the file.
But stay disciplined — only touch files already in scope, keep changes small, and
when unsure, **flag don't fix**.

## Two modes

| | **Inline** (default, during work) | **Audit** (explicit) |
|---|---|---|
| When | You're wrapping up a set of edits | "run boyscout", "boyscout this PR" |
| Scope | The exact files you just edited (you already know them) | `scope.sh` → branch / `--pr N` / paths |
| Behaviour | Apply safe layer quietly; only interrupt to flag something | Full triage report |

Inline mode must **not derail the task it rides on**: apply the safe layer, and if
nothing needs flagging, say so in one line (or stay silent). Never expand scope.

## The rules input

On every run, find the project's rules, first match wins:
`.claude/code-rules.md` → `docs/code-rules.md` → `CODE_RULES.md`.

- **Found** → load it. If its first lines say `boyscout: off`, stop (repo opted out).
  Triage touched files against it.
- **Not found** → offer to set one up (see `reference/init.md`). On accept, run the
  interview. On decline, write a default `.claude/code-rules.md` from the template
  and proceed. Either way a rules file exists afterward, so this never re-prompts.
- Never read rules from `CLAUDE.md` — it's loaded every turn; the rules file is
  loaded only when boyscout runs.

Rules are tagged **Rule** (must follow) and **Pattern** (should follow). Bundled
default if no file and the user truly wants none: functional-first but
codebase-respecting, immutability, guard clauses, cohesion/DRY/orthogonality,
intent-revealing names, small single-purpose functions.

## Buckets

Classify each finding in scope using the rules + Rule/Pattern tags:

1. **AUTO-FIX** (applied directly, reversible via git) — a **Rule** violation in a
   safe category, no behavior change:
   - Dead code: unused imports, unreachable branches, unused locals/private helpers.
   - Mutation → functional transform (`forEach`+push → `filter`/`map`/`reduce`).
   - Deep nesting → guard clauses; magic value → named constant.
   - Completed-TODO cruft; `import type`; obvious in-file cryptic→clear rename.
   - Formatter/lint nits **only if** a project config exists.

2. **FLAG** (present for the user's call) — structural **Rule** violations or any
   **Pattern** deviation:
   - Touches exported/public API or signatures; cross-file change.
   - Control-flow restructuring, function/class extraction, cohesion fixes
     (grab-bag module), 3+ positional params → object.
   - Paradigm/naming-convention drift; risky dead-code removal (reflection,
     dynamic dispatch, public exports); real outstanding TODO/tech-debt.

When unsure between auto-fix and flag, **flag**. Never touch files out of scope.

## Workflow

```
1. RULES   — locate rules file (or run/skip init); read it
2. SCOPE   — inline: the just-edited files; audit: scripts/scope.sh
3. TRIAGE  — read in-scope files, classify findings into AUTO-FIX / FLAG (one pass)
4. APPLY   — apply AUTO-FIX now (working-tree edits only; never commit unless asked)
5. PRESENT — show what was fixed + every flagged item
6. RESOLVE — per flagged item: fix now / create issue / ignore
7. VERIFY  — if code changed, run typecheck/tests/build when present; report
```

### Scope (audit mode)

Run the bundled resolver by absolute path under this skill's base dir (`$SKILL_DIR`):

```bash
bash "$SKILL_DIR/scripts/scope.sh"            # default: branch changes + new files
bash "$SKILL_DIR/scripts/scope.sh" --pr 42    # files in PR #42 (needs gh)
bash "$SKILL_DIR/scripts/scope.sh" src/ x.ts  # explicit paths / globs
```

Skip binary, generated, vendored, minified files (`*.min.*`, `dist/`, `build/`,
`node_modules/`, lockfiles, snapshots).

### Resolve flagged items

Use `AskUserQuestion` (multiSelect) to collect picks in one go, like
`handle-pr-feedback`. Per item: **fix now** (focused edit), **create issue**
(compose `triage-issue`), or **ignore** (leave untouched). Never apply a flagged
change without approval.

### Verify

If a code change (not just comments/formatting) was applied, run the project's
typecheck/tests/build and report results. Safe-only runs need no verification —
note that. Commit only if the user asks.

## Delegation — don't duplicate

- **Comments** → `comment-triage` (boyscout doesn't triage comment bodies).
- **Test gaps / quality** → `audit-tests` (boyscout may *point* at a weakly-tested
  touched file, but does no test analysis).
- **Bug hunting** → `/code-review`; **broad simplification** → `/simplify`.

## Notes

- All auto-fixes are reversible via git; flagged changes are gated behind approval.
- Large inline scope (many files touched): summarize before applying, keep it small.
- See `reference/init.md` for the rules-file setup interview, and
  `reference/code-rules.template.md` for the starter a repo copies to `.claude/`.
