# html-view Skill — Design Spec

**Date:** 2026-06-12
**Status:** Approved

## Purpose

Turn any markdown doc (plan, research, RCA) into a beautiful, self-contained HTML page — or generate the HTML directly when asked for it during research. Optimised for fast comprehension: critical info surfaced, the right UI element per data shape, copy buttons everywhere useful.

## Modes

1. **Convert:** "give me an html view of plan.md" → reads md, emits sibling `plan.html`, auto-opens in browser.
2. **Direct:** "write this research up as HTML" → same design system, composed straight from findings (no md source required).

## Architecture — hybrid generation

Fixed design system bundled in the skill; agent does semantic analysis and composes the body from a component catalog. A deterministic script assembles the final file. The agent never re-emits CSS/JS — keeps runs cheap and the look consistent across all docs.

```
skills/html-view/
├── SKILL.md              # workflow + semantic-analysis rules
├── assets/
│   ├── style.css         # editorial design system; light/dark via prefers-color-scheme
│   ├── app.js            # scrollspy TOC, copy buttons, collapsibles, sortable tables
│   └── template.html     # shell with {{TITLE}}/{{CSS}}/{{JS}}/{{BODY}}/{{FOOTER}} slots
├── scripts/
│   └── build.sh          # assembles body + assets → single self-contained .html, opens it
└── references/
    └── COMPONENTS.md     # component catalog: markup pattern + when to use each
```

Mermaid: not vendored in git. `build.sh` detects mermaid blocks in the body, downloads mermaid.min.js once to `~/.cache/html-view/`, and inlines it only into files that need it.

## Visual direction

Editorial + data cards (Linear/Stripe-docs feel): refined typography, generous whitespace, calm base palette; color reserved for semantic callouts and stat cards. Single design system, auto light/dark via `prefers-color-scheme` media query (no toggle UI).

## Semantic analysis rules

While reading the source, the agent classifies:

- **Risks/concerns** ("risk", "blocker", "caveat", "tradeoff", warning tone) → red callout + ● badge in TOC
- **Open questions** ("?", "TBD", "open question", "needs decision") → amber callouts + aggregated Open Questions panel near the top
- **Decisions** ("decided", "we will", chosen options) → green callouts
- **Data shapes:** table → sortable table; numbered steps → stepper/timeline; checklist → progress bar + list; comparison → side-by-side cards; standalone metrics → stat cards; long appendix → collapsed `<details>`
- **TLDR hero card:** doc-type badge (Plan/Research/RCA), one-paragraph summary, counts (tasks/risks/open Qs), reading time

## Copy affordances

- Copy button on every code block
- Click-to-copy on inline code
- Auto-detected emails, URLs, IDs, file paths rendered as copy chips
- Per-section "copy as markdown" (raw md stored in a data attribute)

## Output & provenance

Sibling `<name>.html`, overwritten on regenerate, auto-opened via `open`. Footer: source path · git SHA (if repo) · generated-at in SAST.

## Frontmatter

- `model: sonnet` — beauty lives in the fixed design system; per-run work is analysis + composition. Bump to opus if output disappoints.
- `allowed-tools`: `Read`, `Write`, `Bash(bash:*)` (build script), `Bash(open:*)`, `Bash(ls:*)`

## Install

Lives in this repo at `skills/html-view/`; user-level via `./install.sh -s --symlink html-view` (symlink works without pushing; npx method requires the skill on GitHub main).

## Testing

Smoke-test against a realistic plan doc exercising all components; verify rendered output in a browser. `bash -n` + `chmod +x` on build.sh.

## Out of scope (v1)

- Dark/light toggle UI (auto via media query only)
- Print stylesheet
- Search / Cmd+K
- Write-back of interactive checkbox state to the md
