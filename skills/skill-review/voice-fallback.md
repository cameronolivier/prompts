# Voice rules (fallback snapshot)

A copy of the rule sections of the voice-rules skill, for when that skill is not installed. Cite the same IDs. `tests/voice-fallback.test.mjs` fails when this copy drifts from the source.

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
