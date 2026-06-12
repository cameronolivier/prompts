---
name: html-view
description: Generate a beautiful, self-contained HTML page from a markdown doc (plan, research, RCA) or directly from in-conversation findings. Use when the user says "html view", "/html-view <file>", "render this as HTML", "make an HTML version", "give me an html page of this", or asks for HTML output of research/plans. Surfaces risks, open questions, and decisions in callouts; maps data to the right UI component; adds copy buttons. Output: sibling .html, auto-opened.
allowed-tools:
  - Read
  - Write
  - Bash(bash:*)
  - Bash(open:*)
  - Bash(ls:*)
model: sonnet
---

# html-view

> **Model: Sonnet** — beauty lives in the bundled design system; per-run work is semantic analysis + component composition.

Turn a markdown doc into a self-contained HTML page optimised for fast comprehension, or compose one directly from research findings. Fixed editorial design system (light/dark automatic); you compose only the body from the component catalog.

## Workflow

1. **Get the content.**
   - *Convert mode:* Read the ENTIRE source md file.
   - *Direct mode* (no md source): use the research/findings from the conversation. If the user also wants the md, write it first, then treat as convert mode.

2. **Semantic analysis.** Classify as you read:
   - **Risks/concerns** — "risk", "blocker", "caveat", "tradeoff", "warning", "gotcha", failure modes → `callout risk` + `data-toc-badge="risk"` on the section heading
   - **Open questions** — "?", "TBD", "open question", "needs decision", "unclear" → `callout question` + aggregated Open Questions panel after the hero
   - **Decisions** — "decided", "we will", "chosen", resolved trade-offs → `callout decision`
   - **Data shapes** — md table → sortable table; sequential steps/phases → stepper; task checklist → progress bar + checklist; options comparison → cards (tag the recommended one); standalone metrics/counts → stat cards; long appendix/log → `<details>`
   - **Copyables** — emails, URLs, IDs, file paths, commands → copy chips / code; sections likely to be pasted elsewhere → `data-md` section copy

3. **Compose the body** using `references/COMPONENTS.md` markup exactly — body content only, no page chrome. Always start with the hero (doc-type badge, TLDR summary you write yourself, count pills). Preserve ALL information from the source — this is a re-presentation, not a summary; nothing may be dropped.

4. **Build.** Write the body to a temp file, then:
   ```
   bash <skill-dir>/scripts/build.sh \
     --body /tmp/hv-body.html \
     --title "Doc Title" \
     --source path/to/source.md \
     --out path/to/source.html
   ```
   `<skill-dir>` is this skill's directory (resolve relative to this SKILL.md). Output goes **next to the source md** (same name, `.html`). Direct mode: omit `--source`, place output where the user asked (default `./<topic>.html`). The script inlines CSS/JS, handles mermaid, appends the provenance footer (SAST timestamp), and opens the result.

5. **Report.** One line: output path + what was surfaced (e.g. "3 risks, 2 open questions elevated").

## Quality bar

- The page must read better than the markdown: a 5-second TLDR scan (hero + pills), then navigable depth (TOC, collapsibles).
- Use the *right* component, not the most components. Prose stays prose; don't card-ify paragraphs.
- Never invent content. The TLDR summary and counts must be derivable from the source.
- Mermaid blocks in the source pass through as `<pre class="mermaid">` — build.sh handles the JS.

## Files

- `assets/` — design system (style.css, app.js, template.html). Never re-emit or fork these per run.
- `scripts/build.sh` — deterministic assembly + open. Flags documented in its header.
- `references/COMPONENTS.md` — the component catalog. Read it before composing.
