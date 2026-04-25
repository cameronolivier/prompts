---
name: xgit
description: This skill should be used when the user asks to "create a branch", "start working on a ticket", "make a commit", "commit my changes", "checkout a branch", "switch to ticket", "switch branches", "fuzzy checkout", or mentions xgit. Use it whenever the user is working in a repo that uses the @olvrcc/xgit CLI — a git-flow + conventional commit tool with Jira ticket integration, branch naming conventions, and fuzzy checkout. Also use when the user asks what command to use to create a feature/bug/hotfix/release branch tied to a Jira ticket, or wants to set up conventional commits.
model: haiku
allowed-tools:
  - Bash(xgit:*)
  - Bash(npx:*)
  - Bash(git:*)
  - Bash(cat:*xgitrc.json*)
  - Bash(ls:*)
---

# xgit

> **Recommended model: Haiku** — reference/lookup skill. xgit does the work; this skill maps user intent to the right command.

`@olvrcc/xgit` is a CLI for git-flow workflows: Jira-integrated branch creation, interactive conventional commits, and fuzzy branch checkout.

## Running xgit (no global install required)

If `xgitrc.json` exists in the repo, run via npx without installing:

```bash
npx @olvrcc/xgit <command>
```

To avoid typing `npx` every time, alias in the shell or install globally:

```bash
npm install -g @olvrcc/xgit@latest
```

## Setup — new repo

When setting up xgit in a new repo, ask the user these questions before writing the config:

1. **Jira project key?** (e.g. `DEC`, `ACME`, `PROJ`)
2. **Ticket separator?** `_` (default) | `/` | `-`
3. **Description case?** `snake` (default) | `kebab` | `camel` | `pascal`

Then run init and update the generated file:

```bash
npx @olvrcc/xgit init   # generates xgitrc.json
```

Set the collected values in `xgitrc.json`:

```json
{
  "project": "<JIRA_KEY>",
  "ticketSeparator": "_",
  "descriptorCase": "snake"
}
```

Commit `xgitrc.json` so the whole team shares the config.

## Commit — wire xgit into `git commit`

Set up a git alias so `git commit` automatically uses the xgit conventional commit wizard:

```bash
git config alias.commit '!xgit commit'
```

After this, `git commit` (and `git commit` from any tool) runs the interactive wizard. No need to remember `xgit c` separately.

To do it globally for all repos:

```bash
git config --global alias.commit '!xgit commit'
```

To trigger the wizard explicitly without the alias:

```bash
xgit c        # or: npx @olvrcc/xgit commit
xgit commit
```

## Branch — create

```bash
xgit b [type-flag] <ticket-number> "<description>"
# or: npx @olvrcc/xgit b ...
```

| Flag | Branch type | When to use |
|------|-------------|-------------|
| `-f` | `feature/…` | New functionality |
| `-b` | `bug/…` | Bug fix (non-urgent) |
| `-h` | `hotfix/…` | Urgent production fix |
| `-r` | `release/…` | Release preparation |
| `-d` | `docs/…` | Documentation only |
| (none) | no prefix | When type doesn't matter |

```bash
xgit b -f 123 "add login page"    # → feature/PROJ-123_add_login_page
xgit b -h 456 "fix null crash"    # → hotfix/PROJ-456_fix_null_crash
xgit b -b 789 "avatar upload"     # → bug/PROJ-789_avatar_upload
```

## Checkout — fuzzy branch switch

Search local branches by ticket number or keyword:

```bash
xgit f 123          # → checks out feat/PROJ-123_some_work
xgit f login        # → finds any branch containing "login"
# or: npx @olvrcc/xgit f 456
```

## Typical workflow

```bash
# 1. Set up (once per repo)
npx @olvrcc/xgit init
# edit xgitrc.json with project key

# 2. Wire git commit to use wizard
git config alias.commit '!xgit commit'

# 3. Create branch for ticket
xgit b -f 123 "add user profiles"

# 4. Code ... then commit normally
git commit   # → triggers xgit wizard via alias

# 5. Switch to another ticket
xgit f 456
```

## Configuration reference (`xgitrc.json`)

```json
{
  "project": "PROJ",
  "feat": "feature",
  "bug": "bug",
  "hotfix": "hotfix",
  "release": "release",
  "docs": "docs",
  "ticketSeparator": "_",
  "descriptorCase": "snake"
}
```

| Field | Options | Default |
|-------|---------|---------|
| `project` | Jira project key | — |
| `ticketSeparator` | `_` · `/` · `-` | `_` |
| `descriptorCase` | `snake` · `kebab` · `camel` · `pascal` | `snake` |
| `feat` / `bug` / `hotfix` / `release` / `docs` | Custom branch prefix strings | as shown |
