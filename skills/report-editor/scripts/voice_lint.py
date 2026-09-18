#!/usr/bin/env python3
"""Deterministic linter for the MOHARA voice (Global English) rules.

Bundled copy of mo-ai tools/voice-lint/voice_lint.py (MOHARA internal, informed by
ASD-STE100). Kept verbatim below the header so upstream fixes can be diffed in. The
report-editor skill runs it before and after every pass and reports both results.

Encodes the mechanically checkable rules from
plugins/mo-ai/skills/_shared/voice.md (informed by ASD-STE100).
Heuristic by design: it measures rule adherence for eval comparisons,
it does not replace human review.

Usage:
    voice_lint.py FILE [FILE ...]      lint one or more markdown files
    voice_lint.py --json FILE ...      machine-readable output
    cat doc.md | voice_lint.py -       lint stdin

Exit code is 1 when any zero-tolerance rule has findings, else 0.
"""

import argparse
import json
import re
import sys
from pathlib import Path

# --- rule data -----------------------------------------------------------

FILLER_PHRASES = [
    "it's worth noting", "it is worth noting",
    "in order to", "as previously mentioned", "as mentioned above",
    "it should be noted", "please note that", "needless to say",
    "at the end of the day", "first and foremost", "last but not least",
    "each and every", "in the process of", "for all intents and purposes",
]

IDIOMS = [
    "out of the box", "ballpark", "circle back", "low-hanging fruit",
    "touch base", "move the needle", "silver bullet", "on the same page",
    "quick win", "boil the ocean", "double-edged sword", "in the weeds",
    "table stakes", "north star", "game changer", "up to speed",
    "hit the ground running", "down the line", "at this juncture",
]

# "impressive" words with a plain replacement (voice.md: Plain words)
IMPRESSIVE_WORDS = {
    "utilise": "use", "utilize": "use", "utilisation": "use", "utilization": "use",
    "initiate": "start", "commence": "start",
    "sufficient": "enough", "insufficient": "not enough",
    "leverage": "use", "leverages": "uses", "leveraging": "using",
    "facilitate": "help / enable", "facilitates": "helps / enables",
    "endeavour": "try", "endeavor": "try",
    "prior to": "before", "subsequent to": "after",
    "in the event that": "if", "aforementioned": "the/this",
    "terminate": "stop / end", "ascertain": "find / check",
}

# acronyms considered universally known; not flagged for expansion
ABBREV_WHITELIST = {
    "API", "APIS", "URL", "URLS", "URI", "HTTP", "HTTPS", "JSON", "XML",
    "HTML", "CSS", "SQL", "ID", "IDS", "UI", "CSV", "PDF", "README",
    "OK", "MOHARA", "AI", "REST", "TSD", "MD", "PRD", "PRDS",
    # vendor and region names, not expandable abbreviations
    "AWS", "GCP", "SAP", "IBM", "UK", "EU", "US", "USA", "IT",
    # caught by the tbc-padding rule instead
    "TBC", "TBD", "NA",
}

TBC_PATTERN = re.compile(r"\b(TBC|TBD|N/?A)\b", re.IGNORECASE)
AMBIGUOUS_DATE = re.compile(r"\b\d{1,2}/\d{1,2}/\d{2,4}\b")
ACRONYM = re.compile(r"\b[A-Z][A-Za-z]{1,5}\b")

# be-verb (+ optional adverb) + past participle
PASSIVE = re.compile(
    r"\b(?:is|are|was|were|be|been|being|gets?|got)\s+(?:\w+ly\s+)?"
    r"(\w+ed|shown|given|made|done|held|kept|left|sent|set|told|built|found|"
    r"brought|chosen|written|taken|seen|known|drawn|thrown|hidden|broken|"
    r"driven|run|met|paid|read|put|granted|required)\b",
    re.IGNORECASE,
)
# common false positives for the passive regex ("is completed" as state is
# still worth flagging; these are genuinely not passive)
PASSIVE_SKIP = re.compile(r"\b(?:is|are|was|were)\s+(?:need|allow|suppos)ed\s+to\b", re.IGNORECASE)

SENTENCE_WORD_LIMIT = 25  # ASD-STE100 hard limit; voice.md aims under 20


# --- markdown handling ----------------------------------------------------

def classify_lines(text: str):
    """Yield (lineno, line, kind) where kind is 'prose', 'table', 'code',
    'heading', 'label' or 'blank'. Dashes/colons are allowed in 'table' and
    'label' lines per voice.md."""
    in_fence = False
    for i, line in enumerate(text.splitlines(), 1):
        stripped = line.strip()
        if stripped.startswith("```") or stripped.startswith("~~~"):
            in_fence = not in_fence
            yield i, line, "code"
            continue
        if in_fence:
            yield i, line, "code"
        elif not stripped:
            yield i, line, "blank"
        elif stripped.startswith("|") or set(stripped) <= {"-", "|", ":", " "}:
            yield i, line, "table"
        elif stripped.startswith("#"):
            yield i, line, "heading"
        elif re.match(r"^[-*]?\s*\*\*[^*]{1,60}\*\*\s*[:—–-]?", stripped) and "**" in stripped[:4]:
            # label-value line: "**Priority:** High" / "- **Actor** — admin"
            yield i, line, "label"
        else:
            yield i, line, "prose"


def strip_inline_markup(s: str) -> str:
    s = re.sub(r"`[^`]*`", " ", s)               # inline code
    s = re.sub(r"!?\[([^\]]*)\]\([^)]*\)", r"\1", s)  # links/images
    s = re.sub(r"[*_>#]", " ", s)
    return s


def sentences_of(text_lines):
    """Split prose/label lines into sentences (lists of words).

    Lines join into a unit only within an unbroken run of prose lines
    (a wrapped paragraph); headings, labels, bullets, and blank lines
    end the unit so unterminated lines never merge into false long
    sentences."""
    units, buf = [], []

    def flush():
        if buf:
            units.append(" ".join(buf))
            buf.clear()

    for _, line, kind in text_lines:
        stripped = line.strip()
        if kind == "prose" and not re.match(r"^[-*+]\s|^\d+\.\s", stripped):
            buf.append(strip_inline_markup(stripped))
            continue
        flush()
        if kind in ("prose", "label"):  # bullet or label line: own unit
            units.append(strip_inline_markup(stripped))
    flush()

    sents = []
    for unit in units:
        for part in re.split(r"(?<=[.!?])\s+", unit):
            if part.split():
                sents.append(part.split())
    return sents


# --- linting --------------------------------------------------------------

def lint_text(text: str) -> dict:
    lines = list(classify_lines(text))
    prose_lines = [(n, l, k) for n, l, k in lines if k in ("prose", "label", "heading")]
    findings = []

    def add(rule, lineno, excerpt):
        findings.append({"rule": rule, "line": lineno, "excerpt": excerpt.strip()[:120]})

    for n, line, kind in lines:
        if kind in ("code", "blank", "table"):
            continue
        clean = strip_inline_markup(line)
        low = clean.lower()

        # em-dashes in sentences (allowed in table/label/heading contexts —
        # a title dash is not a sentence boundary)
        if kind == "prose" and ("—" in clean or "–" in clean):
            add("em-dash", n, line)

        for phrase in FILLER_PHRASES:
            if phrase in low:
                add("filler", n, line)
        for idiom in IDIOMS:
            if re.search(r"\b" + re.escape(idiom) + r"\b", low):
                add("idiom", n, line)
        for word, plain in IMPRESSIVE_WORDS.items():
            if re.search(r"\b" + re.escape(word) + r"\b", low):
                add("plain-words", n, f"'{word}' -> '{plain}': {line}")
        if TBC_PATTERN.search(clean):
            add("tbc-padding", n, line)
        if AMBIGUOUS_DATE.search(clean):
            add("ambiguous-date", n, line)
        if kind != "code":
            m = PASSIVE.search(clean)
            if m and not PASSIVE_SKIP.search(clean):
                add("passive-voice", n, line)

    # unexpanded abbreviations: first use must sit next to a parenthetical
    seen = set()
    for n, line, kind in prose_lines + [(n, l, k) for n, l, k in lines if k == "table"]:
        for m in ACRONYM.finditer(strip_inline_markup(line)):
            token = m.group(0)
            if token.upper() != token and not re.match(r"^[A-Z][a-z]*[A-Z]", token):
                continue  # plain capitalised word like "The"
            if len(token) < 2 or token.upper() in ABBREV_WHITELIST or token in seen:
                continue
            seen.add(token)
            expanded = re.search(
                r"\(\s*" + re.escape(token) + r"s?\s*\)|" + re.escape(token) + r"\s*\(",
                text,
            )
            if not expanded:
                add("unexpanded-abbrev", n, f"'{token}' never expanded: {line}")

    sents = sentences_of(lines)
    long_sents = [s for s in sents if len(s) > SENTENCE_WORD_LIMIT]
    for s in long_sents:
        add("long-sentence", 0, f"({len(s)}w) " + " ".join(s))

    word_count = sum(len(s) for s in sents)
    metrics = {
        "words": word_count,
        "sentences": len(sents),
        "avg_sentence_words": round(word_count / len(sents), 1) if sents else 0.0,
        "sentences_over_25w": len(long_sents),
    }

    counts = {}
    for f in findings:
        counts[f["rule"]] = counts.get(f["rule"], 0) + 1

    all_rules = ["em-dash", "filler", "idiom", "plain-words", "tbc-padding",
                 "ambiguous-date", "passive-voice", "unexpanded-abbrev", "long-sentence"]
    rules_passed = sum(1 for r in all_rules if counts.get(r, 0) == 0)

    return {
        "metrics": metrics,
        "counts": counts,
        "rules_passed": rules_passed,
        "rules_total": len(all_rules),
        "findings": findings,
    }


# --- CLI ------------------------------------------------------------------

def print_human(name: str, result: dict, verbose: bool):
    m, c = result["metrics"], result["counts"]
    print(f"\n== {name} ==")
    print(f"  words: {m['words']}  sentences: {m['sentences']}  "
          f"avg sentence: {m['avg_sentence_words']}w  over-{SENTENCE_WORD_LIMIT}w: {m['sentences_over_25w']}")
    print(f"  rules passed: {result['rules_passed']}/{result['rules_total']}")
    if c:
        for rule, n in sorted(c.items(), key=lambda kv: -kv[1]):
            print(f"    {rule}: {n}")
    if verbose:
        for f in result["findings"]:
            loc = f"L{f['line']}" if f["line"] else "-"
            print(f"    [{f['rule']}] {loc}: {f['excerpt']}")


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("files", nargs="+", help="markdown files, or '-' for stdin")
    ap.add_argument("--json", action="store_true", help="JSON output")
    ap.add_argument("-v", "--verbose", action="store_true", help="show each finding")
    args = ap.parse_args()

    results, failed = {}, False
    for f in args.files:
        text = sys.stdin.read() if f == "-" else Path(f).read_text(encoding="utf-8")
        result = lint_text(text)
        results[f] = result
        if result["counts"]:
            failed = True
        if not args.json:
            print_human(f, result, args.verbose)

    if args.json:
        json.dump(results, sys.stdout, indent=2)
        print()
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
