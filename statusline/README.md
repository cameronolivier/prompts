# Status Line

Custom Claude Code status line showing git info and context window usage.

## What it shows

```
45k, 12% | mohara/mo-ai | feat/cool-thing | S: 2 | U: 1 | A: 3
```

| Segment | Meaning |
|---------|---------|
| `45k, 12%` | Total tokens used and context window usage % (parsed from Claude Code JSON via `jq`) |
| `mohara/mo-ai` | Repo path (relative to `~/mo/dev`) |
| `feat/cool-thing` | Current branch |
| `S: 2` | Staged file count |
| `U: 1` | Unstaged (modified/deleted) count |
| `A: 3` | Untracked file count |

Non-git directories show only the working directory path.

## Install

### Automatic

```bash
bash /path/to/mo-ai/statusline/install.sh
```

The script will:
1. Add/update the `statusLine` setting in `~/.claude/settings.json`
2. Point it at the wrapper script in this directory
3. Prompt before overwriting any existing config

### Manual

Add to `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "bash /path/to/mo-ai/statusline/statusline-wrapper.sh"
  }
}
```

Replace `/path/to/mo-ai` with the actual path to this repo.

## Dependencies

- `git` — for repo info
- `jq` — for context % display (optional, install with `brew install jq`). If missing, the status line still shows git info.

## Files

| File | Purpose |
|------|---------|
| `statusline-command.sh` | Git info extraction (repo, branch, file counts) |
| `statusline-wrapper.sh` | Combines git info + context % |
| `install.sh` | Automated installer |

## Customization

Edit `statusline-command.sh` to change:
- **Repo path base**: modify the `sed` pattern on line 12 (default: `~/mo/dev`)
- **Colors**: ANSI codes on lines 26-27 (cyan=repo, green=branch, yellow=counts)
- **Segments**: add/remove git info sections

## Uninstall

Remove the `statusLine` key from `~/.claude/settings.json`.
