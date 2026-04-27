#!/usr/bin/env python3
"""
Calculate coding hours per project per day from Claude Code session data.
Reads ~/.claude/time-track-config.json for project definitions.

Usage:
  python3 calculate.py [--from YYYY-MM-DD] [--to YYYY-MM-DD]
                       [--config PATH] [--output table|json]
"""
import json
import os
import sys
import glob
import argparse
from datetime import datetime, timedelta, date
from collections import defaultdict

CONFIG_PATH = os.path.expanduser("~/.claude/time-track-config.json")
PROJECTS_DIR = os.path.expanduser("~/.claude/projects")
SESSION_GAP_MINUTES = 60
DAY_BOUNDARY_HOUR = 6  # 6am local: messages before 6am count as previous day


def prev_week_range():
    today = date.today()
    monday = today - timedelta(days=today.weekday() + 7)
    return monday, monday + timedelta(days=4)


def adjusted_local_date(ts: datetime) -> date:
    local = ts.astimezone() if ts.tzinfo else ts
    return (local - timedelta(days=1)).date() if local.hour < DAY_BOUNDARY_HOUR else local.date()


def extract_timestamps(filepath: str) -> list:
    out = []
    try:
        with open(filepath, errors="replace") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                    ts_str = obj.get("timestamp")
                    if ts_str and isinstance(ts_str, str):
                        out.append(datetime.fromisoformat(ts_str.replace("Z", "+00:00")))
                except (json.JSONDecodeError, ValueError):
                    pass
    except OSError:
        pass
    return out


def merge_sessions(sorted_ts: list, gap: int = SESSION_GAP_MINUTES):
    """Split into (start, end) sessions on gaps > `gap` minutes."""
    if not sorted_ts:
        return []
    sessions, start, end = [], sorted_ts[0], sorted_ts[0]
    for ts in sorted_ts[1:]:
        if (ts - end).total_seconds() / 60 > gap:
            sessions.append((start, end))
            start = ts
        end = ts
    sessions.append((start, end))
    return sessions


def compute(config_path: str, from_date: date, to_date: date) -> dict:
    config = json.load(open(config_path))
    all_dirs = {}
    if os.path.isdir(PROJECTS_DIR):
        for e in os.listdir(PROJECTS_DIR):
            full = os.path.join(PROJECTS_DIR, e)
            if os.path.isdir(full):
                all_dirs[e] = full

    results = {}
    for project in config["projects"]:
        name = project["name"]
        patterns = project["patterns"]
        matching = [p for e, p in all_dirs.items() if any(pat in e for pat in patterns)]

        # Union timestamps across all matching dirs (parallel agents don't double-count)
        all_ts = []
        for d in matching:
            for f in glob.glob(os.path.join(d, "*.jsonl")):
                for ts in extract_timestamps(f):
                    if from_date <= adjusted_local_date(ts) <= to_date:
                        all_ts.append(ts)

        all_ts.sort()
        by_day = defaultdict(list)
        for ts in all_ts:
            by_day[adjusted_local_date(ts)].append(ts)

        project_hours = {}
        for day, tss in by_day.items():
            sessions = merge_sessions(sorted(tss))
            minutes = sum(max((e - s).total_seconds() / 60, 1) for s, e in sessions)
            project_hours[str(day)] = round(minutes / 60, 2)

        results[name] = project_hours
    return results


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--from", dest="from_date")
    parser.add_argument("--to", dest="to_date")
    parser.add_argument("--config", default=CONFIG_PATH)
    parser.add_argument("--output", default="table", choices=["table", "json"])
    args = parser.parse_args()

    if not os.path.exists(args.config):
        print(f"ERROR: Config not found: {args.config}", file=sys.stderr)
        sys.exit(1)

    from_date, to_date = (
        (date.fromisoformat(args.from_date), date.fromisoformat(args.to_date))
        if args.from_date and args.to_date
        else prev_week_range()
    )

    results = compute(args.config, from_date, to_date)

    if args.output == "json":
        print(json.dumps(results, indent=2))
        return

    all_days = sorted({date.fromisoformat(d) for days in results.values() for d in days})
    if not all_days:
        print(f"No activity found between {from_date} and {to_date}")
        return

    pw, cw = 20, 9
    labels = [d.strftime("%-m/%-d %a") for d in all_days]
    header = f"{'Project':<{pw}}" + "".join(f"{l:>{cw}}" for l in labels) + f"{'Total':>{cw}}"
    print(f"\n{header}")
    print("─" * len(header))
    for proj in sorted(results):
        total = 0.0
        row = f"{proj:<{pw}}"
        for d in all_days:
            h = results[proj].get(str(d), 0.0)
            total += h
            row += f"{h:>{cw}.2f}" if h else f"{'—':>{cw}}"
        row += f"{total:>{cw}.2f}"
        print(row)
    print()


if __name__ == "__main__":
    main()
