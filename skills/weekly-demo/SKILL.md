---
name: weekly-demo
description: Build a weekly "what I did" list and demo slide deck for a client from Cam's own work records (Claude Code sessions, git commits, GitHub PRs, Jira, artifacts), then ask for meeting notes and turn it all into a Slides artifact. Use when the user says "what did I do this week", "list everything I've done since Friday", "weekly demo", "I need to demo my work", "make a slide deck of my week", "weekly update slides", or "/weekly-demo <client>".
allowed-tools:
  - Read
  - Write
  - Edit
  - Agent
  - Artifact
  - AskUserQuestion
  - Bash(date:*)
  - Bash(node ${CLAUDE_SKILL_DIR}/scripts/digest-sessions.mjs:*)
  - Bash(node ${CLAUDE_SKILL_DIR}/scripts/collect-git.mjs:*)
  - Bash(gh search prs:*)
  - Bash(acli jira workitem search:*)
model: sonnet
---

# weekly-demo

Turns a week of the user's work into (1) a complete, sourced list in chat and (2) a Slides artifact they can present. Two gates: the user reviews the list and adds meeting notes before any slide is written.

## Hard rules

- **Only the user's own work for the named client**, inside the window. Team results go in only when the user says so, and are labelled as team work.
- **Every item has a source**: a session digest, commit, PR, Jira ticket or artifact. Never invent a figure, name or status.
- **Read-only gathering.** This skill makes no Jira, GitHub, cloud or Vanta writes. Its only writes are the digests in the job temp dir, the deck files and the Artifact publishes.
- **Before editing any slide after the first publish, read it from the artifact** (`action: "read"`, `path`). The user edits the deck in the page between turns.
- **Slide wording follows `deck-style.md`**, read before writing the first slide: no Jira keys or PR numbers on visible text, plain language, sensitive items generic, the fixed slide order.
- Do not render or screenshot the deck to check it unless the user asks.

## Config

Per-client settings live in `~/.claude/weekly-demo-config.json` (same pattern as `time-track`), outside this repo, so client details are never committed. If the client is missing, ask once with AskUserQuestion and write the entry:

```json
{
  "acme": {
    "projectPrefix": "-Users-me-dev-acme",
    "reposRoot": "/Users/me/dev/acme",
    "authorPattern": "first|last",
    "githubOwner": "Acme-Inc",
    "jiraProject": "OPS",
    "footer": "ACME",
    "lastDeck": "https://claude.ai/artifact/<id>"
  }
}
```

- `projectPrefix`: the `~/.claude/projects/` folder prefix for the client's sessions (covers worktree folders too).
- `jiraProject` is optional. Leave it out when the client has no Jira or `acli` is not signed in.
- `lastDeck`: last week's deck. Update it after each run. Use it as the style reference and for the "what changed since last week" slide.

## Window

Default: last Friday 16:00 local time to now. Run `date` first, because date accuracy matters. Accept the user's own start ("since 4pm SAST Friday"). Convert to UTC ISO for the scripts.

## Step 1: gather (parallel where independent)

1. **Sessions.** Run:
   `node ${CLAUDE_SKILL_DIR}/scripts/digest-sessions.mjs --since <ISO> --prefix <projectPrefix> --out $CLAUDE_JOB_DIR/tmp/weekly-demo --groups 4 --exclude <this session id>`
   It prints JSON with every in-window session (first prompt, digest path, size) and 4 size-balanced groups.
2. **Git:** `node ${CLAUDE_SKILL_DIR}/scripts/collect-git.mjs --root <reposRoot> --since <ISO> --author '<authorPattern>'`
3. **PRs** (capped, server-side filters; see `github-cli-rate-limits`):
   `gh search prs --author=@me --owner=<githubOwner> --created='>=<date>' --limit 100 --json repository,number,title,state` and a second call with `--updated='>=<date>' --created='<<date>'` for older PRs merged this week.
4. **Jira** (optional): `acli jira workitem search --jql 'project = <key> AND reporter = currentUser() AND created >= "<date time>"' --fields key,summary,status --limit 200 --csv`, plus the same for `updated` on tickets created before the window.
5. **Artifacts:** `Artifact` with `action: "list"`, keeping the user's own pages updated inside the window.

## Step 2: summarise the sessions

Spawn one `Agent` per digest group, all in one message, `subagent_type: "general-purpose"`, `model: "sonnet"`. Give each its file paths in the first prompt; a missing file list wastes the run. Ask each for, per session:
- the topic
- outcomes, marked DONE, PLANNED or RESEARCHED, or BLOCKED and on whom
- real-world writes (cloud, Jira, GitHub, artifacts, with keys and URLs)
- evidence that could be shown or screenshotted

Tell agents to skip work for other clients and not to invent. While they run, do not read the digests yourself.

## Step 3: the list (gate 1)

Merge the agent reports with steps 1.2 to 1.5. Drop items created before the window start (check Jira creation times against the window). Reply in chat, grouped by theme (security, cost, plan, investigations, process):
- each item with its concrete figure
- a table of artifacts touched
- 5 to 9 ranked ideas for what to show

End by asking for meeting notes or DSU summaries. When they arrive, add items they reveal, correct entries they contradict, and keep the user's own work apart from team work.

## Step 4: the deck (gate 2: user asked for slides)

1. `Artifact` `action: "quickstart"`, `intent: "slides"`. Publish with the Slides `type_url`, a title like "<Client> Week of <date>" and `auto_open: "after_first_write"`. Follow the type instructions it returns.
2. Read `${CLAUDE_SKILL_DIR}/deck-style.md`. Write the files under a folder in the working directory (the Artifact `root` must be in the working directory or the scratchpad, not `$CLAUDE_JOB_DIR`): `project/deck.json` first, then the cover. Publish both, then publish the rest in batches.
3. Speaker notes carry the detail that is not on the slide: keys, commands, caveats, "check before saying".
4. Reply with the slide list and every caveat (unverified items, sensitive content, private links), then the link.

## Step 5: revise

Expect many small rounds. For each round:
- read the slide (or the index) from the artifact, edit, and publish only the changed files
- when a slide is removed, also remove it from `order` and repoint any section `start`
- when a fact changes (for example a consultant replies or a decision is confirmed), update every slide that mentions it, and update the matching memory note

After the deck is final, set `lastDeck` in the config.

## Files

- `scripts/digest-sessions.mjs`: window filter, digests, balanced groups. Tests: `node --test ${CLAUDE_SKILL_DIR}/tests/digest-sessions.test.mjs`.
- `scripts/collect-git.mjs`: the user's commits per repo in the window.
- `deck-style.md`: wording, claims, slide order, patterns and palette. Read before writing slides.
