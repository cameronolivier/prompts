#!/usr/bin/env python3
"""
Reconciliation plan: compare calculated coding hours vs. existing mo-reap entries.
Outputs JSON plan showing what time entries need to be added, are already correct, or are over-logged.

Usage:
  python3 plan.py [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--config PATH]
"""
import json
import math
import os
import re
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
CALC_SCRIPT = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "..", "time-track", "scripts", "calculate.py"
)


def load_api_key():
    if not os.path.exists(KEY_FILE):
        print("ERROR: mo-reap API key not found at ~/.claude/.mo-reap-key", file=sys.stderr)
        print("Set it up with: echo 'YOUR_KEY' > ~/.claude/.mo-reap-key && chmod 600 ~/.claude/.mo-reap-key", file=sys.stderr)
        sys.exit(1)
    return open(KEY_FILE).read().strip()


def _get(url, api_key):
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {api_key}"})
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        print(f"ERROR: mo-reap API {e.code}: {body}", file=sys.stderr)
        sys.exit(1)


def fetch_reap_projects(api_key):
    return _get(f"{REAP_BASE}/api/v1/projects", api_key)["data"]


def fetch_time_entries(api_key, from_date, to_date):
    return _get(
        f"{REAP_BASE}/api/ai/query/time-entries?from={from_date}&to={to_date}&limit=200",
        api_key,
    )["data"]


def _norm(s: str) -> str:
    return re.sub(r"[\s\-_]", "", (s or "")).lower()


def resolve_reap_project(config_proj, reap_projects):
    """Return a reap project dict {id, name, code}, or None with a warning printed."""
    # Explicit override: skip auto-match
    override = config_proj.get("adapters", {}).get("mo-reap", {}).get("project_code")
    if override:
        for rp in reap_projects:
            if str(rp["code"]) == str(override):
                return rp
        print(
            f"WARNING: explicit project_code {override!r} for {config_proj['name']!r} "
            f"not found in mo-reap projects list.",
            file=sys.stderr,
        )
        return None

    # Auto-match: normalize config name + patterns, check each against mo-reap project names
    search_norms = {_norm(t) for t in [config_proj["name"]] + config_proj.get("patterns", []) if t}
    matches = [
        rp for rp in reap_projects
        if any(sn and sn in _norm(rp["name"]) for sn in search_norms)
    ]

    if len(matches) == 1:
        return matches[0]
    if len(matches) == 0:
        print(
            f"WARNING: no mo-reap project matches {config_proj['name']!r}. "
            f"Add adapters.mo-reap.project_code to config to set it explicitly.",
            file=sys.stderr,
        )
    else:
        print(
            f"WARNING: ambiguous mo-reap match for {config_proj['name']!r} — "
            f"candidates: {[m['name'] for m in matches]}. "
            f"Add adapters.mo-reap.project_code to config to disambiguate.",
            file=sys.stderr,
        )
    return None


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

    # Discover mo-reap projects and resolve each config project
    reap_projects = fetch_reap_projects(api_key)
    project_map = {}  # config_project_name → reap {id, name, code}
    for proj in config["projects"]:
        resolved = resolve_reap_project(proj, reap_projects)
        if resolved:
            project_map[proj["name"]] = resolved

    if not project_map:
        print("ERROR: no config projects could be matched to mo-reap projects.", file=sys.stderr)
        sys.exit(1)

    # Get computed hours from Claude Code session data
    calc = subprocess.run(
        ["python3", CALC_SCRIPT,
         "--from", str(from_date), "--to", str(to_date),
         "--config", args.config, "--output", "json"],
        capture_output=True, text=True,
    )
    if calc.returncode != 0:
        print(f"ERROR: calculate.py failed:\n{calc.stderr}", file=sys.stderr)
        sys.exit(1)
    computed = json.loads(calc.stdout)  # {project_name: {date_str: hours}}

    # UUID → config project name (for reliable entry matching)
    uuid_to_proj = {rp["id"]: name for name, rp in project_map.items()}

    # Fetch existing mo-reap entries and aggregate dev hours by (project_name, date)
    entries = fetch_time_entries(api_key, from_date, to_date)
    logged_dev = defaultdict(float)
    meeting_count = 0
    for e in entries:
        if (e.get("description") or "").strip():
            meeting_count += 1
            continue  # meeting/call — leave untouched
        proj_name = uuid_to_proj.get(e.get("projectId", ""))
        if not proj_name:
            continue
        entry_date = (e.get("localEntryDate") or "")[:10]
        logged_dev[(proj_name, entry_date)] += float(e.get("duration", 0))

    # Build reconciliation plan
    plan = []
    for proj_name, days in computed.items():
        reap_proj = project_map.get(proj_name)
        if not reap_proj:
            continue
        for date_str, computed_h in sorted(days.items()):
            logged_h = round(logged_dev.get((proj_name, date_str), 0.0), 2)
            delta_h = round(computed_h - logged_h, 2)
            if abs(delta_h) < 0.05:
                action = "ok"
                delta_min = 0
            elif delta_h > 0:
                action = "add"
                delta_min = math.ceil(delta_h * 60 / 30) * 30  # round up to nearest 30 min
            else:
                action = "over"
                delta_min = round(delta_h * 60)
            plan.append({
                "project": proj_name,
                "project_code": reap_proj["code"],
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
