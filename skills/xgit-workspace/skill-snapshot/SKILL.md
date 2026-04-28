---
name: xgit
description: This skill should be used when the user asks to "create a branch", "make a commit", "checkout a branch", "switch branches", or uses xgit commands. Covers the @olvrcc/xgit CLI — a git-flow + conventional commit tool with Jira ticket integration, branch naming conventions, and fuzzy checkout.
model: haiku
allowed-tools:
  - Bash(xgit:*)
  - Bash(cat:*xgitrc.json*)
---

# xgit

> **Recommended model: Haiku** — reference/lookup skill. xgit does the work; the skill maps intent to commands.

`@olvrcc/xgit` is a CLI for git-flow workflows: branch creation with Jira ticket IDs, interactive conventional commits, and fuzzy branch checkout.

## Install

```bash
npm install -g @olvrcc/xgit@latest
```

## Init

Run once per repo to generate `xgitrc.json`:

```bash
xgit init
```

## Commands

### `xgit b` — Create branch

```bash
xgit b [type-flag] <ticket-number> "<description>"
```

| Flag | Prefix |
|------|--------|
| (none) | `PROJ-123_description` |
| `-f` | `feature/PROJ-123_description` |
| `-b` | `bug/PROJ-123_description` |
| `-h` | `hotfix/PROJ-123_description` |
| `-r` | `release/PROJ-123_description` |
| `-d` | `docs/PROJ-123_description` |

```bash
xgit b 123 "add login page"       # PROJ-123_add_login_page
xgit b -f 123 "add login page"    # feature/PROJ-123_add_login_page
xgit b -h 456 "fix null crash"    # hotfix/PROJ-456_fix_null_crash
```

### `xgit c` — Commit

Interactive conventional commit wizard:

```bash
xgit c        # alias
xgit commit
```

Guides through type, scope, and message with proper formatting.

### `xgit f` — Fuzzy checkout

Fuzzy-search local branches and check out:

```bash
xgit f 123          # finds feat/PROJ-123_some_work
xgit f login        # finds any branch containing "login"
```

## Configuration (`xgitrc.json`)

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

**`ticketSeparator`**: `_` (default) | `/` | `-`
**`descriptorCase`**: `snake` (default) | `kebab` | `camel` | `pascal`

Read config:

```bash
cat xgitrc.json
```
