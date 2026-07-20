---
name: write-admiration
description: Draft a MOHARA "Admiration" — a Slack recognition post following the team template, thanking someone for living out a company value with a fun badge. Use when the user runs /write-admiration, says "write an admiration for X", "write me an admiration", or wants to recognize/celebrate a colleague or team's work with a values-badge Slack post.
model: sonnet
allowed-tools:
  - Read(./reference/*)
---

# Write Admiration

Draft a single Slack "Admiration" post: a `:tada:` announcement thanking someone (or several people, or a team) for living out a MOHARA value, with a freely-invented badge name. The user posts it themselves (not via bot) — this skill only produces the draft text.

Read `./reference/template.md` and `./reference/values.md` before drafting.

## Flow

1. **Gather the situation.** Take whatever the user gives freeform (who it's for, what happened, why it matters). Ask targeted follow-up questions only for whatever's missing to fill the template — don't run a rigid interview if the input is already complete.
2. **Identify recipients.** Could be one person, several named people, or a whole team — use Slack `@mention` format for named people.
3. **Infer the value(s).** Match the situation against `./reference/values.md`. Attach as many value codes as legitimately apply — no artificial cap.
4. **Invent a badge name.** Freely generated per situation, not from a fixed list (see style below).
5. **Draft the Notes section** (see style below).
6. **Self-check silently** against `./reference/template.md` — every required field present, `@channel` included, badge bolded — before showing anything.
7. **Present the draft** together with your reasoning: which value(s) you picked and why, the badge name and why. Then the full draft, ready to copy-paste into Slack.
8. **Iterate conversationally** on feedback until it's ready.

## Style rules (distilled from real examples)

**Badge names:** short, punchy, in-joke or project-flavored where possible (referencing the project name, a running joke, or the specific thing they did) — e.g. a project-themed pun, "___ Believers", "Freaking Amazing", "Quietly Diligent", "GOAT", "Ready to Rumble", a title-case honorific. Title Case, usually 2-6 words. Occasionally an emoji inline after the name. Always bold in the final output.

**Notes / description:** second person, warm and direct, casual register — not corporate. 1-4 paragraphs. Emojis used naturally, not decoratively spammed. Fine to open with something like "2 things:" or a direct address. A short sign-off is common but optional ("Thank you so so much! ❤️", "Keep it up bro!"). If the situation genuinely calls for it, an optional **Honourable mentions** line can follow the main notes, naming secondary contributors and why — only add this when the input calls for it, don't force it.

**Value codes:** comma-separated short codes (`MO_PRO, MO_GRO`), not full names.

**Formatting:** Slack mrkdwn (`*bold*`, not `**bold**`). The four labeled fields (`Congratulations to`, `You've got`, `from`, `Thank you for living out the MOHARA values of`, `Notes`) render as inline-code chips — keep them exactly as in the template, don't reword them.
