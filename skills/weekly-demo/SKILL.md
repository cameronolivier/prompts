---
name: weekly-demo
description: Build a weekly work list and demo slide deck for any project, either for the user's own work (from their Claude Code sessions, git, GitHub PRs, Jira and artifacts) or for the whole team (from a pasted team update plus team-wide git, PRs and Jira), then turn it into a Slides artifact. Use when the user says "what did I do this week", "list everything I've done since Friday", "weekly demo", "I need to demo my work", "make a slide deck of my week", "team update slides", "slides of the team's week", or "/weekly-demo <project> [team]".
argument-hint: "<project name or path> [team]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Agent
  - Artifact
  - AskUserQuestion
  - Bash(date:*)
  - Bash(node ${CLAUDE_SKILL_DIR}/scripts/detect-project.mjs:*)
  - Bash(node ${CLAUDE_SKILL_DIR}/scripts/digest-sessions.mjs:*)
  - Bash(node ${CLAUDE_SKILL_DIR}/scripts/collect-git.mjs:*)
  - Bash(gh search prs:*)
  - Bash(acli jira workitem search:*)
model: sonnet
---

# weekly-demo

Turns a week of work on one project into (1) a complete, sourced list in chat and (2) a Slides artifact to present. Two gates: the user reviews the list and adds notes before any slide is written.

Arguments: `/weekly-demo <project> [team]`.
- `<project>`: a name in the config, or a folder path. With no argument, use the current working directory.
- `team`: build the team's deck instead of the user's. Default is the user's own work ("me").

## Hard rules

- **One project, one window.** Only work for the named project, inside the window.
- **Me mode: only the user's own work.** Team results go in only when the user says so, and are labelled as team work.
- **Team mode: credit people by name** where the source names them, and say "we" where it does not. Never credit the user with a teammate's work.
- **Every item has a source**: a session digest, commit, PR, Jira ticket, artifact or the user's notes. Never invent a figure, name or status.
- **Read-only gathering.** No Jira, GitHub, cloud or compliance-tool writes. The only writes are the config entry, the digests in the job temp dir, the deck files and the Artifact publishes.
- **Before editing any slide after the first publish, read it from the artifact** (`action: "read"`, `path`). The user edits the deck in the page between turns.
- **Slide wording follows `deck-style.md`.** Read it before writing the first slide. It covers: no ticket keys or PR numbers on visible text, plain language, generic wording for sensitive items, and the slide order.
- Do not render or screenshot the deck to check it unless the user asks.

## Project config

Settings live in `~/.claude/weekly-demo-config.json`, one entry per project, outside this repo, so client details are never committed.

Resolve `<project>` in this order:
1. **A name in the config:** use that entry.
2. **A folder path, or no argument:** run `node ${CLAUDE_SKILL_DIR}/scripts/detect-project.mjs --path <folder>`. It prints:
   - the Claude history prefix for the folder
   - the repos root (the folder itself when it is one repo)
   - the most common GitHub owner across the repos' remotes
   - an author pattern from the git user name and email
   - a footer name
3. **Fill the gaps once with AskUserQuestion:**
   - the project's display name
   - a Jira project key (optional)
   - missing values, for example a repo with no GitHub remote

   Then save the entry under its name.

```json
{
  "acme": {
    "projectPrefix": "-Users-me-dev-acme",
    "reposRoot": "/Users/me/dev/acme",
    "authorPattern": "first|last",
    "githubOwner": "Acme-Inc",
    "jiraProject": "OPS",
    "footer": "ACME",
    "lastDeck": { "me": "https://claude.ai/artifact/<id>", "team": "https://claude.ai/artifact/<id>" }
  }
}
```

- `projectPrefix`: the `~/.claude/projects/` folder prefix for the project's sessions. It covers worktree folders too.
- `jiraProject`: optional. Leave it out when there is no Jira or `acli` is not signed in.
- `lastDeck`: last week's deck per mode. Update it after each run. Use it as the style reference and for the "what changed since last week" slide.

## Window

Default: last Friday 16:00 local time to now. Run `date` first, because date accuracy matters. Accept the user's own start ("since 4pm SAST Friday"). Convert to UTC ISO for the scripts.

## Step 1: gather (parallel where independent)

| Source | Me mode | Team mode |
|---|---|---|
| Claude sessions | `digest-sessions.mjs` (below) | Skip. Only the user's history is on this machine. Include it only when the user asks to show their part too. |
| Git | `collect-git.mjs --root <reposRoot> --since <ISO> --author '<authorPattern>'` | `collect-git.mjs --root <reposRoot> --since <ISO> --team` (every author, named) |
| PRs | `gh search prs --author=@me --owner=<githubOwner> …` | `gh search prs --owner=<githubOwner> --merged='>=<date>' …` (all authors) |
| Jira | `reporter = currentUser()` or `assignee = currentUser()` | the whole project; resolved and in-progress items |
| Artifacts | `Artifact` `action: "list"`, the user's pages updated in the window | the same, only the ones that hold team plans |
| Notes | asked for at gate 1 | **required input:** ask for the team update (DSU notes, meeting summary, governance update) before gathering |

- **Sessions (me mode):** `node ${CLAUDE_SKILL_DIR}/scripts/digest-sessions.mjs --since <ISO> --prefix <projectPrefix> --out $CLAUDE_JOB_DIR/tmp/weekly-demo --groups 4 --exclude <this session id>`. It prints JSON with every in-window session (first prompt, digest path, size) and 4 size-balanced groups.
- **PRs:** add `--limit 100 --json repository,number,title,state,author` to every search. In me mode, add a second search with `--updated='>=<date>' --created='<<date>'` to catch older PRs merged this week. See `github-cli-rate-limits`.
- **Jira:** `acli jira workitem search --jql '<filter> AND (created >= "<date time>" OR updated >= "<date time>")' --fields key,summary,status,assignee --limit 200 --csv`.

## Step 2: summarise

- **Me mode:** spawn one `Agent` per digest group, all in one message: `subagent_type: "general-purpose"`, `model: "sonnet"`. Put the file paths in the first prompt; a missing file list wastes the run. Ask each agent for, per session:
  - the topic
  - outcomes, marked DONE, PLANNED, RESEARCHED or BLOCKED (and on whom)
  - real-world writes, with keys and URLs
  - evidence that could be shown
  
  Tell the agents to skip other projects and not to invent anything. While they run, do not read the digests yourself.
- **Team mode:** no session agents. Match the team update against git, PRs and Jira yourself:
  - Confirm each claim from a source.
  - Note who did each item.
  - Flag claims with no evidence instead of dropping them.

## Step 3: the list (gate 1)

Merge everything. Drop items from before the window start (check Jira creation times). Reply in chat, grouped by theme (security, cost, plan, features, fixes, process):
- each item with its concrete figure (and its owner, in team mode)
- a table of artifacts touched
- 5 to 9 ranked ideas for what to show

Me mode: end by asking for meeting or DSU notes. Add the items they reveal, correct entries they contradict, and keep the user's work apart from team work.

## Step 4: the deck (gate 2: the user asked for slides)

1. Run `Artifact` with `action: "quickstart"` and `intent: "slides"`. Then publish with:
   - the Slides `type_url`
   - a title: "<Project> Week of <date>" (me) or "<Project> Team Week of <date>" (team)
   - `auto_open: "after_first_write"`
   
   Follow the type instructions it returns.
2. Read `${CLAUDE_SKILL_DIR}/deck-style.md`, including its team-mode section when relevant.
3. Write the files under a folder in the working directory. The Artifact `root` must be in the working directory or the scratchpad, not `$CLAUDE_JOB_DIR`.
   - `project/deck.json` first, then the cover. Publish both together.
   - Then publish the rest in batches.
4. Speaker notes carry the detail that is not on the slide: keys, commands, caveats, "check before saying".
5. Reply with the slide list and every caveat (unverified items, sensitive content, private links), then the link.

## Step 5: revise

Expect many small rounds. For each round:
- Read the slide (or the index) from the artifact, edit it, and publish only the changed files.
- When a slide is removed, also remove it from `order` and repoint any section `start`.
- When a fact changes (for example a consultant replies or a decision is confirmed), update every slide that mentions it, and the matching memory note.

After the deck is final, set `lastDeck.<mode>` in the config.

## Files

- `scripts/detect-project.mjs`: works out a config entry from a folder.
- `scripts/digest-sessions.mjs`: filters to the window, writes the digests and splits them into balanced groups.
- `scripts/collect-git.mjs`: commits per repo in the window, the user's own or (`--team`) everyone's.
- `deck-style.md`: wording, claims, slide order, patterns and palette. Read it before writing slides.
- Tests: `node --test ${CLAUDE_SKILL_DIR}/tests/digest-sessions.test.mjs ${CLAUDE_SKILL_DIR}/tests/detect-project.test.mjs`.
