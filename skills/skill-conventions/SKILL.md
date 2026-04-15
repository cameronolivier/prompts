---
name: skill-conventions
description: House-style conventions for authoring Claude Code skills in Cam's workflow — scoped permissions, bundled scripts, committed-file caches over memory, and conservative external API usage. Apply alongside (not instead of) generic skill-writing skills like `write-a-skill` or `skill-development`. Use whenever creating a new skill, editing a SKILL.md, reviewing skill structure, or deciding where repeated logic should live.
allowed-tools:
  - Read
  - Write
  - Edit
---

# Skill Authoring Conventions

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

If SKILL.md is about to contain a bash block longer than ~20 lines, or any heredoc that writes files, pull it into `scripts/<action>.sh` and invoke it from SKILL.md.

```
skill-name/
├── SKILL.md
└── scripts/
    ├── bootstrap.sh    # one-time setup
    └── action.sh       # the thing it does
```

SKILL.md references scripts by relative path (`./scripts/action.sh <args>`) with flag docs. It does **not** reimplement the logic.

**Why:** regenerating complex bash inline each invocation is wasteful, non-deterministic, and error-prone (quoting, heredoc delimiters). Scripts are the deterministic layer; SKILL.md is the when/why.

Always `chmod +x` and `bash -n` the scripts before shipping.

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

## 7. Don't duplicate existing skills

Before creating a skill, check the installed list for overlap. Prefer:

- **Adding to an existing skill** if the scope is close
- **Composing** via cross-references if it's a layer (like this skill composes with `write-a-skill`)
- **Creating new** only when the scope is genuinely distinct

The prompts repo has many skill-writing skills already. This one exists only because "house style" is a distinct layer from "how to structure a skill".

## Checklist before shipping a skill

- [ ] `allowed-tools` scoped with `Bash(cmd:*)` form
- [ ] Repeated bash >20 lines → extracted to `scripts/`
- [ ] Scripts `chmod +x` and `bash -n` clean
- [ ] No reliance on CLAUDE.md / memory for per-repo data
- [ ] External API usage is cached + rate-limit-aware
- [ ] Description has concrete trigger phrases
- [ ] Cross-references any dependency skills
- [ ] SKILL.md under ~150 lines (split into REFERENCE.md if longer)
