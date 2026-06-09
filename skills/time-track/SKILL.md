---
name: time-track
description: Calculate coding hours per project per day from Claude Code session data. Use when the user asks "how much time did I spend last week", "time report", "calculate my hours", "how long did I work on [project]", "show me my weekly hours", or "time tracking". Outputs a per-project per-day table (Mon–Fri default). Requires ~/.claude/time-track-config.json — guides setup on first use. Composes with mo-reap-sync (pass JSON output as input to that adapter skill).
allowed-tools:
  - Read
  - Write
  - Bash(python3:*)
  - Bash(ls:*)
  - Bash(date:*)
  - Agent
model: haiku
---

# time-track

> **Model: Haiku** — config setup + script dispatch. No multi-step reasoning needed.

Calculate active Claude Code session hours per project per day from `~/.claude/projects/` JSONL files.

**Key rules applied:**
- 6am→6am day boundary (pre-6am messages count as previous day)
- Gaps beyond the session-break threshold (default 20min; set `session_gap_minutes` in config or pass `--gap N`) = session break
- Blocks shorter than the min-session threshold (default 5min; set `min_session_minutes` in config or pass `--min-session N`) are dropped as noise
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

When the user asks for **start/finish times** of each working period (timesheet
detail), use `--output sessions`:
```bash
python3 ~/.claude/skills/time-track/scripts/calculate.py --output sessions [...]
```
This lists each session window per day with a `day total`. Clock times are
rendered in the machine's **local timezone** (via `astimezone()`) — header shows
which (e.g. `times in SAST`). Durations are timezone-independent.

Display the output directly. Append a one-line note:
> Hours = active Claude Code sessions only. Anything done without Claude (docs, calls, browser) won't appear.

> **Venv-enforcing projects:** some repos block bare `python3` via a hook (e.g. Citi Shuttles forces `functions/<fn>/venv/bin/python`). Both scripts are stdlib-only, so substitute that interpreter when the hook fires — output is identical.

## Step 4 — (Optional) Per-session descriptions

When the user wants to know **what was worked on** in each block — not just the hours
(e.g. "what did those 26 hours actually do?") — enrich the timesheet with a one-line
description per session. **Timing is unchanged**: this layer only labels the same blocks
calculate.py already computed.

1. **Extract digests** (deterministic, no model — just pulls the typed prompts + work
   signals out of each block's transcript):
```bash
python3 ~/.claude/skills/time-track/scripts/session_digest.py \
  --from YYYY-MM-DD --to YYYY-MM-DD [--from-time HH:MM] \
  --config ~/.claude/time-track-config.json > /tmp/time-track-digest.json
```
Each block carries: `id`, `project`, `day`, `start`, `end`, `dur_h`, the user's `prompts`,
`tools` (name→count), `files` edited, and `commands` (bash descriptions). Same segmentation
as calculate.py, so block `start`/`end`/`day` line up exactly with the sessions output.
`--from-time HH:MM` trims the first day to a start time (matches the timesheet's cutoff).

2. **Summarize with ONE subagent** — do *not* loop per block. Dispatch a single `Agent`
   (`model: haiku`) and pass it the JSON, instructing it to return, for **each** block `id`,
   a one-line plain-language description (≤120 chars) of what was worked on, as JSON
   `{ "b1": "...", "b2": "...", ... }`. Tell it to read intent from `prompts` and what was
   actually done from `commands`/`files`, to stay concrete (name the feature/area, not
   "worked on code"), and to avoid jargon per the user's communication preference.

3. **Merge** the returned descriptions into the sessions table as a **Description** column
   (key by block `id`, or by `day`+`start`), or into the HTML timesheet. Blocks the subagent
   can't characterise get an empty description rather than a guess.

## Troubleshooting

- **"No activity found"** → patterns may not match. Re-run `ls ~/.claude/projects/` and help user update config.
- **"Config not found"** → re-run config setup above.
