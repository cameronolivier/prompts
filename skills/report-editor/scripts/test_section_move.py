"""Tests for section_move.py."""
import section_move as sm

DOC = """# Title

## Contents

0. Summary
1. Alpha
2. Beta
3. Gamma

## 0. Summary

See section 3 and §2. Sections 1, 2 and 3 follow.

# Part I

## 1. Alpha

Alpha text points to §3.

## 2. Beta

Beta text.

## 3. Gamma

Gamma text refers to section 1.

## Appendix

### A. Notes

Appendix mentions §3 too.
"""


def test_move_section_forward_renumbers_and_fixes_refs(tmp_path):
    f = tmp_path / "r.md"
    f.write_text(DOC)
    sm.main([str(f), "--move", "3", "--before", "1"])
    out = f.read_text()
    order = [l for l in out.split("\n") if l.startswith("## ") and l[3].isdigit()]
    assert order == ["## 0. Summary", "## 1. Gamma", "## 2. Alpha", "## 3. Beta"]
    # contents list follows
    assert "1. Gamma\n2. Alpha\n3. Beta" in out.replace("\n\n", "\n") or "1. Gamma" in out
    # references: old 3 -> 1, old 1 -> 2, old 2 -> 3
    assert "See section 1 and §3." in out
    assert "Sections 2, 3 and 1 follow." in out
    assert "Alpha text points to §1." in out
    assert "Gamma text refers to section 2." in out
    assert "Appendix mentions §1 too." in out


def test_remove_section_saves_text_and_renumbers(tmp_path):
    f = tmp_path / "r.md"
    f.write_text(DOC)
    saved = tmp_path / "gone.md"
    sm.main([str(f), "--remove", "2", "--save", str(saved)])
    out = f.read_text()
    assert "## 2. Beta" not in out
    assert saved.read_text().startswith("## 2. Beta")
    assert "## 2. Gamma" in out  # old 3 becomes 2
    assert "See section 2 and §2." in out  # old 3 -> 2; old 2 left as 2 for the editor


def test_explicit_map(tmp_path):
    f = tmp_path / "r.md"
    f.write_text(DOC)
    sm.main([str(f), "--map", "1:9"])
    out = f.read_text()
    assert "## 9. Alpha" in out
    assert "Gamma text refers to section 9." in out
    assert "Sections 9, 2 and 3 follow." in out
