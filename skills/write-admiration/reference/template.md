# Admiration template

Output as a single Slack message, ready to copy-paste. Slack mrkdwn, not standard markdown: `*bold*` not `**bold**`, inline-code backticks render as chips.

```
ANNOUNCEMENT!! :tada: @channel
`Congratulations to` <@RECEIVER/S>
`You've got` the *<BADGE>* badge `from` @Cam
`Thank you for living out the MOHARA values of` <VALUE_CODE>, <VALUE_CODE>...
`Notes`
<DESCRIPTION>
```

Field notes:

- **`@channel`** — always included. This was missed in the original template but every real post tags the channel.
- **`<@RECEIVER/S>`** — one person, several named people, or a team. Use Slack `@mention` format for named people.
- **`<BADGE>`** — freely generated per situation, not from a fixed list. See SKILL.md style rules and `examples.md` for tone.
- **Badge name is always bold** (`*...*` in Slack mrkdwn).
- **`from @Cam`** — always the sender, since this is a personal skill.
- **Value codes** — comma-separated (e.g. `MO_PRO, MO_GRO`), short codes not full names. See `values.md`.
- **`Notes`** — the description. Multi-paragraph is fine, casual tone, emojis welcome. See SKILL.md style rules.
- **Honourable mentions** — an optional extra sub-section (not in the core template) naming people who contributed but aren't primary recipients. Only include it if the input actually calls for it — don't force it.
