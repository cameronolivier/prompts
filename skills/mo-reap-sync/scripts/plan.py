#!/usr/bin/env python3
"""
Reconciliation plan: compare calculated coding hours vs. existing mo-reap entries.
Outputs JSON plan showing what time entries need to be added, are already correct, or are over-logged.

Usage:
  python3 plan.py [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--config PATH]
"""
import json
import os
import sys
import subprocess
import argparse
import urllib.request
import urllib.error
from datetime import date, timedelta
from collections import defaultdict

CONFIG_PATH = os.path.expanduser("~/.claude/time-track-config.json")
KEY_FILE = os.path.expanduser("~/.claude/.mo-reap-key")
REAP_BASE = "https://mo-reap.mohara.co"
# Resolve calculate.py relative to this script's location
CALC_SCRIPT = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "..", "time-track", "scripts", "calculate.py"
)


def load_api_key():
    if not os.path.exists(KEY_FILE):
        print("ERROR: mo-reap API key not found at ~/.claude/.mo-reap-key", file=sys.stderr)
        print("Set it up with: echo 'YOUR_KEY' > ~/.claude/.mo-reap-key && chmod 600 ~/.claude/.mo-reap-key", file=sys.stderr)
        sys.exit(1)
    return open(KEY_FILE).read().strip()


def fetch_time_entries(api_key, from_date, to_date):
    url = f"{REAP_BASE}/api/ai/query/time-entries?from={from_date}&to={to_date}&limit=200"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {api_key}"})
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())["data"]
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        print(f"ERROR: mo-reap API {e.code}: {body}", file=sys.stderr)
        sys.exit(1)


def prev_week_range():
    today = date.today()
    monday = today - timedelta(days=today.weekday() + 7)
    return monday, monday + timedelta(days=4)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--from", dest="from_date")
    parser.add_argument("--to", dest="to_date")
    parser.add_argument("--config", default=CONFIG_PATH)
    args = parser.parse_args()

    if not os.path.exists(args.config):
        print(f"ERROR: Config not found: {args.config}", file=sys.stderr)
        print("Run the time-track skill first to set up your config.", file=sys.stderr)
        sys.exit(1)

    from_date, to_date = (
        (date.fromisoformat(args.from_date), date.fromisoformat(args.to_date))
        if args.from_date and args.to_date
        else prev_week_range()
    )

    config = json.load(open(args.config))
    api_key = load_api_key()

    # Get computed hours from Claude Code session data
    calc = subprocess.run(
        ["python3", CALC_SCRIPT,
         "--from", str(from_date), "--to", str(to_date),
         "--config", args.config, "--output", "json"],
        capture_output=True, text=True
    )
    if calc.returncode != 0:
        print(f"ERROR: calculate.py failed:\n{calc.stderr}", file=sys.stderr)
        sys.exit(1)
    computed = json.loads(calc.stdout)  # {project_name: {date_str: hours}}

    # Build project name → mo-reap project_code mapping
    name_to_code = {}
    for proj in config["projects"]:
        code = proj.get("adapters", {}).get("mo-reap", {}).get("project_code")
        if code:
            name_to_code[proj["name"]] = str(code)

    # Fetch existing mo-reap entries for the week
    entries = fetch_time_entries(api_key, from_date, to_date)

    # Sum dev hours (no description) per (project_id, date)
    logged_dev = defaultdict(float)
    meeting_count = 0
    for e in entries:
        if (e.get("description") or "").strip():
            meeting_count += 1
            continue  # meeting/call — leave untouched
        proj_id = str(e.get("projectId", ""))
        entry_date = (e.get("localEntryDate") or "")[:10]
        logged_dev[(proj_id, entry_date)] += float(e.get("duration", 0))

    # Build reconciliation plan
    plan = []
    for proj_name, days in computed.items():
        code = name_to_code.get(proj_name)
        if not code:
            continue  # No mo-reap mapping — skip
        for date_str, computed_h in sorted(days.items()):
            logged_h = round(logged_dev.get((code, date_str), 0.0), 2)
            delta_h = round(computed_h - logged_h, 2)
            delta_min = round(delta_h * 60)
            if abs(delta_h) < 0.05:
                action = "ok"
            elif delta_h > 0:
                action = "add"
            else:
                action = "over"
            plan.append({
                "project": proj_name,
                "project_code": code,
                "date": date_str,
                "computed_h": round(computed_h, 2),
                "logged_h": logged_h,
                "delta_h": delta_h,
                "delta_min": delta_min,
                "action": action,
            })

    print(json.dumps({
        "from": str(from_date),
        "to": str(to_date),
        "plan": sorted(plan, key=lambda x: (x["date"], x["project"])),
        "meetings_untouched": meeting_count,
    }, indent=2))


if __name__ == "__main__":
    main()
