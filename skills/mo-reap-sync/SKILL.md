---
name: mo-reap-sync
description: Sync Claude Code session hours to mo-reap time tracking. Use when the user asks to "sync time to mo-reap", "update mo-reap", "log my hours to mo-reap", "reconcile time entries", or "fill in my timesheet". Computes coding hours via time-track, fetches existing mo-reap entries, shows a diff, and POSTs the delta on confirmation. Never deletes or overwrites — only adds missing time. Requires time-track skill installed and ~/.claude/time-track-config.json with mo-reap adapter config.
allowed-tools:
  - Read
  - Bash(python3:*)
  - Bash(curl:*)
  - Bash(date:*)
  - Bash(ls:*)
model: sonnet
---

# mo-reap-sync

> **Model: Sonnet** — reads a reconciliation plan and reasons about what to confirm / skip / warn.

Adapter that takes `time-track` output and syncs it to mo-reap. Only adds missing dev time; entries with a `description` (meetings/calls) are never touched.

Composes with: `time-track` (this skill calls its `calculate.py` internally).

## Prerequisites

1. **time-track skill installed** at `~/.claude/skills/time-track/`
2. **Config** at `~/.claude/time-track-config.json` — only `name` and `patterns` are required. The adapter auto-discovers the mo-reap project by normalizing the config name and patterns against `/api/v1/projects`. Add `adapters.mo-reap.project_code` only to override when auto-match is ambiguous:

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

If the auto-match warns "ambiguous" or "no match", add an explicit override:

```json
{
  "name": "SomeProject",
  "patterns": ["some-proj"],
  "adapters": {
    "mo-reap": { "project_code": "123456" }
  }
}
```

3. **API key** at `~/.claude/.mo-reap-key` (set by the mo-reap command on first install)

## Step 1 — Parse date range from $ARGUMENTS

| Input | Meaning |
|---|---|
| _(empty)_ | Previous Mon–Fri |
| `YYYY-MM-DD to YYYY-MM-DD` | Explicit range |
| `last week` | Previous Mon–Fri |
| `this week` | Current Mon to today |

## Step 2 — Generate reconciliation plan

```bash
python3 ~/.claude/skills/mo-reap-sync/scripts/plan.py \
  [--from YYYY-MM-DD --to YYYY-MM-DD] \
  --config ~/.claude/time-track-config.json
```

This fetches mo-reap entries and compares them to computed hours. Output JSON shape:
```json
{
  "from": "2026-04-21",
  "to": "2026-04-25",
  "meetings_untouched": 3,
  "plan": [
    { "project": "Kairo", "project_code": "743399", "date": "2026-04-21",
      "computed_h": 4.5, "logged_h": 2.0, "delta_h": 2.5, "delta_min": 150, "action": "add" },
    { "project": "MoAI", "project_code": "521637", "date": "2026-04-22",
      "computed_h": 1.2, "logged_h": 1.2, "delta_h": 0.0, "delta_min": 0, "action": "ok" }
  ]
}
```

## Step 3 — Present plan to user

Format the plan as a readable table. Group by action:

**To add** (action = "add"):
| Date | Project | Computed | Logged | Delta |
| 2026-04-21 | Kairo | 4.5h | 2.0h | +2.5h |

**Already correct** (action = "ok"): list as "✓ date project"

**Over-logged** (action = "over"): warn — "⚠ mo-reap shows more time than computed for X on Y. Edit manually in the mo-reap UI if needed."

Note: `meetings_untouched` entries with descriptions were skipped.

Ask: "Proceed with adding the delta entries? (yes/no/[pick specific ones])"

## Step 4 — Apply confirmed entries

For each confirmed `add` entry, POST to mo-reap:

```bash
curl -sS -X POST "https://mo-reap.mohara.co/api/v1/log" \
  -H "Authorization: Bearer $(cat ~/.claude/.mo-reap-key)" \
  -H "Content-Type: application/json" \
  -d "{\"project_code\":\"PROJECT_CODE\",\"minutes\":DELTA_MIN,\"note\":\"\",\"date\":\"DATE\"}"
```

Show each result as: `✅ Added Xh Ym to PROJECT on DATE` or `❌ Failed: [error]`.

## Step 5 — Verify

Re-fetch the week's entries and confirm each day × project total matches the target:

```bash
curl -sS "https://mo-reap.mohara.co/api/ai/query/time-entries?from=FROM&to=TO&limit=200" \
  -H "Authorization: Bearer $(cat ~/.claude/.mo-reap-key)"
```

Show a brief summary: "✅ All projects reconciled" or flag any remaining gaps.

## Caveats

- **No delete/update endpoint exists** — over-logged entries must be fixed manually in the mo-reap UI.
- Claude Code hours = active AI-assisted work only. Anything done without Claude won't appear.
- Projects without a `adapters.mo-reap.project_code` in config are silently skipped.
