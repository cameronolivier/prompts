---
name: time-track
description: Calculate coding hours per project per day from Claude Code session data. Use when the user asks "how much time did I spend last week", "time report", "calculate my hours", "how long did I work on [project]", "show me my weekly hours", or "time tracking". Outputs a per-project per-day table (Mon–Fri default). Requires ~/.claude/time-track-config.json — guides setup on first use. Composes with mo-reap-sync (pass JSON output as input to that adapter skill).
allowed-tools:
  - Read
  - Write
  - Bash(python3:*)
  - Bash(ls:*)
  - Bash(date:*)
model: haiku
---

# time-track

> **Model: Haiku** — config setup + script dispatch. No multi-step reasoning needed.

Calculate active Claude Code session hours per project per day from `~/.claude/projects/` JSONL files.

**Key rules applied:**
- 6am→6am day boundary (pre-6am messages count as previous day)
- Gaps >1h between messages = session break
- Parallel agents in the same project are unioned (no double-counting)
- Parallel sessions across different projects both get credited

## Step 1 — Check for config

```bash
ls ~/.claude/time-track-config.json 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

If **MISSING**, run config setup:

1. Show available project directories:
```bash
ls ~/.claude/projects/
```

2. Ask the user: "Which projects do you track? For each, what keywords appear in the directory names above?"

3. Write `~/.claude/time-track-config.json`:
```json
{
  "projects": [
    {
      "name": "ProjectName",
      "patterns": ["keyword-that-appears-in-dir-names"]
    }
  ]
}
```

Example for Kairo + MoAI:
```json
{
  "projects": [
    {
      "name": "Kairo",
      "patterns": ["kairo"]
    },
    {
      "name": "MoAI",
      "patterns": ["cam-prompts", "mo-ai", "MoharaVault", "moai"]
    }
  ]
}
```

Adapter-specific fields (e.g. `adapters.mo-reap.project_code`) are only needed as overrides when a downstream adapter cannot auto-match the project name.

Patterns are substring-matched against directory names in `~/.claude/projects/`. Worktrees matching the same patterns are included automatically.

## Step 2 — Parse date range from $ARGUMENTS

| Input | Meaning |
|---|---|
| _(empty)_ | Previous Mon–Fri |
| `YYYY-MM-DD to YYYY-MM-DD` | Explicit range |
| `this week` | Current Mon to today |
| `last week` | Previous Mon–Fri |

## Step 3 — Run calculation

```bash
python3 ~/.claude/skills/time-track/scripts/calculate.py \
  [--from YYYY-MM-DD --to YYYY-MM-DD] \
  --config ~/.claude/time-track-config.json \
  --output table
```

Omit `--from`/`--to` to use previous week default.

For machine-readable output (used by mo-reap-sync):
```bash
python3 ~/.claude/skills/time-track/scripts/calculate.py --output json [...]
```

Display the table output directly. Append a one-line note:
> Hours = active Claude Code sessions only. Anything done without Claude (docs, calls, browser) won't appear.

## Troubleshooting

- **"No activity found"** → patterns may not match. Re-run `ls ~/.claude/projects/` and help user update config.
- **"Config not found"** → re-run config setup above.
