---
name: voice-rules
description: Cam's writing rules, split by reader. Agent rules (A1–A12) for text an agent consumes, such as SKILL.md, CLAUDE.md, AGENTS.md and subagent prompts. Human rules (H1–H11) for text a person reads, such as PR bodies, review comments, READMEs, Slack and email. Use when writing or reviewing either kind, when another skill cites a rule ID such as "H2" or "A6", or to lint a file with the bundled voice-lint.
allowed-tools:
  - Read
  - Bash(node ${CLAUDE_SKILL_DIR}/scripts/voice-lint.mjs *)
model: inherit
---

# Voice rules

Two rule sets, chosen by **who reads the text**. Agent rules make an agent take the same path every run. Human rules make a person understand on the first read. A text gets one set, never both.

Rule IDs are stable. Other skills cite them (`skill-review` reports "H2" or "A6"). A removed rule leaves a gap in the numbering.

## Which set applies

| Text | Reader | Set |
|---|---|---|
| SKILL.md body, skill reference files, CLAUDE.md, AGENTS.md, subagent and dispatch prompts, hook output | agent | A |
| README, PR body and title, commit message body, review and issue comments, Slack, email, docs others read | human | H |
| Templates of output a person will see (a comment format, a report skeleton), even inside a SKILL.md | human | H |
| A skill's `description` | agent | A1 |
| Chat replies to Cam | human | H, with H10's terse register |

When unsure, ask "who reads this first?" and use that reader's set.

## Agent rules

Sources: Matt Pocock's `writing-for-agents`, Anthropic's prompting guidance. These rules shape behaviour. Grammar and polish matter only where they change what the agent does.

- **A1 Pointer wording.** A description or any line that points at other material says what the material is, then lists one trigger per distinct case. The leading word comes first. Synonyms for one case collapse into one trigger.
- **A2 Information hierarchy.** Steps sit in the main file, in order. Reference that every branch needs sits in the file. Reference that only some branches need moves to a sibling file behind a pointer that says when to read it.
- **A3 Co-location.** A concept's definition, rules and caveats sit under one heading.
- **A4 Completion criteria.** Every step ends on a condition the agent can check, and the condition demands the full job ("every changed skill reviewed", not "review the skills").
- **A5 Leading words.** One existing word, repeated as a token, anchors a behaviour (_tight_, _red_, _evidence_). A triad restated at three sites collapses into one word.
- **A6 Positive instructions.** State the target behaviour. A prohibition appears only as a hard guardrail, paired with what to do instead.
- **A7 Calm emphasis.** Plain imperatives. Capitals, "CRITICAL" and "MUST" are kept for one or two real guardrails per file. Current models over-apply shouted rules.
- **A8 Single source of truth.** Each meaning lives in one place. Text that restates the environment (`package.json`, `--help`, the folder layout) earns its place only when the lookup is expensive.
- **A9 No no-ops.** Cut every sentence the model already obeys by default. Delete the whole sentence, not words from it.
- **A10 Relevance.** Every line bears on what the document does today. Stale lines go.
- **A11 One term per concept.** Pick a word and reuse it exactly.
- **A12 Terse, never ambiguous.** Fragments and arrows are fine when only one reading exists. Spell it out when two readings exist.

## Human rules

Sources: `unslop` (rule numbers in brackets) and Cam's CLAUDE.md.

- **H1 Lead with the answer.** The outcome comes first, detail follows.
- **H2 No em-dashes** in text a person receives as Cam's words. Use a full stop, a comma or parentheses. Dashes in tables and code are fine. Internal working notes are exempt.
- **H3 Plain words.** "use" not "leverage", "help" not "facilitate", no AI vocabulary such as delve, crucial, pivotal, robust or seamless [7, 31].
- **H4 Say what it does.** Name the mechanism, the number or the command, not the feeling [27].
- **H5 Active voice.** Name the actor. Passive is fine when the actor is unknown [29].
- **H6 One idea per sentence.** Split a sentence the reader has to read twice [28].
- **H7 No filler or hedging.** `to`, not `in order to`. `may`, not `could potentially` [23, 24].
- **H8 No chatbot register.** No "Great question", "I hope this helps", "Certainly" [20, 22].
- **H9 Plain formatting.** Sentence-case headings, straight quotes, bold only where the eye needs it, no decorative emoji, no bold-label lists that restate the label [15–19].
- **H10 Register by reader.** Chat reports to Cam are extremely concise, and grammar may go (see `terse`). Text others read uses whole sentences with articles and verbs [33]. Mild imperfection, such as a casual comma splice, is fine and reads human.
- **H11 Literal over figurative.** No metaphor nouns (vector, surface, north star) and no mannered phrasing [26, 32].

## Lint

`voice-lint` checks the parts of the rules a script can decide. Every rule except A7, H2, H3, H8 and H9 needs a reader as well; the linter only screens H5, H6 and H7 for candidates.

```bash
node ${CLAUDE_SKILL_DIR}/scripts/voice-lint.mjs [--json] [--audience auto|agent|human] <file>...
```

Requires Node 18 or later, no packages. `--audience` names the reader, and so the set: `auto` (the default) picks it by file name. `README*`, `*template*`, `*comment-format*` and `*.txt` are human; all other `.md` files are agent. Code fences and tables are skipped; wrapped lines are checked as one paragraph. Each finding carries its rule ID and a severity: `error` breaks the rule, `note` is a heuristic that needs a reader to confirm. Exit 0 means no errors, 1 means errors, 2 means a usage error or a file it could not read.

| Lint rule | Rule | Set | Severity |
|---|---|---|---|
| `em-dash` | H2 | human | error |
| `ai-vocab` | H3 | human | error |
| `ai-vocab-soft` (underscore, enhance, garner, testament) | H3 | human | note |
| `plain-word` | H3 | human | note |
| `filler` | H7 (human), A9 (agent) | each | note |
| `chatbot` | H8 | human | error |
| `curly-quote` | H9 | human | error |
| `heading-emoji` | H9 | human | error |
| `passive` | H5 | human | note |
| `long-sentence` (over 30 words) | H6 | human | note |
| `shouting` (3+ all-caps imperatives per file) | A7 | agent | note |
