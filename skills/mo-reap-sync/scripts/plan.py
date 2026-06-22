#!/usr/bin/env python3
"""
Reconciliation plan: compare calculated coding hours vs. existing mo-reap entries.
Outputs JSON plan showing what time entries need to be added, are already correct, or are over-logged.

Usage:
  python3 plan.py [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--config PATH] [--auto]

  --auto  Skip confirmation, POST all add entries immediately, print compact log.

Config fields (time-track-config.json):
  projects: list of {name, patterns, adapters?}
  unmatched_fallback_project_code: mo-reap project code to log unmatched session dirs to.
    Each entry gets the dir path in the note field for triage in the dashboard.
  path_strip_prefix: prefix to remove from decoded dir paths (default: /Users/cam/mo).
"""
import glob
import json
import math
import os
import re
import sys
import subprocess
import argparse
import urllib.request
import urllib.error
from datetime import date, datetime, timedelta
from collections import defaultdict

CONFIG_PATH = os.path.expanduser("~/.claude/time-track-config.json")
PROJECTS_DIR = os.path.expanduser("~/.claude/projects")
KEY_FILE = os.path.expanduser("~/.claude/.mo-reap-key")
REAP_BASE = "https://mo-reap.mohara.co"
CALC_SCRIPT = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "..", "time-track", "scripts", "calculate.py"
)

SESSION_GAP_MINUTES = 60
DAY_BOUNDARY_HOUR = 6


def load_api_key():
    if not os.path.exists(KEY_FILE):
        print("ERROR: mo-reap API key not found at ~/.claude/.mo-reap-key", file=sys.stderr)
        sys.exit(1)
    return open(KEY_FILE).read().strip()


TIMEOUT_SECONDS = 30


def _get(url, api_key):
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {api_key}"})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        print(f"ERROR: mo-reap API {e.code}: {body}", file=sys.stderr)
        sys.exit(1)
    except OSError as e:
        print(f"ERROR: network error: {e}", file=sys.stderr)
        sys.exit(1)


def _post(url, api_key, payload: dict):
    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        print(f"ERROR: POST {e.code}: {body}", file=sys.stderr)
        return None
    except OSError as e:
        print(f"ERROR: network error: {e}", file=sys.stderr)
        return None


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

    search_norms = {_norm(t) for t in [config_proj["name"]] + config_proj.get("patterns", []) if t}
    matches = [
        rp for rp in reap_projects
        if any(sn and sn in _norm(rp["name"]) for sn in search_norms)
    ]

    if len(matches) == 1:
        return matches[0]
    if len(matches) > 1:
        print(
            f"WARNING: ambiguous mo-reap match for {config_proj['name']!r} — "
            f"candidates: {[m['name'] for m in matches]}. "
            f"Add adapters.mo-reap.project_code to config to disambiguate.",
            file=sys.stderr,
        )
    # len == 0: not in assigned list — silent skip, caller logs summary
    return None


def prev_week_range():
    today = date.today()
    monday = today - timedelta(days=today.weekday() + 7)
    return monday, monday + timedelta(days=4)


# --- unmatched dir session parsing (mirrors calculate.py logic) ---

def _adjusted_local_date(ts: datetime) -> date:
    local = ts.astimezone() if ts.tzinfo else ts
    return (local - timedelta(days=1)).date() if local.hour < DAY_BOUNDARY_HOUR else local.date()


def _extract_timestamps(filepath: str) -> list:
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


def _merge_sessions(sorted_ts: list) -> list:
    if not sorted_ts:
        return []
    sessions, start, end = [], sorted_ts[0], sorted_ts[0]
    for ts in sorted_ts[1:]:
        if (ts - end).total_seconds() / 60 > SESSION_GAP_MINUTES:
            sessions.append((start, end))
            start = ts
        end = ts
    sessions.append((start, end))
    return sessions


def decode_dir_path(dir_name: str, strip_prefix: str) -> str:
    """
    Convert a ~/.claude/projects dir name back to a human-readable path.
    Claude encodes /a/b/c as -a-b-c (replaces / with -, drops leading /).
    Note: dirs with dashes in their names decode ambiguously — good enough for triage.
    """
    path = "/" + dir_name.lstrip("-").replace("-", "/")
    if strip_prefix and path.startswith(strip_prefix):
        path = path[len(strip_prefix):]
    return path or "/"


def compute_unmatched_hours(config: dict, from_date: date, to_date: date) -> dict:
    """
    Return {dir_name: {date_str: hours}} for project dirs that don't match any
    configured project pattern. Used to log unmatched time to a fallback project.
    """
    all_dirs = {}
    if os.path.isdir(PROJECTS_DIR):
        for e in os.listdir(PROJECTS_DIR):
            full = os.path.join(PROJECTS_DIR, e)
            if os.path.isdir(full):
                all_dirs[e] = full

    # Dirs claimed by configured projects
    matched_dirs = set()
    for proj in config["projects"]:
        for dir_name in all_dirs:
            if any(pat in dir_name for pat in proj.get("patterns", [])):
                matched_dirs.add(dir_name)

    results = {}
    for dir_name, dir_path in all_dirs.items():
        if dir_name in matched_dirs:
            continue

        all_ts = []
        for f in glob.glob(os.path.join(dir_path, "*.jsonl")):
            for ts in _extract_timestamps(f):
                if from_date <= _adjusted_local_date(ts) <= to_date:
                    all_ts.append(ts)

        if not all_ts:
            continue

        all_ts.sort()
        by_day = defaultdict(list)
        for ts in all_ts:
            by_day[_adjusted_local_date(ts)].append(ts)

        dir_hours = {}
        for day, tss in by_day.items():
            sessions = _merge_sessions(sorted(tss))
            minutes = sum(max((e - s).total_seconds() / 60, 1) for s, e in sessions)
            dir_hours[str(day)] = round(minutes / 60, 2)

        results[dir_name] = dir_hours

    return results


def _make_plan_entry(project, project_code, date_str, computed_h, logged_h, note=""):
    delta_h = round(computed_h - logged_h, 2)
    if abs(delta_h) < 0.05:
        action, delta_min = "ok", 0
    elif delta_h > 0:
        action = "add"
        delta_min = math.ceil(delta_h * 60 / 30) * 30  # round up to nearest 30 min
    else:
        action = "over"
        delta_min = round(delta_h * 60)
    entry = {
        "project": project,
        "project_code": project_code,
        "date": date_str,
        "computed_h": round(computed_h, 2),
        "logged_h": round(logged_h, 2),
        "delta_h": delta_h,
        "delta_min": delta_min,
        "action": action,
    }
    if note:
        entry["note"] = note
    return entry


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--from", dest="from_date")
    parser.add_argument("--to", dest="to_date")
    parser.add_argument("--config", default=CONFIG_PATH)
    parser.add_argument("--auto", action="store_true", help="POST all add entries without confirmation")
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

    fallback_code = config.get("unmatched_fallback_project_code")
    path_strip_prefix = config.get("path_strip_prefix", "/Users/cam/mo")

    # Discover mo-reap projects
    reap_projects = fetch_reap_projects(api_key)
    project_map = {}  # config_project_name → reap {id, name, code}
    skipped = []
    for proj in config["projects"]:
        resolved = resolve_reap_project(proj, reap_projects)
        if resolved:
            project_map[proj["name"]] = resolved
        else:
            skipped.append(proj["name"])

    if skipped:
        print(f"INFO: skipped (not assigned): {', '.join(skipped)}", file=sys.stderr)

    fallback_reap = None
    if fallback_code:
        fallback_reap = next((p for p in reap_projects if str(p["code"]) == str(fallback_code)), None)
        if not fallback_reap:
            print(f"WARNING: unmatched_fallback_project_code {fallback_code!r} not found in mo-reap projects.", file=sys.stderr)

    if not project_map and not fallback_reap:
        print("INFO: no config projects matched assigned mo-reap projects — nothing to sync.", file=sys.stderr)
        sys.exit(0)

    # Get computed hours for configured projects
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

    # UUID → config project name (for matching existing entries)
    uuid_to_proj = {rp["id"]: name for name, rp in project_map.items()}
    fallback_uuid = fallback_reap["id"] if fallback_reap else None

    # Fetch existing mo-reap entries
    entries = fetch_time_entries(api_key, from_date, to_date)

    # Aggregate dev hours for matched projects (no description = dev time)
    # Aggregate fallback entries by (date, note) for unmatched deduplication
    logged_dev = defaultdict(float)       # (proj_name, date) → hours
    fallback_logged = defaultdict(float)  # (date, note) → hours
    meeting_count = 0

    for e in entries:
        proj_id = e.get("projectId", "")
        desc = (e.get("description") or "").strip()
        entry_date = (e.get("localEntryDate") or "")[:10]
        duration = float(e.get("duration", 0))

        if proj_id == fallback_uuid:
            # Always aggregate fallback entries by (date, note) regardless of description
            fallback_logged[(entry_date, desc)] += duration
            continue

        if desc:
            meeting_count += 1
            continue  # meeting/call in a matched project — leave untouched

        proj_name = uuid_to_proj.get(proj_id)
        if proj_name:
            logged_dev[(proj_name, entry_date)] += duration

    # Build plan for configured projects
    plan = []
    for proj_name, days in computed.items():
        reap_proj = project_map.get(proj_name)
        if not reap_proj:
            continue
        for date_str, computed_h in sorted(days.items()):
            logged_h = logged_dev.get((proj_name, date_str), 0.0)
            plan.append(_make_plan_entry(proj_name, reap_proj["code"], date_str, computed_h, logged_h))

    # Build plan for unmatched dirs → fallback project
    if fallback_reap:
        unmatched = compute_unmatched_hours(config, from_date, to_date)
        for dir_name, days in unmatched.items():
            note = decode_dir_path(dir_name, path_strip_prefix)
            for date_str, computed_h in sorted(days.items()):
                already_h = fallback_logged.get((date_str, note), 0.0)
                plan.append(_make_plan_entry(
                    f"[unmatched] {note}", fallback_reap["code"],
                    date_str, computed_h, already_h, note=note,
                ))

    sorted_plan = sorted(plan, key=lambda x: (x["date"], x["project"]))
    result = {
        "from": str(from_date),
        "to": str(to_date),
        "plan": sorted_plan,
        "meetings_untouched": meeting_count,
    }

    if not args.auto:
        print(json.dumps(result, indent=2))
        return

    # --- auto mode: POST all add entries ---
    adds  = [e for e in sorted_plan if e["action"] == "add"]
    oks   = [e for e in sorted_plan if e["action"] == "ok"]
    overs = [e for e in sorted_plan if e["action"] == "over"]

    print(f"PLAN: {len(adds)} to add, {len(oks)} ok, {len(overs)} over-logged, {meeting_count} meetings untouched")

    for e in overs:
        print(f"OVER: {e['project']} {e['date']} logged={e['logged_h']}h computed={e['computed_h']}h — fix manually in mo-reap UI")

    if not adds:
        print("AUTO: nothing to add")
        return

    failed = False
    for e in adds:
        resp = _post(
            f"{REAP_BASE}/api/v1/log",
            api_key,
            {
                "project_code": str(e["project_code"]),
                "minutes": e["delta_min"],
                "note": e.get("note", ""),
                "date": e["date"],
            },
        )
        if resp is not None:
            label = f"{e['project']} {e['date']} +{e['delta_h']}h ({e['delta_min']}min)"
            if e.get("note"):
                label += f" [{e['note']}]"
            print(f"POST: ✓ {label}")
        else:
            print(f"POST: ✗ {e['project']} {e['date']} FAILED", file=sys.stderr)
            failed = True

    if failed:
        sys.exit(1)
    print("AUTO: complete")


if __name__ == "__main__":
    main()
