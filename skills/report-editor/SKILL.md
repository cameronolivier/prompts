---
name: report-editor
description: >
  Edit a compiled report draft into a short, plain, stakeholder-ready document without
  changing a fact. Cuts AI tells, moves evidence to the appendix, fixes structure, and keeps
  a ledger of every figure that moved. Use when the user says "edit this report", "unslop the
  report", "make the final report shine", "tighten the founder report", "this reads like AI",
  "cut the report to length", or invokes /report-editor <file>. Editor only: it does not
  research, generate findings, or produce a companion document on its own.
argument-hint: <report.md> [--fix] [--copy] [--audience leadership|engineering|board]
allowed-tools:
  - Read
  - Grep
  - Glob
  - Write
  - Edit
  - Bash(python3 *report-editor/scripts/figure_diff.py:*)
  - Bash(python3 *report-editor/scripts/structure_check.py:*)
  - Bash(git status:*)
  - Bash(git diff:*)
  - Bash(git add:*)
  - Bash(git commit:*)
  - Bash(git checkout -b:*)
  - Bash(git switch -c:*)
  - Bash(wc:*)
model: opus
---

# Report editor

Takes a draft that already has its facts and turns it into the version people read. The rules
are in `RULES.md` beside this file. Read it in full before the first stage. Every rule has a
stable id; cite ids in the critique so the user can push back on a rule, not on a sentence.

**Two invariants that override everything else.**

1. No fact changes. A number, name, date, path or quoted phrase leaves the body only if it
   lands in the appendix, is summed into a figure whose working is shown, or is written off in
   the ledger with a reason. `scripts/figure_diff.py` produces the ledger. Every row gets a
   disposition before a stage is committed.
2. The user decides structure. Moving, merging or splitting sections is proposed in the
   critique and applied only after the checkpoint, unless `--fix` is set.

## Arguments

| Argument | Effect |
|---|---|
| `<report.md>` | The draft. Required. |
| `--fix` | Do not stop at the checkpoint. Take the recommended answer to every ruling and record each as `assumed` in the critique. Never splits the document. |
| `--copy` | Write the edited version to `<name>-<YYYY-MM-DD>.md` beside the original instead of editing in place. Use when other documents cite the draft by section number. |
| `--audience` | Override the audience. Default comes from the project, else `leadership`. See RULES.md section A. |

## Stage 0: discover the project

Read the project `CLAUDE.md`. Look for a `## Report editing` section. It may name:

- `audience`: one of leadership, engineering, board.
- `brief`: a file with the client's format or tone requirements.
- `invariants`: a file listing claims that must survive any rewrite.
- `verify`: one or more commands that re-derive published figures. Run each, read the output.
- `length`: a body word target, or "from preamble" to take it from the draft's own status block.
- `dates`: `prose` or `iso` for narrative dates.

Also read the draft's own preamble and glossary. A glossary that declares two terms as
synonyms is the only licence for using both (rule A4).

Defaults when nothing is declared: audience leadership, no brief, no invariants, bundled
scripts only, length target 3,500 words in the body, ISO dates.

Then run, from the skill directory:

```
python3 scripts/structure_check.py <report.md>
```

Report what was found and what was not, in one short block, before writing anything. Without
`--fix`, ask the user whether anything is missing and wait. With `--fix`, continue.

## Stage 1: critique

No edits. Write `working/report-editor-critique-<YYYY-MM-DD>.md` (or beside the report when
there is no `working/` directory) with these sections, in this order:

1. What this document is, who reads it, target length, current body and appendix word counts.
2. Structural problems in payoff order. Each names the rule id, the sections involved, the
   words saved, and the recommended move.
3. Repetition table from the structure check, with a keep-here decision per phrase.
4. Figure inventory: the anchor numbers, where each appears, and any figure that appears with
   two values or without its counting rule (rule F3, F4).
5. Rulings needed. Every decision that is the user's: splits, deletions of evidenced content,
   contradictions between sections, attribution, anything the invariants file makes ambiguous.
   Each ruling states the recommended answer.

Commit: `docs(report): critique <name>`.

## Checkpoint

Present the rulings list. Wait for answers. Record each answer in the critique under its
ruling. With `--fix`, skip the wait, take every recommended answer, mark each `assumed`.

## Stage 2: structure pass

Apply only the rulings. Move sections, merge, cut forward pointers, convert lists to tables,
fold evidence into the appendix. Do not touch sentence-level prose yet. Then:

```
python3 scripts/figure_diff.py <original> <edited> --ledger working/report-editor-ledger-<date>.md
python3 scripts/structure_check.py <edited> --strict
```

Fill every Disposition cell in the ledger. Fix every contents mismatch and unresolved
reference. Commit: `docs(report): restructure <name>`.

## Stage 3: prose pass

Section by section, apply RULES.md sections P, T, A, B. Keep paragraphs under about 240
characters and sentences under 20 words unless a fact needs more. Rerun both scripts. Any new
ledger row gets a disposition. Commit: `docs(report): edit prose <name>`.

## Stage 4: report

Reply with: body and appendix word counts before and after, ledger row count and how many are
summed or moved versus dropped, rulings taken (and which were assumed), anything left open, and
the paths of the critique and ledger. Run the project's `verify` commands again if declared and
state whether they still agree with the document.

## When another skill wants this one

Invoke after generation, with the generated file as the argument. Pass `--fix` only when the
caller has already collected the user's structural decisions.
