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
model: opus
---

# comment-triage

> **Model: Opus** — deciding "would a fluent engineer actually need this?" is deep taste held across a whole file, not a regex. Sonnet systematically under-cuts here (it keeps plausible-sounding why-prose); Opus judges borderline calls decisively.

Triages comments with a **clarity-first** stance. The goal is not fewer comments — it's that every surviving comment earns its place by carrying a *true, non-obvious why in the fewest words that carry it*. Code that needs a comment to explain *what* it does gets fixed instead of annotated; a *why* that's bloated, self-evident, or compensating for a weak name gets tightened or designed away.

**Two core principles (embed both in every judgment):**
> 1. **What-comments are a code smell.** If you need a comment to explain *what* the code does, the code is mis-architected — fix it (rename, extract, simplify) rather than annotate it.
> 2. **Why-comments have a ceiling.** A *why* earns its place only when it is (a) true, (b) genuinely non-obvious from the code, names, types, and nearby tests, and (c) stated in the fewest words that carry the surprise. A correct-but-bloated why is a defect: tighten it to the irreducible fact. A why that just restates a name or structure ("X is the single source of truth", "Y derives from X") is noise: remove it. A why that exists only because a name is cryptic or a value is magic is a refactor: fix the name.

This is not a keep-everything skill. Genuine why is protected — but "it explains why" is not a free pass. Most over-commenting hides in plausible-sounding why-prose, not in `// increment i`.

**Audience: a fluent practitioner.** Judge every comment as if the reader is a competent engineer fluent in the language, its standard library, and the frameworks in use. Never explain semantics they already know — that `bool` is an `int` subclass, what a list comprehension builds, that `await` suspends, that a validate call raises on bad input. If the only thing a comment adds is a language/stdlib fact, REMOVE it. Comments are for what's surprising *about this code*, not for teaching the language.

**Docstrings are comments — no exemption.** A module/function/class docstring faces the exact same bar as a `#` comment. Narration ("Run forever, reconnecting", "Validate a raw dict") is cut, not relocated. **Moving a `#` comment's prose into a `"""..."""` is not a cut** — it's the same content in a different delimiter. A docstring survives only if it documents a contract the signature can't (units, ranges, nullability, throwing behavior, a cross-system invariant) *and* clears the bug-bar, and then it's tightened to one or two lines. On internal APIs, prefer types over docstrings entirely (Zod/tRPC/dataclass fields carry more than prose) — leave only the irreducible why.

## The three buckets

Classify every comment in scope into exactly one:

1. **REMOVE** (auto-applied) — pure noise, no information loss:
   - Restates the code: `// increment i` over `i++`, `# return result` over `return result`.
   - Commented-out code (keep only if tagged with a reason, e.g. `// kept: flaky in CI #1234`).
   - AI/scaffold filler: `// Here's the function`, `// Step 1:` narration, `// TODO: implement` over finished code, banner comments restating an obvious section.
   - Stale attribution / changelog noise: `// added by X`, `// modified for ticket` — git records this.
   - Tautological *why*: restates what the names, types, or structure already make plain — `# X is the single source of truth`, `# Y derives from X so they can't drift`, or `except InvalidURI: # a malformed URL can never succeed` (the exception's own name says it). Run the cover test (below): if nothing is lost that a reader couldn't recover from the symbols, it's noise.
   - Restates a descriptive test name: a comment under `test_blank_adapter_id_rejected_at_construction` saying "must fail at construction" is noise. A test's name + assertion *is* its documentation; a comment there earns its place only by adding a why the reader gets from *neither* (e.g. why a magic literal like `10**400` was chosen). Default test comments to REMOVE.
   - Repeated rationale: the same fact explained at multiple sites. State a genuinely non-obvious one *once* at its source of truth; elsewhere use a short pointer or nothing. (Language-semantics "gotchas" — `bool`/`int`, etc. — are REMOVE *everywhere* per the audience rule, not "keep once".)

2. **KEEP & TIGHTEN** — a *why* clean code genuinely can't express. Keep the *fact*, cut it to the irreducible surprise: a multi-line paragraph guarding two lines of code, or prose re-explaining the mechanism step by step, gets rewritten down to the one clause a reader couldn't infer. Legitimate categories:
   - Rationale, trade-offs, why a non-obvious approach was chosen.
   - Warnings, ordering constraints, gotchas, concurrency notes.
   - `TODO`/`FIXME`/`HACK`/`XXX` pointing at real outstanding work.
   - External references: specs, RFCs, issue links, vendor bug IDs.
   - Tool directives (functional, not comments): `eslint-disable`, `ts-expect-error`, `# type: ignore`, `# noqa`, `pragma`, `# pylint:`.
   - Legal: license headers, copyright, SPDX.
   - Public-API docs documenting units, ranges, nullability, throwing behavior, contracts not evident from the signature.

   *Tighten on keep:* state the surprise once, drop the mechanism narration. `# bool is an int subclass, so 0.0 <= True <= 1.0 holds — exclude it` survives; the same point spread over four lines does not. If you can't shorten it without losing the why, keep it verbatim.

3. **REFACTOR CANDIDATE** (triaged, not auto-applied) — a comment that only exists because the code is hard to follow. The comment is a symptom; the fix is clearer code, after which the comment is unnecessary. Typical remedies:
   - Extract a well-named function/variable so the comment becomes the name (`// check token valid and device not banned` → `isTokenUsable(t)`).
   - Rename a cryptic identifier so the explanation is redundant.
   - Simplify tangled control flow / split a dense expression.
   - Replace a magic value with a named constant (keep any *why* for the value).
   - A *true why* that exists only because a name is cryptic or a value is magic — `_MAX_SAFE_TS` guarding a field named `ts` wants `ts_unix_ms`; a weighted `["ok","ok","ok","degraded","error"]` list wants `random.choices(..., weights=...)` or a named distribution. The comment is correct, but the name should carry it.

**The cover test — run it on every comment.** Mentally delete the comment and read only the code, names, types, and nearby tests, then:
- A reader recovers the *whole* point → **REMOVE** (noise or tautology).
- They recover *what* but not *why this choice* → **KEEP**, tightened to that why.
- The why is real but exists because a name/value is opaque → **REFACTOR** the name.
- The why is real and irreducible, but it's 2×+ the length of the code and the extra words narrate mechanism → **TIGHTEN** in place.

**The bug-bar (the keep threshold).** A comment survives only if you can name the *specific bug* a competent reader would introduce by removing it — a trap they'd hit "simplifying" the code (reintroduce a float() overflow, drop a guard that prevents a TypeError leak, break a cross-system contract). "Nice context", "might help someone", "explains the intent" — all cut. **When genuinely on the fence between keep and cut, cut.** Keep the *fact* only when its absence is a trap, and even then cut the *words* to the minimum. Default to the smallest faithful comment, not the longest safe one — and bias the borderline call toward fewer comments, not more.

## Workflow

```
1. SCOPE    — resolve the containment to a file list
2. TRIAGE   — read files, run the cover test, sort every comment into remove / keep / tighten / refactor (one pass)
3. APPLY    — delete the REMOVE bucket and rewrite the TIGHTEN bucket in place (both comment-only, reversible)
4. PRESENT  — one overview: removed + every tighten (old→new) + every refactor candidate
5. RESOLVE  — user picks per refactor candidate (apply / skip / modify); apply approved refactors
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

Read each file, run the cover test on every comment, and apply the **comment-only** layer now (working-tree edits only — never stage or commit unless asked): delete the REMOVE bucket (whole comment lines plus any leftover blank line) and rewrite the TIGHTEN bucket down to its irreducible why. Both are reversible via git and touch no executable code, strings, or kept-verbatim comments. Refactors are *not* applied here — they change code and wait for approval.

### 4. Present the triage overview

One consolidated report, e.g.:

```
COMMENT-TRIAGE — scope: current branch (7 files)

✓ REMOVED 9 comments — noise + tautology (applied)
   src/auth.ts  4    src/parse.ts  2    src/sync.ts  3
✓ TIGHTENED 5 why-comments (applied, comment-only):
   adapter.py:56   4 lines → 1   "round-trip through validate_tick so an invalid tick can't be emitted"
   adapter.py:114  5 lines → 1   "cap the exponent: 2**attempt overflows float past ~1024"
✓ KEPT 7 why-comments verbatim

REFACTOR CANDIDATES — a better name kills the comment (your call):

[1] contract.py:27   `_MAX_SAFE_TS` guards a field named `ts`
    → rename `ts` → `ts_unix_ms`; the precision comment shrinks to the JS-float note
[2] adapter.py:24    magic weighted list `["ok","ok","ok","degraded","error"]`
    → `random.choices(HEALTH_VALUES, weights=…)` or a named WEIGHTS const
[3] src/sync.ts:120  dense control flow explained line-by-line
    → split into guard clauses; larger change, lower confidence
```

### 5. Resolve interactively

Let the user act per candidate — apply this, skip that, modify the suggestion — the way `handle-pr-feedback` resolves review comments. Use `AskUserQuestion` (multiSelect) to collect the picks in one go, or accept a bulk "do all" / "do 1 and 2". Apply each approved refactor as a focused edit. Skipped candidates are left untouched (comment stays). Do **not** auto-apply refactors without approval — they change code, not just comments.

### 6. Verify

If a refactor was applied and the project has them, run typecheck / tests / build and report results (per the user's quality-gate convention). If only comments were removed or tightened (no code change), no verification needed — note that. Commit only if the user asks.

## Notes

- All comment removal and tightening is comment-only and reversible via git; refactors are gated behind explicit approval.
- Large scope (>40 files): summarize the triage and confirm before applying anything.
- This skill judges comments and proposes clarity refactors. For broader cleanup pair it with `/simplify`; for bug-hunting pair with `/code-review`.
