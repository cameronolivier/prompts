#!/usr/bin/env python3
"""Move, remove or renumber numbered sections in a markdown report and fix every cross-reference.

    section_move.py REPORT.md --move 7 --before 5          # move section 7 to sit before section 5
    section_move.py REPORT.md --remove 9 --save OUT.md     # cut section 9 out, save its text aside
    section_move.py REPORT.md --map 7:5,5:6,6:7,10:9,11:10 # renumber only, no moves

A section is a "## N. Title" heading and everything up to the next "## " or "# " heading. Moves
and removals renumber the remaining sections in reading order (0 stays 0) and rewrite every
"§N", "section N", "sections N and M" and contents-list entry to the new numbers. --map applies an
explicit old:new mapping instead of deriving one. Nothing else in the file changes. Prints the
mapping it applied. Run structure_check.py --strict afterwards.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

H2 = re.compile(r"^## (\d+)\. (.*)$")
BREAK = re.compile(r"^(## |# )")
SECTION_SIGN = "§"
PH = "␂"


def split_sections(lines: list[str]) -> list[tuple[str | None, int, int]]:
    """Return (number or None, start, end) spans covering the whole file, in order."""
    spans, start, num = [], 0, None
    for i, line in enumerate(lines):
        if BREAK.match(line) and i != start:
            spans.append((num, start, i))
            start = i
            m = H2.match(line)
            num = m.group(1) if m else None
        elif i == start:
            m = H2.match(line)
            num = m.group(1) if m else None
    spans.append((num, start, len(lines)))
    return spans


def renumber(text: str, mapping: dict[str, str]) -> str:
    def remap(n: str) -> str:
        return PH + mapping.get(n, n) + PH

    text = re.sub(r"^## (\d+)\. ", lambda m: f"## {remap(m.group(1))}. ", text, flags=re.M)
    # contents list entries: a line that is just "N. Title" (optionally list-marked)
    text = re.sub(r"^(\s*(?:[-*+] )?)(\d+)\. (?=[A-Z])", lambda m: f"{m.group(1)}{remap(m.group(2))}. ", text, flags=re.M)
    text = re.sub(SECTION_SIGN + r"\s?(\d+)\b", lambda m: SECTION_SIGN + remap(m.group(1)), text)
    text = re.sub(r"([Ss]ections? )(\d+)\b", lambda m: m.group(1) + remap(m.group(2)), text)
    # "sections 5, 6 and 8": remap the trailing numbers too
    def tail(m):
        return m.group(1) + re.sub(r"\b(\d+)\b", lambda k: remap(k.group(1)), m.group(2))
    text = re.sub(r"([Ss]ections " + PH + r"\d+" + PH + r")((?:,? (?:and |or )?\d+\b)+)", tail, text)
    return text.replace(PH, "")


def derive_mapping(order: list[str]) -> dict[str, str]:
    """Given old section numbers in their new reading order, map each to its new number."""
    mapping, next_n = {}, 0
    for old in order:
        if old == "0":
            mapping[old] = "0"
            continue
        next_n += 1
        mapping[old] = str(next_n)
    return mapping


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("report", type=Path)
    p.add_argument("--move", help="section number to move")
    p.add_argument("--before", help="section number it moves in front of")
    p.add_argument("--remove", help="section number to cut out")
    p.add_argument("--save", type=Path, help="with --remove, write the removed text here")
    p.add_argument("--map", help="explicit old:new,old:new renumbering; no move")
    a = p.parse_args(argv)
    text = a.report.read_text()
    lines = text.split("\n")

    if a.map:
        mapping = dict(pair.split(":") for pair in a.map.split(","))
        a.report.write_text(renumber(text, mapping))
        print("renumbered:", mapping)
        return 0

    spans = split_sections(lines)
    numbered = [s for s in spans if s[0] is not None]
    if a.remove:
        victim = next(s for s in numbered if s[0] == a.remove)
        removed = "\n".join(lines[victim[1]:victim[2]])
        if a.save:
            a.save.write_text(removed + "\n")
        lines = lines[:victim[1]] + lines[victim[2]:]
        order = [s[0] for s in numbered if s[0] != a.remove]
    elif a.move and a.before:
        src = next(s for s in numbered if s[0] == a.move)
        block = lines[src[1]:src[2]]
        del lines[src[1]:src[2]]
        # recompute target after deletion
        spans2 = split_sections(lines)
        dst = next(s for s in spans2 if s[0] == a.before)
        lines[dst[1]:dst[1]] = block
        order = [s[0] for s in split_sections(lines) if s[0] is not None]
    else:
        p.error("give --move N --before M, or --remove N, or --map")
    mapping = derive_mapping(order)
    mapping = {k: v for k, v in mapping.items() if k != v}
    if a.remove:
        mapping[a.remove] = a.remove  # references to a removed section are left for the editor to retarget
        del mapping[a.remove]
    out = renumber("\n".join(lines), mapping)
    a.report.write_text(out)
    print("renumbered:", mapping or "nothing")
    if a.remove:
        print(f"removed section {a.remove}; references to it still say {a.remove} and need a new target")
    return 0


if __name__ == "__main__":
    sys.exit(main())
