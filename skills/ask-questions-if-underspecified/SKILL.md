---
name: ask-questions-if-underspecified
description: Ask the minimum set of clarifying questions before implementing an underspecified request. Use when the user says "clarify the requirements", "what should I build?", invokes this skill explicitly, or when the request is missing acceptance criteria, scope, constraints, or environment. Distinct from `clarify` (which interrogates an existing plan); this gates *starting* work on a fuzzy ask.
allowed-tools:
  - Read
  - Glob
  - Grep
  - AskUserQuestion
---

# Ask Questions If Underspecified

> **Recommended model: Sonnet** — light judgment about must-have vs nice-to-know, plus shaping multiple-choice options the user can answer fast. Haiku tends to ask too many questions; Opus is overkill.

Ask the minimum set of clarifying questions needed to avoid wrong work. Do not start implementing until must-have questions are answered, or the user explicitly approves proceeding with stated assumptions.

Composes with: `clarify` (use that one for plan interrogation, not requirement triage).

## Workflow

### 1. Decide whether the request is underspecified

Treat a request as underspecified when, after a quick discovery read, any of the following is unclear:

- **Objective** — what should change vs stay the same.
- **Done** — acceptance criteria, examples, edge cases.
- **Scope** — which files / components / users are in or out.
- **Constraints** — compatibility, performance, style, deps, time.
- **Environment** — language / runtime versions, OS, build / test runner.
- **Safety** — data migration, rollout / rollback, reversibility.

If multiple plausible interpretations exist, treat it as underspecified.

### 2. Ask must-have questions first (small batch)

Ask 1–5 questions in the first pass. Prefer questions that eliminate whole branches of work.

Make questions easy to answer:

- Numbered, scannable, short — avoid paragraphs.
- Multiple-choice when possible.
- Mark a recommended default for each option.
- Offer a fast-path response (e.g. reply `defaults` to accept all).
- Include a low-friction "not sure" option.
- Separate "need to know" from "nice to know" if it reduces friction.
- Allow compact decisions (e.g. `1b 2a 3c`); restate the chosen options to confirm.

### 3. Pause before acting

Until must-have answers arrive:

- Do **not** run commands, edit files, or produce a detailed plan that depends on unknowns.
- Do perform a clearly labelled, low-risk discovery step only if it does not commit to a direction (read configs, inspect repo structure).

If the user explicitly asks to proceed without answers:

- State assumptions as a short numbered list.
- Ask for confirmation; proceed only after they confirm or correct them.

### 4. Confirm interpretation, then proceed

Once answers are in, restate the requirements in 1–3 sentences (key constraints + what success looks like), then start work.

## Question templates

- "Before I start, I need: (1) ..., (2) ..., (3) .... If you don't care about (2), I'll assume ...."
- "Which of these should it be? A) ... B) ... C) ... (pick one)"
- "What would you consider 'done'? For example: ..."
- "Any constraints I must follow (versions, performance, style, deps)? If none, I'll target the existing project defaults."

```text
1) Scope?
   a) Minimal change (default)
   b) Refactor while touching the area
   c) Not sure — use default
2) Compatibility target?
   a) Current project defaults (default)
   b) Also support older versions: <specify>
   c) Not sure — use default

Reply with: defaults  (or e.g. 1a 2b)
```

## Anti-patterns

- Asking questions answerable by a quick discovery read (configs, existing patterns, docs).
- Open-ended questions when a tight multiple-choice or yes/no eliminates ambiguity faster.
- Asking everything up front — front-load only must-haves; come back for nice-to-haves later.
