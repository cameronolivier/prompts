# `cam/prompts` work/implement — grill + RPI flow (portable design spec)

> **Status:** design spec, to be implemented on a different machine. **Not** executed in this repo.
> **Why this is a spec, not a bite-sized plan:** the `/rpi:[research|plan|implement]` skill set is a
> personal markdown skill set the author assembled from elsewhere — it is **not installed on the
> machine where this was written**, so its exact interface (command names, args, artifact paths,
> whether it carries its own TDD/QA) cannot be inspected here. This doc captures *what we want and how
> we want it*; the implementer fills the rpi-specific blanks (flagged as **[CONFIRM]**) against the
> real skills, then can run `/write-plan` on the other machine to expand it into a bite-sized plan.

> **Relationship to the mo-ai flow:** the `mohara/mo-ai` `tide`/`tide-agent` flow is a *different*
> design (brainstorm → write-plan → Tidal tail), specified in
> the `mohara/mo-ai` repo (`docs/moai/plans/2026-06-29-tide-brainstorm-flow.md`) and against the approved
> `docs/moai/specs/2026-06-26-tide-brainstorm-flow-design.md` (in `mohara/mo-ai`). **This `cam/prompts` flow is NOT a
> lockstep port of that** — it deliberately diverges on the front gate (grilling, not brainstorm) and
> the mid pipeline (rpi research→plan→implement, not write-plan). Only the *structure* (a resumable,
> artifact-first, stage-driven state machine in `implement`, driven by `work`) is shared.

---

## Goal

Give `cam/prompts`' `work` (orchestrator) and `implement` (per-issue agent) an upfront design gate and
a research-driven planning pipeline, while keeping the proven QA/PR tail:

- **Front gate:** `grill-with-docs` (Matt-Pocock-style relentless interview that also emits ADRs +
  glossary via `/domain-modeling`) — replaces a brainstorm step. Interactive only.
- **Mid pipeline:** the author's own `/rpi:research → /rpi:plan → /rpi:implement` skill set — replaces
  the thin inline plan + drives the build. Baked into `implement` the same way the current implement
  step is baked into the workflow.
- **Back tail:** unchanged — the existing `implement` QA loops (simplify / audit-tests / pr-review via
  `references/qa-loop-prompt.md`), ADR check, verify, draft PR.

## Carried-over decisions (from the mo-ai design, still apply here)

These hold verbatim — they are about *flow structure*, not which skills fill each stage:

- **Resumable, artifact-first state machine.** `implement` reads a `stage` field from
  `.olvrcc/status/issue-N.json` and routes; it writes the next `stage` after each arm. Artifacts
  confirm; `stage` decides. A resumed lane never redoes finished work.
- **Front gate always leads, skipped iff an artifact exists.** The design gate is stage 1; it is
  skipped only when a spec artifact already exists on the branch, or the human waives it.
- **Never invent a design.** Headless / AFK lanes that need a human end gracefully with
  `blocked:needs-spec`; the consolidated `work` report lists them for interactive follow-up.
- **Front reused, back kept.** Grilling + rpi are invoked as canonical skills (no vendoring, no lite
  copies). The existing QA/PR tail is unchanged.
- **Human opt-out.** A wave-level flag and a per-lane "skip grill for #N" let a human waive the
  interview; the issue body becomes the spec. The agent never waives it on its own.

## New / changed decisions (specific to grill + rpi)

1. **Front gate is `grill-with-docs`, not `brainstorm`.** `grill-with-docs` runs `/grilling` (a
   one-question-at-a-time interview) plus `/domain-modeling` (ADRs + glossary). It is **more**
   interactive than brainstorm and produces **no single spec file on its own**.
2. **Implement must persist the spec after grilling.** Because grilling yields shared understanding +
   ADRs/glossary but no consolidated spec doc, the `needs_spec` arm writes the agreed design to a spec
   file after the interview converges, so the artifact-first short-circuit has something to key on.
   **[CONFIRM]** the spec path convention on the target machine (suggested: `docs/specs/<issue>-<slug>.md`).
3. **Mid pipeline is rpi research → plan.** `/rpi:research` produces a research artifact; `/rpi:plan`
   produces the implementation plan artifact. This adds a **`needs_research`** stage ahead of
   `needs_plan` that the mo-ai flow does not have.
4. **Build is `/rpi:implement`, baked into `implement`.** The `needs_build` arm calls `/rpi:implement`
   for the actual TDD build, in place of today's inline TDD step — "baked in as we have for the
   implement step into our existing implement in the workflow."
5. **Grilling needs a real window.** A full grilling interview cannot happen over a turn-based
   `NEEDS-INPUT` relay. So: interactive cmux/tmux window → grill in-window; agent dispatch (even
   attended) → `NEEDS-INPUT` is only viable for a *narrow* point question, otherwise the lane writes
   `blocked:needs-spec`; headless → `blocked:needs-spec`.

## Stage state machine (cam/prompts)

```text
needs_spec → needs_research → needs_plan → needs_build → building → agent_complete
     ↘ blocked:needs-spec   (front gate could not get a spec; no human window)
```

| Stage | Arm | Fills it | Human gate? |
|-------|-----|----------|-------------|
| `needs_spec`        | grill-with-docs → write spec | `/grilling` + `/domain-modeling`, then persist spec | yes (interactive window) |
| `needs_research`    | `/rpi:research` | rpi | no |
| `needs_plan`        | `/rpi:plan`     | rpi | no |
| `needs_build`       | `/rpi:implement` | rpi (baked into `implement`) | no |
| `building`          | existing QA/PR tail (simplify / audit-tests / verify / ADR / draft PR / pr-review) | `implement`'s current tail | no |
| `agent_complete`    | report + draft PR handoff | `implement` | — |
| `blocked:needs-spec`| graceful stop, surfaced in `work` report | `implement` | — |

Nests under the lifecycle `status` (`pending → in_progress → agent_complete → in_review → complete /
failed`) exactly as in the mo-ai design; `stage` describes where an `in_progress` lane sits.

## Status file schema (`.olvrcc/status/issue-N.json`)

```json
{
  "issue": 12,
  "title": "<title>",
  "status": "in_progress",
  "stage": "needs_spec",
  "spec": null,
  "research": null,
  "plan": null,
  "skip_grill": false,
  "attended": true,
  "dispatch": "cmux"
}
```

- `spec` / `research` / `plan` — paths to the committed artifacts once produced (`spec` = `"issue-body"`
  when grilling is waived).
- `skip_grill` — wave/lane waived the interview.
- `attended` — `true` when a human is reachable (interactive window or non-headless agent dispatch).
- `dispatch` — `cmux` / `tmux` (window) or `agent` (sub-agent).

## Implementation surface

### `skills/implement/SKILL.md` (the per-issue state machine)

Mirror the *structure* of the mo-ai `tide-agent` rewrite
(the `mohara/mo-ai` repo (`docs/moai/plans/2026-06-29-tide-brainstorm-flow.md`), Tasks 1–3) with these cam/prompts changes:

1. **Stage model + routing dispatcher** — same as mo-ai Task 1, but:
   - status path `.olvrcc/status/issue-N.json`;
   - stage set is `needs_spec → needs_research → needs_plan → needs_build → building → agent_complete`
     (+ `blocked:needs-spec`) — one extra stage (`needs_research`) vs mo-ai;
   - the routing table sends `needs_research` to the rpi-research arm.

2. **`needs_spec` arm — grill-with-docs gate** (replaces mo-ai Task 2's brainstorm arm):
   - **Artifact-first:** if `spec` is set or `docs/specs/*<slug>*.md` **[CONFIRM path]** exists →
     record path, `stage = needs_research`, skip.
   - **Opt-out:** `skip_grill: true` or "skip grill for #N" → `spec = "issue-body"`,
     `stage = needs_research`, skip.
   - **Attendance:** cmux/tmux window → grill in-window; agent dispatch + attended → narrow
     `NEEDS-INPUT` relay only, else block; headless → block.
   - **Grill in-window:** invoke `/grill-with-docs` seeded with the issue body. When the interview
     converges, **persist the agreed design** to the spec path, commit it (and any ADRs/glossary
     emitted under the domain-modeling convention), comment the link on the issue, record `spec`,
     set `stage = needs_research`.
   - **No window / no human:** `stage = blocked:needs-spec`, comment, stop. (Grilling cannot run over
     a relay.)

3. **`needs_research` arm — `/rpi:research`** (new, no mo-ai equivalent):
   - Artifact-first on `research` path **[CONFIRM where `/rpi:research` writes]**.
   - Invoke `/rpi:research` against the spec. Commit + comment the artifact. `stage = needs_plan`.

4. **`needs_plan` arm — `/rpi:plan`** (replaces mo-ai Task 3's write-plan arm):
   - Artifact-first on `plan` path **[CONFIRM where `/rpi:plan` writes]**.
   - Invoke `/rpi:plan` against spec + research. Commit + comment. `stage = needs_build`.

5. **`needs_build` arm — `/rpi:implement`** (replaces the inline TDD step):
   - Invoke `/rpi:implement` against the plan. **[CONFIRM]** whether `/rpi:implement` runs its own
     TDD/red-green loop and commits; if so the existing inline TDD step is removed and this arm just
     delegates. If `/rpi:implement` does **not** TDD, keep the existing TDD discipline around it.
   - On completion, `stage = building`.

6. **`building` arm — existing tail, unchanged:** simplify / audit-tests / verify / ADR / draft PR /
   post-PR pr-review via `references/qa-loop-prompt.md`. Renumber headings to follow the new arms.
   `stage = agent_complete` at the end. **[CONFIRM]** there's no responsibility overlap between
   `/rpi:implement` and the existing simplify/audit loops (if rpi already simplifies, avoid running it
   twice).

### `skills/work/SKILL.md` (the orchestrator)

Mirror the mo-ai `tide` edits (Tasks 4–7) with cam/prompts substitutions:

- **Status schema + stage model table** — add `stage`, `spec`, `research`, `plan`, `skip_grill`,
  `attended`; document the 6-stage machine. (mo-ai Task 4, `.olvrcc/status`.)
- **Attended flag** — set per dispatch + headless, write into each status file. (mo-ai Task 4.)
- **`--skip-grill` wave flag** (analogue of `--skip-brainstorm`) + per-lane "skip grill for #N"
  handled in `implement` step 2. (mo-ai Task 5.)
- **`NEEDS-INPUT` relay + `SendMessage`** — same mechanism, but document that for this flow the relay
  only handles a *narrow* clarifying question; a full grilling interview requires an interactive
  window, so most un-spec'd headless/agent lanes go straight to `blocked:needs-spec`. (mo-ai Task 6.)
- **Report + headless note + prerequisites** — surface `blocked:needs-spec` in the consolidated
  report; note headless requires pre-existing specs; document prerequisites: the `grill-with-docs` /
  `grilling` / `domain-modeling` skills **and** the `/rpi:*` skill set must be installed (artifact-first
  degradation is the graceful fallback when a skill is missing but the artifact exists). (mo-ai Task 7.)

### No version bump

`cam/prompts` is a skills repo (no `marketplace.json`), so there is no plugin-version bump step.

## Open questions / [CONFIRM] checklist (resolve against the real rpi skills)

- [ ] `/rpi:*` exact command namespace and how each is invoked (args, seeding).
- [ ] Where `/rpi:research` and `/rpi:plan` write their artifacts → set the artifact-first glob and
      the `research` / `plan` status paths to match.
- [ ] Whether `/rpi:implement` owns TDD + commits, or expects the caller to. Decides whether the old
      inline TDD step is removed or retained around it.
- [ ] Whether `/rpi:implement` overlaps the existing simplify/audit tail (avoid double work).
- [ ] Spec persistence path/convention after `grill-with-docs` (suggested `docs/specs/<issue>-<slug>.md`);
      align with where `/domain-modeling` writes ADRs + glossary.
- [ ] Is `needs_research` always run, or skippable for trivial issues (e.g. when the spec is small)?
      Mirror brainstorm's complexity-scaling instinct if rpi supports it.

## Next step (on the target machine)

1. Install / copy in the `/rpi:*` skills and confirm `grill-with-docs`, `grilling`, `domain-modeling`
   are present.
2. Resolve every **[CONFIRM]** above.
3. Run `/write-plan` on this spec to expand it into a bite-sized, TDD-structured plan, then `/build`.
4. Cut a branch off `main` in `cam/prompts`, implement, open its own PR.
