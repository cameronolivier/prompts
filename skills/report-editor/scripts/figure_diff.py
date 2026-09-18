#!/usr/bin/env python3
"""Figure ledger: which numbers, amounts, percentages and dates changed between two drafts.

    figure_diff.py BEFORE.md AFTER.md [--ledger OUT.md] [--json] [--strict]

Prints a markdown table of every figure whose occurrence count differs between the two files,
the sections it left and entered, and an empty Disposition column for the editor to fill
(moved to appendix, summed into X, dropped as noise). Section names are compared without their
number, so renumbering alone does not show as a move. Exit code is 0 unless --strict, in which
case any change exits 1. This is a ledger, not a gate: removing or summing a figure is allowed when
the editor accounts for it in the ledger.

Spelled-out numbers (one to twenty) count as the numeral, so "eight" becoming "8" is not a row.
Deliberately ignored: section references (section 6, appendix C), heading numbers, list markers,
table separator rows, fenced code, and inline code spans.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

MONTHS = (
    "January|February|March|April|May|June|July|August|September|October|November|December"
)
WORDS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8,
    "nine": 9, "ten": 10, "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14,
    "fifteen": 15, "sixteen": 16, "seventeen": 17, "eighteen": 18, "nineteen": 19, "twenty": 20,
}
CURRENCIES = "USD|GBP|EUR|ZAR|MXN|THB|AUD|CAD"
SECTION_SIGN = "§"

# Order matters: longer, more specific patterns first so they consume their digits.
PATTERNS = [
    ("date", re.compile(r"\b\d{4}-\d{2}-\d{2}\b")),
    ("date", re.compile(rf"\b\d{{1,2}} (?:{MONTHS}) \d{{4}}\b")),
    ("date", re.compile(rf"\b(?:{MONTHS}) \d{{4}}\b")),
    ("money", re.compile(rf"\b(?:{CURRENCIES})\s?\d[\d,]*(?:\.\d+)?\s?(?:[kKmM]\b|million\b|thousand\b)?")),
    ("money", re.compile(r"[$£€]\s?\d[\d,]*(?:\.\d+)?\s?(?:[kKmM]\b|million\b|thousand\b)?")),
    ("percent", re.compile(r"\b\d[\d,]*(?:\.\d+)?\s?(?:%|percent\b|per cent\b)")),
    ("ref", re.compile(SECTION_SIGN + r"\s?\d+(?:\.\d+)*")),
    ("ref", re.compile(r"\b(?:[Ss]ection|[Aa]ppendix|[Pp]art|[Pp]hase|[Ii]tem)\s+(?:\d+(?:\.\d+)*|[A-Z]|[IVX]+)\b")),
    ("number", re.compile(r"\b\d[\d,]*(?:\.\d+)?\b")),
    ("word", re.compile(r"\b(?:" + "|".join(WORDS) + r")\b", re.IGNORECASE)),
]

HEADING = re.compile(r"^(#{1,6})\s+(.*?)\s*$")
LIST_MARKER = re.compile(r"^\s*(?:\d+\.|[-*+]|[A-Z]\.)\s+")
TABLE_SEP = re.compile(r"^\s*\|?\s*:?-{2,}")
FENCE = re.compile(r"^\s*```")


def normalise(kind: str, text: str) -> str:
    t = text.strip()
    if kind == "word":
        return str(WORDS[t.lower()])
    if kind == "percent":
        num = re.sub(r"\s?(?:%|percent|per cent)$", "", t).replace(",", "")
        return f"{num}%"
    if kind == "money":
        t = re.sub(r"\s+", " ", t)
        m = re.match(rf"({CURRENCIES}|[$£€])\s?([\d,]+(?:\.\d+)?)\s?(.*)", t)
        if not m:
            return t
        cur, num, suffix = m.groups()
        cur = {"$": "USD", "£": "GBP", "€": "EUR"}.get(cur, cur)
        suffix = suffix.strip()
        return f"{cur} {num.replace(',', '')}" + (f" {suffix}" if suffix else "")
    if kind == "number":
        return t.replace(",", "")
    return t


def extract(text: str) -> dict:
    """Return counts per kind and the set of sections each figure appears in."""
    counts: dict[str, Counter] = defaultdict(Counter)
    sections: dict[str, set] = defaultdict(set)
    section = "(preamble)"
    in_fence = False
    for raw in text.splitlines():
        if FENCE.match(raw):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        h = HEADING.match(raw)
        if h:
            if len(h.group(1)) <= 2:
                # drop the section number so a renumbered section is not reported as a move
                section = re.sub(r"^(?:\d+|[A-Z])\.\s+", "", h.group(2))
            continue  # heading numbers are structure, not figures
        if TABLE_SEP.match(raw):
            continue
        line = LIST_MARKER.sub("", raw)
        line = re.sub(r"`[^`]*`", " ", line)  # code spans hold identifiers, not figures
        for kind, pat in PATTERNS:
            for m in pat.finditer(line):
                if kind == "ref":
                    continue  # structure_check.py owns cross-references
                key = normalise(kind, m.group(0))
                counts[kind][key] += 1
                sections[key].add(section)
            line = pat.sub(lambda _m: " " * len(_m.group(0)), line)
    return {"counts": counts, "sections": sections}


def fold_words(ex: dict) -> None:
    """Merge spelled-out numbers into the numeral counts, so 'eight' and '8' are one figure."""
    words = ex["counts"].pop("word", None)
    if not words:
        return
    for key, n in words.items():
        ex["counts"]["number"][key] += n


def diff(before: str, after: str) -> list[dict]:
    b, a = extract(before), extract(after)
    fold_words(b)
    fold_words(a)
    rows = []
    kinds = set(b["counts"]) | set(a["counts"])
    for kind in sorted(kinds):
        keys = set(b["counts"][kind]) | set(a["counts"][kind])
        for key in sorted(keys, key=lambda k: (-(b["counts"][kind][k] + a["counts"][kind][k]), k)):
            nb, na = b["counts"][kind][key], a["counts"][kind][key]
            if nb == na:
                continue
            sb, sa = b["sections"].get(key, set()), a["sections"].get(key, set())
            rows.append({
                "kind": kind,
                "figure": key,
                "before": nb,
                "after": na,
                "sections_before": sorted(sb),
                "sections_after": sorted(sa),
                "left": sorted(sb - sa),   # sections it no longer appears in
                "entered": sorted(sa - sb),  # sections it newly appears in
            })
    return rows


def render(rows: list[dict], before_name: str, after_name: str) -> str:
    out = [f"# Figure ledger: `{before_name}` to `{after_name}`", ""]
    if not rows:
        out.append(
            "No figure changed. Every number, amount, percentage and date occurs the same "
            "number of times in both files."
        )
        return "\n".join(out) + "\n"
    removed = [r for r in rows if r["after"] == 0]
    added = [r for r in rows if r["before"] == 0]
    changed = [r for r in rows if r["before"] and r["after"]]
    out.append(
        f"{len(removed)} removed, {len(added)} added, {len(changed)} changed count. "
        "Every row needs a disposition before the pass is done."
    )
    out.append("")
    out.append("| Kind | Figure | Before | After | Left | Entered | Disposition |")
    out.append("|---|---|---|---|---|---|---|")
    for r in removed + added + changed:
        left = "; ".join(r["left"]) or "-"
        entered = "; ".join(r["entered"]) or "-"
        out.append(f"| {r['kind']} | {r['figure']} | {r['before']} | {r['after']} | {left} | {entered} | |")
    return "\n".join(out) + "\n"


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("before", type=Path)
    p.add_argument("after", type=Path)
    p.add_argument("--ledger", type=Path, help="write the markdown table here as well as stdout")
    p.add_argument("--json", action="store_true", help="emit JSON rows instead of markdown")
    p.add_argument("--strict", action="store_true", help="exit 1 if any figure changed")
    args = p.parse_args(argv)
    rows = diff(args.before.read_text(), args.after.read_text())
    if args.json:
        sys.stdout.write(json.dumps(rows, indent=2) + "\n")
    else:
        md = render(rows, args.before.name, args.after.name)
        sys.stdout.write(md)
        if args.ledger:
            args.ledger.write_text(md)
    return 1 if (args.strict and rows) else 0


if __name__ == "__main__":
    sys.exit(main())
