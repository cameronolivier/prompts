# QA-loop dispatch template

Used by steps 6 (simplify), 7 (audit-tests), and 12 (post-PR review) of `SKILL.md`. All three follow the same two-level fresh-subagent pattern; this file is the canonical prompt so they can't drift.

## Required substitutions

Every call provides:

| Placeholder | Description |
|---|---|
| `<DESC>` | Short orchestrator description shown in the Agent UI (e.g. `"Simplify QA loop orchestrator"`). |
| `<SKILL>` | Skill to dispatch per iteration (`/simplify`, `/audit-tests`, `/pr-review`). |
| `<TARGET>` | What the worker reviews (`branch <branch-name>`, `PR #<pr-number>`). |
| `<COMMIT_RULE>` | Commit + push policy for the worker. See [Commit rules](#commit-rules). |
| `<EXTRA>` | Optional extra constraints — e.g. audit-tests' "implement P1 findings only". Empty for vanilla loops. |

## Commit rules

| Step | Value to substitute for `<COMMIT_RULE>` |
|---|---|
| 6 — simplify | `Commit any fixes as atomic conventional commits. Do not push.` |
| 7 — audit-tests | `Implement and commit fixes for priority-1 findings only. Do not push.` |
| 12 — pr-review | `Commit fixes as atomic conventional commits and push.` |

## Termination (orchestrator-enforced)

Constant across all three steps:

- Stop when a worker reports `STATUS: CLEAN`.
- Stop when a worker reports `COMMITS: 0`.
- Stop after `QA_MAX_ITERATIONS` (default 3).

## Worker contract (every iteration emits exactly this)

```
COMMITS: <n>
STATUS: CLEAN | DIRTY
NOTES: <one-line summary>
```

## Orchestrator final report (back to caller)

```
iterations=<n>, total_commits=<m>, final_status=<CLEAN|STUCK>,
notes_by_iteration=[...]
```

## Canonical Agent prompt

Pass to `Agent` as the orchestrator with `subagent_type: general-purpose`:

```
Orchestrate a <SKILL> QA loop on <TARGET>.

DO NOT review the work yourself. Your only job is to loop and dispatch
fresh worker subagents.

Loop up to 3 iterations. Each iteration, dispatch a new Agent call:

  Agent tool:
    description: "<SKILL> iteration <n>"
    subagent_type: general-purpose
    prompt: |
      Run the <SKILL> skill on <TARGET> right now, as a fresh review.
      You have no prior context — approach the work from scratch and
      do not assume earlier passes exist.
      <EXTRA>
      <COMMIT_RULE>
      At the end, report exactly:
        COMMITS: <n>
        STATUS: CLEAN | DIRTY
        NOTES: <one-line summary>
      CLEAN = no further fixes needed. DIRTY = you applied fixes.

Termination:
- Stop when a worker reports STATUS: CLEAN.
- Stop when a worker reports COMMITS: 0.
- Stop after 3 iterations.

Final report back:
  iterations=<n>, total_commits=<m>, final_status=<CLEAN|STUCK>,
  notes_by_iteration=[...]
```

## Why fresh-per-iteration

A single subagent that has already reviewed a diff will short-cut subsequent passes — it "remembers" what it found and stops looking. Each iteration must start from zero context to give the loop genuine independent passes. The orchestrator enforces this by dispatching a brand-new `Agent` call per iteration; the worker's reported status (`CLEAN`/`DIRTY`/`COMMITS`) is the only signal that crosses iteration boundaries.
