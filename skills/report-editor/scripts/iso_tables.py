#!/usr/bin/env python3
"""Convert day-dates inside markdown table rows to ISO. Prose outside tables is untouched.

    iso_tables.py REPORT.md [--year 2026] [--dry-run]

Matches "9 September", "9 September 2026" and "September 9, 2026" inside lines that start with a
pipe. A date without a year takes --year (default: the current year). Month-only dates such as
"May 2025" are left alone. Fenced code is skipped. Prints the count converted; with --dry-run,
prints each conversion and writes nothing.
"""
from __future__ import annotations

import argparse
import datetime as dt
import re
import sys
from pathlib import Path

MONTHS = "January February March April May June July August September October November December".split()
M = {m: i + 1 for i, m in enumerate(MONTHS)}
MONTH_RE = "|".join(MONTHS)
DAY_FIRST = re.compile(rf"\b(\d{{1,2}}) ({MONTH_RE})(?: (\d{{4}}))?\b")
MONTH_FIRST = re.compile(rf"\b({MONTH_RE}) (\d{{1,2}})(?:, (\d{{4}}))?\b(?! [a-z])")


def convert_line(line: str, year: int) -> tuple[str, list[tuple[str, str]]]:
    changes: list[tuple[str, str]] = []

    def day_first(m):
        y = m.group(3) or str(year)
        iso = f"{y}-{M[m.group(2)]:02d}-{int(m.group(1)):02d}"
        changes.append((m.group(0), iso))
        return iso

    def month_first(m):
        y = m.group(3) or str(year)
        iso = f"{y}-{M[m.group(1)]:02d}-{int(m.group(2)):02d}"
        changes.append((m.group(0), iso))
        return iso

    line = DAY_FIRST.sub(day_first, line)
    line = MONTH_FIRST.sub(month_first, line)
    return line, changes


def convert(text: str, year: int) -> tuple[str, list[tuple[str, str]]]:
    out, all_changes, fence = [], [], False
    for line in text.split("\n"):
        if line.lstrip().startswith("```"):
            fence = not fence
        if not fence and line.lstrip().startswith("|"):
            line, ch = convert_line(line, year)
            all_changes.extend(ch)
        out.append(line)
    return "\n".join(out), all_changes


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("report", type=Path)
    p.add_argument("--year", type=int, default=dt.date.today().year)
    p.add_argument("--dry-run", action="store_true")
    a = p.parse_args(argv)
    text, changes = convert(a.report.read_text(), a.year)
    if a.dry_run:
        for old, new in changes:
            print(f"{old} -> {new}")
    else:
        a.report.write_text(text)
    print(f"{len(changes)} table-cell dates {'would be ' if a.dry_run else ''}converted")
    return 0


if __name__ == "__main__":
    sys.exit(main())
