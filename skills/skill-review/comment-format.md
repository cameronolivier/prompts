# Comment format

What a person sees: the chat report, the posted summary and the inline comments. These templates are human text, so voice-rules H rules apply.

## Chat report

```markdown
## Skill review: <PR #n title | path>

**Verdict:** changes needed | worth fixing | no material findings
<one sentence: what the change does and the main risk, if any>

Reviewed: <skill folders>, with <n> eval files.
Baselines: skill-conventions, best-practice.md (distilled <date>), voice-rules<, fallback snapshot if used>.
Not checked: BP-S12, BP-S8 (skills-ref not installed: `pipx install skills-ref`), if skills-ref did not run.

### Must fix
| Where | Rule | Finding | Breaks |
|---|---|---|---|
| `skills/x/SKILL.md:12` | SC-1 | Bash pre-approved without a scope | any command runs without a prompt |

### Should fix
<same table>

### Notes
- `path:line` RULE: one line each.

### Already raised
- `path` RULE: open thread on the PR, not posted again.

### Dropped
- <title>: missing <location | rule | breaks>, or <the reason verification dropped it>.

### Skipped
- <reason>: `path`, `path`
```

Omit an empty section. With no findings at all, the report is the heading, the verdict, the Reviewed line, and the Not checked line and Skipped section when they have content. "Already raised" appears only on a PR with earlier skill-review threads. "Dropped" lists every finding the evidence contract or verification removed, so a person can overrule the filter. "Skipped" lists every changed file that no skill claims, so no part of the change goes unreported.

## Posted review

`post-review.mjs` builds the review from `review.json`. Write the `summary` field like this:

```markdown
**skill-review:** <verdict>. <must count> must fix, <should count> should fix, <note count> notes.

<one or two sentences on the main risk, or "No material findings." when clean>

<details><summary>Notes</summary>

- `path:line` RULE: one line each

</details>
```

Each finding's `title` is the claim in a few words. Its `body` is two or three sentences for the PR author: what is wrong, why it matters (the `breaks` line), and the fix. Quote the rule when the reader needs its words to act. The script adds the severity, the rule ID and the hidden marker.

Must and should findings go inline. A line outside the diff cannot take an inline comment, so the script moves it to an "Outside the diff" list in the summary. Notes stay in the summary's `<details>` block.
