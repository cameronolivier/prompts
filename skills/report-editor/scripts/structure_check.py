#!/usr/bin/env python3
"""Structure check for a markdown report.

    structure_check.py REPORT.md [--json] [--strict] [--min-repeat 3] [--ngram 6]

Reports, in markdown:
  1. Word counts per top-level section, and body versus appendix.
  2. Contents list versus actual headings (numbered sections and lettered appendices).
  3. Cross-references that do not resolve: "section 9" or "§9" with no such heading, "appendix F"
     with no such appendix, and a section that refers to itself.
  4. Repeated phrases: word n-grams that occur --min-repeat times or more in prose or table
     cells, headings excluded. A good line that lands three times has stopped working.
  5. Heading style: title-case headings, headings ending in a colon, decorative emoji.

Exit 0 always, unless --strict, which exits 1 when the contents list mismatches or any
cross-reference fails to resolve.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

SECTION_SIGN = "§"
HEADING = re.compile(r"^(#{1,6})\s+(.*?)\s*$")
NUMBERED = re.compile(r"^(\d+)\.\s+(.*)$")
LETTERED = re.compile(r"^([A-Z])\.\s+(.*)$")
FENCE = re.compile(r"^\s*```")
TABLE_ROW = re.compile(r"^\s*\|")
CONTENTS_HEADING = re.compile(r"^#{1,3}\s+(contents|table of contents)\s*$", re.IGNORECASE)
APPENDIX_HEADING = re.compile(r"^#{1,3}\s+appendi(x|ces)\b", re.IGNORECASE)
REF_SECTION = re.compile(SECTION_SIGN + r"\s?(\d+)(?:\.\d+)*|\b[Ss]ections?\s+(\d+)(?:\.\d+)*\b")
REF_APPENDIX = re.compile(r"\b[Aa]ppendi(?:x|ces)\s+([A-Z])\b")
EMOJI = re.compile("[\U0001F300-\U0001FAFF☀-➿]")
STOP = {
    "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is", "are", "was", "were",
    "it", "that", "this", "with", "as", "at", "by", "be", "not", "from", "which", "has", "have",
}


def strip_inline(text: str) -> str:
    text = re.sub(r"`[^`]*`", " ", text)
    text = re.sub(r"\*\*|__|\*|_", "", text)
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)
    return text


def words(text: str) -> int:
    return len(re.findall(r"\b[\w'’-]+\b", strip_inline(text)))


def analyse(text: str, min_repeat: int = 3, ngram: int = 6) -> dict:
    lines = text.splitlines()
    headings = []  # (level, title, line_no)
    contents_numbers: dict[str, str] = {}
    contents_letters: dict[str, str] = {}
    in_contents = False
    in_fence = False
    in_appendix = False
    section_words: Counter = Counter()
    body_words = 0
    appendix_words = 0
    current = "(preamble)"
    current_number: str | None = None
    refs: list[dict] = []
    ngrams: Counter = Counter()
    ngram_where: dict[str, set] = defaultdict(set)
    style: list[dict] = []

    for i, raw in enumerate(lines, 1):
        if FENCE.match(raw):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        h = HEADING.match(raw)
        if h:
            level, title = len(h.group(1)), strip_inline(h.group(2)).strip()
            headings.append((level, title, i))
            in_contents = bool(CONTENTS_HEADING.match(raw))
            if APPENDIX_HEADING.match(raw):
                in_appendix = True
            if level <= 2:
                current = title
                m = NUMBERED.match(title)
                current_number = m.group(1) if m else None
            # heading style
            if title.endswith(":"):
                style.append({"line": i, "heading": title, "issue": "ends with a colon"})
            if EMOJI.search(title):
                style.append({"line": i, "heading": title, "issue": "decorative emoji"})
            body = re.sub(r"^(\d+|[A-Z])\.\s+", "", title)
            caps = [w for w in body.split() if w[:1].isupper() and w.lower() not in STOP]
            if len(body.split()) >= 4 and len(caps) >= len(body.split()) - 1:
                style.append({"line": i, "heading": title, "issue": "title case"})
            continue
        if in_contents:
            item = re.sub(r"^\s*(?:[-*+]\s+)?", "", strip_inline(raw)).strip()
            m = NUMBERED.match(item) or re.match(r"^(\d+)\s+(.*)$", item)
            if m:
                contents_numbers[m.group(1)] = m.group(2).strip()
                continue
            m = LETTERED.match(item)
            if m:
                contents_letters[m.group(1)] = m.group(2).strip()
                continue
            continue
        n = words(raw)
        section_words[current] += n
        if in_appendix:
            appendix_words += n
        else:
            body_words += n
        clean = strip_inline(raw)
        for m in REF_SECTION.finditer(clean):
            num = m.group(1) or m.group(2)
            refs.append({"line": i, "kind": "section", "target": num, "in": current, "self": num == current_number})
        for m in REF_APPENDIX.finditer(clean):
            refs.append({"line": i, "kind": "appendix", "target": m.group(1), "in": current, "self": False})
        toks = re.findall(r"[a-z][a-z'’-]*", clean.lower())
        for j in range(0, max(0, len(toks) - ngram + 1)):
            g = " ".join(toks[j:j + ngram])
            if sum(1 for t in toks[j:j + ngram] if t not in STOP) < ngram // 2:
                continue
            ngrams[g] += 1
            ngram_where[g].add(current)

    heading_numbers = {}
    heading_letters = {}
    for level, title, _ in headings:
        m = NUMBERED.match(title)
        if m and level <= 2:
            heading_numbers[m.group(1)] = m.group(2).strip()
        m = LETTERED.match(title)
        if m and level <= 4:
            heading_letters[m.group(1)] = m.group(2).strip()

    def compare(listed: dict, actual: dict) -> list[dict]:
        out = []
        for k in sorted(set(listed) | set(actual), key=lambda x: (len(x), x)):
            a, b = listed.get(k), actual.get(k)
            if a is None:
                out.append({"key": k, "issue": "heading not in contents", "heading": b})
            elif b is None:
                out.append({"key": k, "issue": "in contents, no heading", "contents": a})
            elif a.lower().rstrip(".") != b.lower().rstrip("."):
                out.append({"key": k, "issue": "title differs", "contents": a, "heading": b})
        return out

    unresolved = [
        r for r in refs
        if (r["kind"] == "section" and r["target"] not in heading_numbers)
        or (r["kind"] == "appendix" and heading_letters and r["target"] not in heading_letters)
    ]
    self_refs = [r for r in refs if r["self"]]
    repeated = [
        {"phrase": g, "count": c, "sections": sorted(ngram_where[g])}
        for g, c in ngrams.most_common()
        if c >= min_repeat
    ]
    # collapse n-grams that are substrings of a longer repeated n-gram with the same count
    kept = []
    for r in repeated:
        if not any(r["phrase"] in k["phrase"] and k["count"] == r["count"] and k is not r for k in repeated):
            kept.append(r)

    return {
        "words": {"total": body_words + appendix_words, "body": body_words, "appendix": appendix_words},
        "sections": [{"section": s, "words": n} for s, n in section_words.items()],
        "contents": {
            "checked": bool(contents_numbers or contents_letters),
            "numbered": compare(contents_numbers, heading_numbers) if contents_numbers else [],
            "lettered": compare(contents_letters, heading_letters) if contents_letters else [],
        },
        "unresolved_refs": unresolved,
        "self_refs": self_refs,
        "repeated": kept[:40],
        "style": style,
    }


def render(r: dict, name: str) -> str:
    out = [f"# Structure check: `{name}`", ""]
    w = r["words"]
    out += ["## Word counts", "", "| Scope | Words |", "|---|---|",
            f"| Body | {w['body']} |", f"| Appendix | {w['appendix']} |", f"| Total | {w['total']} |", ""]
    out += ["| Section | Words |", "|---|---|"]
    out += [f"| {s['section']} | {s['words']} |" for s in r["sections"]]
    out.append("")
    out.append("## Contents versus headings")
    out.append("")
    c = r["contents"]
    if not c["checked"]:
        out.append("No contents list found.")
    else:
        issues = c["numbered"] + c["lettered"]
        if not issues:
            out.append("Contents list matches the headings.")
        for x in issues:
            detail = ", ".join(f"{k}: {v}" for k, v in x.items() if k not in ("key", "issue"))
            out.append(f"- {x['key']}: {x['issue']} ({detail})")
    out.append("")
    out.append("## Cross-references")
    out.append("")
    if not r["unresolved_refs"] and not r["self_refs"]:
        out.append("Every section and appendix reference resolves, and no section refers to itself.")
    for x in r["unresolved_refs"]:
        out.append(f"- line {x['line']}: {x['kind']} {x['target']} does not exist (in \"{x['in']}\")")
    for x in r["self_refs"]:
        out.append(f"- line {x['line']}: refers to section {x['target']} from inside it")
    out.append("")
    out.append("## Repeated phrases")
    out.append("")
    if not r["repeated"]:
        out.append("No phrase repeats at the threshold.")
    else:
        out += ["| Phrase | Times | Sections |", "|---|---|---|"]
        out += [f"| {x['phrase']} | {x['count']} | {'; '.join(x['sections'])} |" for x in r["repeated"]]
    out.append("")
    out.append("## Heading style")
    out.append("")
    if not r["style"]:
        out.append("Headings are sentence case, no trailing colons, no emoji.")
    for x in r["style"]:
        out.append(f"- line {x['line']}: {x['issue']}: {x['heading']}")
    return "\n".join(out) + "\n"


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("report", type=Path)
    p.add_argument("--json", action="store_true")
    p.add_argument("--strict", action="store_true")
    p.add_argument("--min-repeat", type=int, default=3)
    p.add_argument("--ngram", type=int, default=6)
    args = p.parse_args(argv)
    r = analyse(args.report.read_text(), args.min_repeat, args.ngram)
    if args.json:
        sys.stdout.write(json.dumps(r, indent=2) + "\n")
    else:
        sys.stdout.write(render(r, args.report.name))
    failing = r["contents"]["numbered"] or r["contents"]["lettered"] or r["unresolved_refs"] or r["self_refs"]
    return 1 if (args.strict and failing) else 0


if __name__ == "__main__":
    sys.exit(main())
