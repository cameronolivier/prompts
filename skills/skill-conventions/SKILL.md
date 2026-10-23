---
name: skill-conventions
description: House-style conventions for authoring Claude Code skills in Cam's workflow — scoped permissions, bundled scripts, committed-file caches over memory, and conservative external API usage. Apply alongside (not instead of) generic skill-writing skills like `write-a-skill` or `skill-development`. Use whenever creating a new skill, editing a SKILL.md, reviewing skill structure, or deciding where repeated logic should live.
allowed-tools:
  - Read
  - Write
  - Edit
model: haiku
---

# Skill Authoring Conventions

> **Recommended model: Haiku** — house-style reference, applied as a checklist. The skill being authored is what may need a heavier model; this layer is just rules.

Personal layer on top of generic skill-writing skills. Those teach structure; this encodes the house style that's been learned the hard way.

## 1. Scope `allowed-tools` tightly

Never leave `Bash` bare.

```yaml
# bad
allowed-tools:
  - Bash

# good
allowed-tools:
  - Bash(gh project:*)
  - Bash(gh auth status:*)
  - Bash(jq:*)
```

Use the colon-suffix form (`cmd:*`) — it's the idiomatic "this prefix plus any args". Multiple entries OR together. Env-var invocations need their own entry: `Bash(GH_DEBUG=*)`.

**Why:** bare `Bash` auto-approves `rm -rf`, `gh auth logout`, anything. Scoped permissions keep blast radius to what the skill actually needs.

## 2. Bundle repeated deterministic ops as scripts

If SKILL.md is about to contain a bash block longer than ~20 lines, or any heredoc that writes files, pull it into `scripts/<action>.mjs` and invoke it from SKILL.md. New scripts are Node (`.mjs`, zero dependencies); bash is fine for a few chained CLI calls.

```
skill-name/
├── SKILL.md
├── scripts/
│   ├── bootstrap.mjs   # one-time setup
│   └── action.mjs      # the thing it does
└── tests/
    └── action.test.mjs # node --test, no network
```

SKILL.md calls scripts through the interpreter and `${CLAUDE_SKILL_DIR}` (`node ${CLAUDE_SKILL_DIR}/scripts/action.mjs <args>`) with flag docs, and pre-approves the same string in `allowed-tools`. A `./scripts/` path resolves against the user's project, not the skill. SKILL.md does **not** reimplement the logic.

**Why:** regenerating complex bash inline each invocation is wasteful, non-deterministic, and error-prone (quoting, heredoc delimiters). Scripts are the deterministic layer; SKILL.md is the when/why.

Always `chmod +x` and syntax-check the scripts (`node --check`, `bash -n`) before shipping.

## 3. Cache per-repo coordinates in committed files

Skills that need stable per-repo data (project IDs, field IDs, external system coordinates) must **not** rely on CLAUDE.md, memory, or conversation-scoped lookups. Cache to a committed file:

- `.github/project.yml` for GitHub project config
- `.claude/<skill>.yml` for other skill-specific state
- The skill provides a `bootstrap.sh` that writes this file once per repo
- The skill's main script(s) read it on every invocation

**Why:** lookups in a loop burn API budget and make routine operations slow. A committed file survives across agents, machines, and teammates. Memory is invisible and per-project; CLAUDE.md is loaded always and costs tokens in every unrelated session.

## 4. Be stingy with external APIs

Skills that hit rate-limited APIs (GitHub especially) must:

- Pre-flight the rate limit before bulk work (e.g. `gh api rate_limit`).
- Cache opaque IDs — don't re-resolve on every call.
- Filter server-side (`--query`, `--search`), not client-side (pulling all + jq).
- Prefer batched queries (single `gh api graphql`) over chained CLI calls.
- Cap `-L` / `--limit`; never default to "fetch all".

If the skill's purpose touches the GitHub CLI, cross-reference the `github-cli-rate-limits` skill so agents pick up the discipline.

**Why:** the GraphQL budget exhausts quickly and locks out for ~1hr. This is a recurring pain, not hypothetical.

## 5. Composability over self-containment

Skills should reference other skills rather than reimplement their logic. If this skill needs to move a project card, it invokes `github-project-status`; it does not re-derive the mutation.

Include the cross-reference in the description or body so the loading agent knows to pull the dependency:

> See `github-cli-rate-limits` for the rate-limit discipline this skill depends on.

## 6. Description must trigger on real user language

The description is the only thing shown to the agent when picking skills. Match how the user actually talks:

- Include concrete trigger phrases in quotes: `"move to In Progress"`, `"mark as Done"`.
- List the automation triggers too: "when starting/finishing/reviewing work on an issue".
- Avoid generic verbs ("helps with", "works on") — the agent can't distinguish those from five other skills.

## 7. Set `model:` in frontmatter to bind cost to need

Claude Code skills accept a `model:` field in YAML frontmatter ([docs](https://code.claude.com/docs/en/skills#frontmatter-reference)). Set it on every owned skill — this binds the runtime model so the skill's cost shape matches the work it actually does.

```yaml
---
name: my-skill
description: ...
allowed-tools: [...]
model: sonnet      # haiku | sonnet | opus
---
```

Picking the right model:

| Tier | When to pick | Examples |
|---|---|---|
| **`haiku`** | Reference / lookup / pure dispatch to a script. No multi-step reasoning. | `cmux-cli`, `github-cli-rate-limits`, `github-project-status` (move.sh does the work), `skill-conventions` |
| **`sonnet`** | Most coding, composing, light judgment, orchestration that delegates the hard parts. | `implement`, `work`, `audit-tests`, `create-pr`, `ask-questions-if-underspecified` |
| **`opus`** | Deep judgment held across a long context — interrogating a plan, drafting credible technical pushback, principal-engineer code review. | `clarify`, `handle-pr-feedback` |

For dispatched subagents within the skill (Agent tool calls), pass `model:` per dispatch — the same alias values. Orchestrator calls (loop + parse `STATUS:`/`COMMITS:` lines) are almost always `haiku`; the worker takes the substantive model.

**Don't infer from precedent.** The docs are authoritative — when in doubt about whether a frontmatter field is supported, fetch [https://code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills) directly. Treating a feature as "probably unsupported" because it isn't in a third-party guide is how you leave money on the table.

## 8. Don't duplicate existing skills

Before creating a skill, check the installed list for overlap. Prefer:

- **Adding to an existing skill** if the scope is close
- **Composing** via cross-references if it's a layer (like this skill composes with `write-a-skill`)
- **Creating new** only when the scope is genuinely distinct

The prompts repo has many skill-writing skills already. This one exists only because "house style" is a distinct layer from "how to structure a skill".

## 9. Length: under 500 lines, front-load for compaction

Keep SKILL.md under 500 lines and move detailed reference material to separate files (Anthropic's guidance).

Two mechanisms drive this:

- Once a skill loads, its body stays in context for every later turn, so every line is a recurring cost. Cut what Claude already knows; keep what it does not.
- After context compaction, Claude Code keeps only the first 5,000 tokens of each invoked skill (25,000 across all of them, filled from the most recently invoked skill, so older skills can drop out entirely). Anything past that cut is lost until the skill is invoked again. So put hard rules / constraints and the output structure near the top, before the long step detail.

Split reference material (field tables, long checklists, per-stage procedure that runs in its own session) into files one level deep from SKILL.md, named for what they hold (`reference.md`, `stage-a-data-flows.md`), each with a table of contents at the top if it is over 100 lines. SKILL.md says what each file holds and when to read it. A reference file costs nothing until it is read.

Sources: <https://code.claude.com/docs/en/skills> and <https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices> (sections "Progressive disclosure" and "Token budgets").

## Checklist before shipping a skill

- [ ] `allowed-tools` scoped with `Bash(cmd:*)` form
- [ ] `model:` set in frontmatter (haiku/sonnet/opus) — match cost to work
- [ ] Per-dispatch `model:` set on every internal `Agent` tool call
- [ ] Repeated bash >20 lines → extracted to `scripts/`
- [ ] Scripts `chmod +x` and `bash -n` clean
- [ ] No reliance on CLAUDE.md / memory for per-repo data
- [ ] External API usage is cached + rate-limit-aware
- [ ] Description has concrete trigger phrases
- [ ] Cross-references any dependency skills
- [ ] SKILL.md body under 500 lines; hard rules / constraints and output structure near the top; reference material in one-level-deep files, with a table of contents when over 100 lines
