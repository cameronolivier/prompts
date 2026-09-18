"""Tests for iso_tables.py."""
import iso_tables as it

DOC = """Read on 9 September in prose stays.

| Claim | Evidence |
|---|---|
| A | read 9 September |
| B | created 18 August 2026 and again September 3, 2026 |
| C | built in May 2025 |

```
| not a table: 1 June
```
"""


def test_converts_only_table_cells():
    out, changes = it.convert(DOC, 2026)
    assert "Read on 9 September in prose stays." in out
    assert "| A | read 2026-09-09 |" in out
    assert "| B | created 2026-08-18 and again 2026-09-03 |" in out
    assert "| C | built in May 2025 |" in out  # month-only left alone
    assert "1 June" in out  # inside a fence
    assert len(changes) == 3


def test_cli_dry_run_writes_nothing(tmp_path, capsys):
    f = tmp_path / "r.md"
    f.write_text(DOC)
    it.main([str(f), "--year", "2026", "--dry-run"])
    assert f.read_text() == DOC
    assert "3 table-cell dates would be converted" in capsys.readouterr().out
    it.main([str(f), "--year", "2026"])
    assert "2026-09-09" in f.read_text()
