# boyscout init — build the project's code-rules file

Run this when a repo has no `.claude/code-rules.md` (boyscout offers it
automatically) or when the user asks to "set up code rules" / "boyscout init".

The output is a committed `.claude/code-rules.md`, rendered from
`reference/code-rules.template.md` + the user's answers. Once it exists, every
boyscout run applies it and this flow never re-prompts.

## Flow

### 1. Detect the stack

Before asking anything, read the repo to pre-fill defaults and decide which
optional language sections survive:

- `package.json` (deps: react, next, @trpc, zod, vitest/jest) → keep the
  TypeScript / React / tRPC sections.
- `pyproject.toml` / `requirements.txt` / `*.py` → OO-leaning; soften the
  FP-first default, keep a Python note instead of the TS block.
- Otherwise → keep the language-agnostic core only; drop optional blocks.

State what you detected in one line before the interview.

### 2. Interview (defaults pre-filled — user can rubber-stamp)

Use `AskUserQuestion` (batch the questions; first option is the recommended
default). Skip any question the stack makes irrelevant.

1. **Paradigm** — FP-first, respect existing OO *(default)* / OO-first /
   strictly match each file's existing style.
2. **Stack sections** — confirm the auto-detected language sections to bake in.
3. **Immutability** — Rule: flag arg mutation, prefer map/filter/reduce
   *(default)* / Pattern: prefer, allow pragmatic mutation.
4. **Type safety** *(TS only)* — Rule: no `any`/`as`, `import type`, validation
   *(default)* / relax.
5. **Naming & structure** — adopt entity-folder/verb-function + `Params`/`Result`/
   `Response` suffixes *(default if tRPC/Next detected)* / skip, project has own.
6. **Size thresholds** — flag functions over ~40 lines and 3+ positional params
   → object *(default)* / adjust the numbers.
7. **Comments** — why-not-what, defer detail to `comment-triage` *(default yes)*.
8. **Testing** — defer to `audit-tests`, boyscout only points at gaps, never
   analyses *(default yes)*.

### 3. Render & write

Copy the template, apply the answers (flip Rule/Pattern tags, drop unused
sections, set thresholds), write to `.claude/code-rules.md`. Show the user the
result. Commit only if the user asks (it's a project config file).

### 4. Hand back

Tell the user it's the living standard — editable any time, regenerate with
`boyscout init`. Then continue the boyscout cleanup run against it.

## Decline path

If the user declines the interview, **still write a default
`.claude/code-rules.md`** — the unmodified template with stack-appropriate
sections kept. No questions asked. Tell them:

> Wrote `.claude/code-rules.md` with sensible defaults — edit it any time, or run
> `boyscout init` to tailor it. (Add `boyscout: off` at the top to disable.)

This guarantees a rules file always exists after the first run, so boyscout never
nags again. If the user wants no file at all, honour that and skip — boyscout then
falls back to its bundled defaults each run.
