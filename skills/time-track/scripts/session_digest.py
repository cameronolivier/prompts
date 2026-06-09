#!/usr/bin/env python3
"""
Per-session digest extractor for time-track descriptions.

Reproduces calculate.py's exact block segmentation, then for each block emits a
compact, deterministic digest of what happened — the user's typed prompts plus
signals of work done (tool names, files touched, bash command descriptions).
This digest is small enough to hand to a single summarizing subagent, which
turns each block into a one-line "what got done" description.

No model is used here — extraction only. Output is JSON on stdout:
  {"tz": "SAST", "blocks": [ {id, project, day, start, end, dur_h, n_events,
                              prompts: [...], tools: {name: n}, files: [...],
                              commands: [...]}, ... ]}

Usage:
  session_digest.py --from YYYY-MM-DD --to YYYY-MM-DD [--from-time HH:MM]
                    [--config PATH] [--gap N] [--min-session N]
                    [--patterns p1 p2 ...]
"""
import json
import os
import glob
import argparse
from datetime import datetime, timedelta, date, time
from collections import defaultdict, Counter

PROJECTS_DIR = os.path.expanduser("~/.claude/projects")
CONFIG_PATH = os.path.expanduser("~/.claude/time-track-config.json")
DEFAULT_GAP = 20
DEFAULT_MIN = 5
DAY_BOUNDARY_HOUR = 6

# user-content prefixes that are harness noise, not a real typed prompt
NOISE_PREFIXES = (
    "<local-command", "<command-name", "<command-message", "<command-args",
    "Caveat:", "<bash-", "[Request interrupted", "<user-prompt-submit-hook",
    "<system-reminder", "<task-notification", "<task-id", "<post-tool-use",
)


def adjusted_local_date(ts: datetime) -> date:
    local = ts.astimezone() if ts.tzinfo else ts
    return (local - timedelta(days=1)).date() if local.hour < DAY_BOUNDARY_HOUR else local.date()


def parse_line(line: str):
    line = line.strip()
    if not line:
        return None
    try:
        return json.loads(line)
    except (json.JSONDecodeError, ValueError):
        return None


def entry_ts(obj):
    ts = obj.get("timestamp")
    if ts and isinstance(ts, str):
        try:
            return datetime.fromisoformat(ts.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def user_text(obj):
    """Return a clean typed-prompt string, or None for tool-results / noise."""
    if obj.get("isMeta"):
        return None
    msg = obj.get("message") or {}
    content = msg.get("content")
    text = None
    if isinstance(content, str):
        text = content
    elif isinstance(content, list):
        parts = [b.get("text", "") for b in content
                 if isinstance(b, dict) and b.get("type") == "text"]
        # lists that are purely tool_result carry no text block -> skip
        text = "\n".join(p for p in parts if p) or None
    if not text:
        return None
    stripped = text.lstrip()
    if any(stripped.startswith(p) for p in NOISE_PREFIXES):
        return None
    return " ".join(text.split())[:240]


def assistant_signals(obj):
    """Yield ('tool', name, detail) tuples from an assistant message."""
    msg = obj.get("message") or {}
    content = msg.get("content")
    if not isinstance(content, list):
        return
    for b in content:
        if not isinstance(b, dict) or b.get("type") != "tool_use":
            continue
        name = b.get("name", "?")
        inp = b.get("input") or {}
        detail = None
        if name == "Bash":
            detail = inp.get("description") or (inp.get("command", "")[:80] or None)
        elif name in ("Edit", "Write", "Read", "NotebookEdit"):
            fp = inp.get("file_path") or inp.get("notebook_path") or ""
            detail = os.path.basename(fp) if fp else None
        elif name in ("Agent", "Task"):
            detail = inp.get("description") or inp.get("subagent_type")
        elif name in ("Grep", "Glob"):
            detail = inp.get("pattern")
        yield (name, detail)


def collect(patterns, from_date, to_date, cutoff):
    """Return sorted [(ts, obj)] across matching project dirs, within range.

    `cutoff` (naive local datetime or None) excludes events earlier than it —
    compared on full wall-clock instant so a session's post-midnight tail is kept.
    """
    out = []
    for e in sorted(os.listdir(PROJECTS_DIR)):
        full = os.path.join(PROJECTS_DIR, e)
        if not (os.path.isdir(full) and any(p in e for p in patterns)):
            continue
        for fp in glob.glob(os.path.join(full, "*.jsonl")):
            try:
                f = open(fp, errors="replace")
            except OSError:
                continue
            with f:
                for line in f:
                    obj = parse_line(line)
                    if not obj:
                        continue
                    ts = entry_ts(obj)
                    if not ts:
                        continue
                    day = adjusted_local_date(ts)
                    if not (from_date <= day <= to_date):
                        continue
                    if cutoff and ts.astimezone().replace(tzinfo=None) < cutoff:
                        continue
                    out.append((ts, obj))
    out.sort(key=lambda x: x[0])
    return out


def segment(events, gap):
    """Split [(ts, obj)] into blocks on gaps > gap minutes. Returns list of lists."""
    if not events:
        return []
    blocks, cur = [], [events[0]]
    for ts, obj in events[1:]:
        if (ts - cur[-1][0]).total_seconds() / 60 > gap:
            blocks.append(cur)
            cur = []
        cur.append((ts, obj))
    blocks.append(cur)
    return blocks


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="from_date", required=True)
    ap.add_argument("--to", dest="to_date", required=True)
    ap.add_argument("--from-time", dest="from_time", default=None)
    ap.add_argument("--config", default=CONFIG_PATH)
    ap.add_argument("--patterns", nargs="+", default=None)
    ap.add_argument("--gap", type=int, default=None)
    ap.add_argument("--min-session", dest="min_session", type=int, default=None)
    args = ap.parse_args()

    cfg = json.load(open(args.config)) if os.path.exists(args.config) else {}
    gap = args.gap if args.gap is not None else cfg.get("session_gap_minutes", DEFAULT_GAP)
    min_min = (args.min_session if args.min_session is not None
               else cfg.get("min_session_minutes", DEFAULT_MIN))

    from_date = date.fromisoformat(args.from_date)
    to_date = date.fromisoformat(args.to_date)
    cutoff = None
    if args.from_time:
        hh, mm = (int(x) for x in args.from_time.split(":"))
        cutoff = datetime.combine(from_date, time(hh, mm))

    # Determine project list: explicit --patterns, else every config project
    projects = []
    if args.patterns:
        projects = [{"name": "Project", "patterns": args.patterns}]
    else:
        projects = cfg.get("projects", [])

    tz = datetime.now().astimezone().strftime("%Z")
    blocks_out = []
    bid = 0
    for proj in projects:
        events = collect(proj["patterns"], from_date, to_date, cutoff)
        for block in segment(events, gap):
            start, end = block[0][0], block[-1][0]
            if (end - start).total_seconds() / 60 < min_min:
                continue
            bid += 1
            prompts, tools, files, commands = [], Counter(), [], []
            for ts, obj in block:
                t = obj.get("type")
                if t == "user":
                    txt = user_text(obj)
                    if txt and (not prompts or prompts[-1] != txt):
                        prompts.append(txt)
                elif t == "assistant":
                    for name, detail in assistant_signals(obj):
                        tools[name] += 1
                        if name in ("Edit", "Write", "NotebookEdit") and detail and detail not in files:
                            files.append(detail)
                        elif name == "Bash" and detail:
                            commands.append(detail)
            blocks_out.append({
                "id": f"b{bid}",
                "project": proj["name"],
                "day": str(adjusted_local_date(start)),
                "start": start.astimezone().strftime("%H:%M"),
                "end": end.astimezone().strftime("%H:%M"),
                "dur_h": round(max((end - start).total_seconds() / 3600, 1 / 60), 2),
                "n_events": len(block),
                "prompts": prompts[:6],
                "tools": dict(tools),
                "files": files[:15],
                "commands": commands[:10],
            })

    print(json.dumps({"tz": tz, "from": str(from_date), "to": str(to_date),
                      "blocks": blocks_out}, indent=2))


if __name__ == "__main__":
    main()
