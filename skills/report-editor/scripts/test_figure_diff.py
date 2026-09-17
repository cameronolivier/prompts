"""Tests for figure_diff.py. Run: python3 -m pytest skills/report-editor/scripts -q"""
import figure_diff as fd


def counts(text):
    return fd.extract(text)["counts"]


def test_money_normalises_currency_symbol_and_commas():
    c = counts("Spend is USD 9,108 a month. Also $9,108 and about USD 3,275, 36 percent.")
    assert c["money"]["USD 9108"] == 2
    assert c["money"]["USD 3275"] == 1
    assert c["percent"]["36%"] == 1
    assert "9108" not in c["number"]


def test_percent_forms_collapse():
    c = counts("99.95% uptime. Then 99.95 percent again. And 36 per cent.")
    assert c["percent"]["99.95%"] == 2
    assert c["percent"]["36%"] == 1


def test_dates_are_one_token_not_three_numbers():
    c = counts("Dated 9 September 2026 and 2026-09-09 and April 2026.")
    assert c["date"]["9 September 2026"] == 1
    assert c["date"]["2026-09-09"] == 1
    assert c["date"]["April 2026"] == 1
    assert not c["number"]


def test_spelled_numbers_merge_with_digits():
    c = counts("Eight credentials. Later, 8 credentials again.")
    assert c["word"]["8"] == 1
    assert c["number"]["8"] == 1
    rows = fd.diff("Eight credentials.", "8 credentials.")
    # a spelled-to-digit change shows as two rows; the editor accounts for both
    kinds = {(r["kind"], r["figure"]) for r in rows}
    assert ("word", "8") in kinds and ("number", "8") in kinds


def test_structure_is_ignored():
    text = "## 6. Security\n\n1. First item has 3 things.\n\nSee §6 and section 10 and appendix C.\n|---|---|\n`port 8080` stays out.\n"
    c = counts(text)
    assert c["number"] == {"3": 1}


def test_fenced_code_is_ignored():
    text = "before 5\n```\nx = 42\n```\nafter 7\n"
    c = counts(text)
    assert set(c["number"]) == {"5", "7"}


def test_diff_reports_removed_added_changed_with_sections():
    before = "## 1. Intro\n\nWe found 31 repos and 9,108 dollars, 3 of them twice, 3 again.\n"
    after = "## 1. Intro\n\nWe found 31 repos and 3 of them.\n\n## Appendix\n\nThe 9,108 figure moved here. Also 12 new.\n"
    rows = {(r["kind"], r["figure"]): r for r in fd.diff(before, after)}
    assert ("number", "31") not in rows
    assert rows[("number", "3")]["before"] == 2 and rows[("number", "3")]["after"] == 1
    assert ("number", "9108") not in rows  # moved, same count, so not a row
    assert ("number", "12") in rows and rows[("number", "12")]["before"] == 0
    assert rows[("number", "12")]["sections_after"] == ["Appendix"]
    assert rows[("number", "12")]["entered"] == ["Appendix"] and rows[("number", "12")]["left"] == []


def test_renumbered_section_is_not_a_move():
    before = "## 6. Security\n\nThere are 8 keys.\n"
    after = "## 7. Security\n\nThere are 8 keys, 8 keys.\n"
    (row,) = fd.diff(before, after)
    assert row["left"] == [] and row["entered"] == []
    assert row["sections_before"] == ["Security"]


def test_render_has_empty_disposition_column_and_summary_line():
    md = fd.render(fd.diff("5 apples", "6 apples"), "a.md", "b.md")
    assert "1 removed, 1 added, 0 changed count" in md
    assert md.strip().splitlines()[-1].endswith("| |")


def test_render_no_change():
    md = fd.render([], "a.md", "b.md")
    assert "No figure changed" in md


def test_strict_exit_code(tmp_path, capsys):
    a, b = tmp_path / "a.md", tmp_path / "b.md"
    a.write_text("5 apples")
    b.write_text("5 apples")
    assert fd.main([str(a), str(b), "--strict"]) == 0
    b.write_text("6 apples")
    assert fd.main([str(a), str(b), "--strict"]) == 1
    assert fd.main([str(a), str(b)]) == 0
    ledger = tmp_path / "ledger.md"
    fd.main([str(a), str(b), "--ledger", str(ledger)])
    assert "Disposition" in ledger.read_text()
