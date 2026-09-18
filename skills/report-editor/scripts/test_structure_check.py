"""Tests for structure_check.py. Run: uvx pytest skills/report-editor/scripts -q"""
import structure_check as sc

DOC = """# Report title

## Contents

0. Executive summary
1. Systems and repositories
2. Data flows

**Appendix**

- A. Claim to evidence
- B. Cost detail

## 0. Executive summary

The verdict in one paragraph. See section 1 and §2. Also appendix B and appendix Z.

## 1. Systems and repositories

This is section 1 talking about itself. It repeats a good line here, and it repeats a good line here.

| Col | Val |
|---|---|
| it repeats a good line here | 1 |

## 2. Data Flows And Other Things:

Body text. Nothing new. It repeats a good line here.

## Appendix

### A. Claim to evidence

Appendix words here.

### C. Cost detail

More appendix words.
"""


def test_word_counts_split_body_and_appendix():
    r = sc.analyse(DOC)
    assert r["words"]["appendix"] > 0
    assert r["words"]["body"] > r["words"]["appendix"]
    assert r["words"]["total"] == r["words"]["body"] + r["words"]["appendix"]


def test_contents_mismatch_detected():
    r = sc.analyse(DOC)
    numbered = {x["key"]: x for x in r["contents"]["numbered"]}
    assert set(numbered) == {"2"}  # title differs: "Data flows" vs "Data Flows And Other Things:"
    assert numbered["2"]["issue"] == "title differs"
    lettered = {x["key"]: x["issue"] for x in r["contents"]["lettered"]}
    assert lettered == {"B": "in contents, no heading", "C": "heading not in contents"}


def test_unresolved_and_self_references():
    r = sc.analyse(DOC)
    unresolved = {(x["kind"], x["target"]) for x in r["unresolved_refs"]}
    # B is listed in the contents but has no heading, so a reference to it is also unresolved
    assert unresolved == {("appendix", "Z"), ("appendix", "B")}
    assert [x["target"] for x in r["self_refs"]] == ["1"]


def test_repeated_phrase_counted_in_prose_and_tables():
    r = sc.analyse(DOC, min_repeat=3, ngram=5)
    phrases = {x["phrase"]: x for x in r["repeated"]}
    hit = next((p for p in phrases if "repeats a good line" in p), None)
    assert hit is not None
    assert phrases[hit]["count"] == 4  # three in prose, one in a table cell
    assert set(phrases[hit]["sections"]) == {"1. Systems and repositories", "2. Data Flows And Other Things:"}


def test_heading_style_flags():
    r = sc.analyse(DOC)
    issues = {(x["heading"], x["issue"]) for x in r["style"]}
    assert ("2. Data Flows And Other Things:", "ends with a colon") in issues
    assert ("2. Data Flows And Other Things:", "title case") in issues
    assert not any(h.startswith("1.") for h, _ in issues)


def test_render_and_strict_exit(tmp_path):
    f = tmp_path / "r.md"
    f.write_text(DOC)
    assert sc.main([str(f)]) == 0
    assert sc.main([str(f), "--strict"]) == 1
    clean = tmp_path / "c.md"
    clean.write_text("# T\n\n## 1. One\n\nText. See section 1.\n")
    # self reference only; still failing under strict
    assert sc.main([str(clean), "--strict"]) == 1
    clean.write_text("# T\n\n## 1. One\n\nText.\n\n## 2. Two\n\nSee section 1.\n")
    assert sc.main([str(clean), "--strict"]) == 0
    md = sc.render(sc.analyse(DOC), "r.md")
    assert "## Repeated phrases" in md and "appendix Z does not exist" in md
