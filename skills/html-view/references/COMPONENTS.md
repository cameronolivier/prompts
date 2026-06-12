# html-view Component Catalog

Markup patterns for composing body HTML. CSS/JS are injected by `build.sh` — emit **body content only** (no `<html>`, `<head>`, `<style>`, or `<script>`). The TOC builds itself from your `h2`/`h3` elements at runtime.

## Hero (always first)

```html
<header class="hero">
  <div class="hero-top">
    <span class="doc-badge">Plan</span>          <!-- Plan / Research / RCA / Spec / Notes -->
    <span class="hero-meta">12 min read · 14 tasks</span>
  </div>
  <h1>Auth Migration Plan</h1>
  <p class="hero-summary">One-paragraph TLDR: what this doc is, where things stand, what needs attention.</p>
  <div class="hero-pills">
    <span class="pill risk"><span class="toc-dot risk"></span>2 risks</span>
    <span class="pill question"><span class="toc-dot question"></span>1 open question</span>
    <span class="pill decision"><span class="toc-dot decision"></span>3 decided</span>
  </div>
</header>
```

Omit pills with zero count. Skip the pills row entirely if the doc has no risks/questions/decisions.

## Open Questions panel (when ≥1 open question; place right after hero)

```html
<aside class="panel">
  <p class="panel-title">Open questions</p>
  <ol>
    <li><a href="#section-id">Should sessions persist across devices?</a></li>
  </ol>
</aside>
```

Link each question to the section it came from (TOC assigns slugified heading ids — `## Rollout Plan` → `#rollout-plan`).

## Callouts

```html
<div class="callout risk"><p class="callout-label">⚠ Risk</p><p>Token expiry race during cutover.</p></div>
<div class="callout question"><p class="callout-label">? Open question</p><p>Persist sessions across devices?</p></div>
<div class="callout decision"><p class="callout-label">✓ Decision</p><p>JWT with 15-min expiry, refresh rotation.</p></div>
<div class="callout info"><p class="callout-label">ℹ Note</p><p>Background context worth flagging.</p></div>
```

## TOC badges

Mark sections containing risks/questions so the sidebar shows a colored dot:

```html
<h2 data-toc-badge="risk">Rollout Plan</h2>
<h2 data-toc-badge="question">Session Storage</h2>
```

One badge per heading; `risk` wins if a section has both.

## Stat cards (counts, metrics, KPIs)

```html
<div class="stats">
  <div class="stat"><div class="stat-value">14</div><div class="stat-label">Tasks</div></div>
  <div class="stat"><div class="stat-value risk">2</div><div class="stat-label">Risks</div></div>
  <div class="stat"><div class="stat-value">86%</div><div class="stat-label">Complete</div></div>
</div>
```

## Stepper (sequential phases/steps)

```html
<ol class="stepper">
  <li class="done"><div class="step-title">Phase 1 — Shadow writes</div><div class="step-body"><p>Details.</p></div></li>
  <li class="active"><div class="step-title">Phase 2 — Cutover</div><div class="step-body"><p>Details.</p></div></li>
  <li><div class="step-title">Phase 3 — Cleanup</div><div class="step-body"><p>Details.</p></div></li>
</ol>
```

States: `done`, `active`, none (pending). Use for md numbered phase lists.

## Progress + checklist (md task lists)

```html
<div class="progress-wrap">
  <div class="progress"><div class="progress-fill" style="width: 64%"></div></div>
  <span class="progress-label">9 / 14 done</span>
</div>
<ul class="checklist">
  <li class="done"><span class="check-text">Write migration script</span></li>
  <li><span class="check-text">Run on staging</span></li>
</ul>
```

## Comparison cards (options/approaches)

```html
<div class="cards">
  <div class="card recommended">
    <span class="card-tag">Recommended</span>
    <h4>Option A</h4>
    <p>Trade-offs.</p>
  </div>
  <div class="card"><h4>Option B</h4><p>Trade-offs.</p></div>
</div>
```

## Tables (auto-sortable; wrap for overflow)

```html
<div class="table-wrap">
  <table>
    <thead><tr><th>Service</th><th>Latency</th></tr></thead>
    <tbody><tr><td>auth-api</td><td>42ms</td></tr></tbody>
  </table>
</div>
```

## Code (copy button auto-injected)

```html
<pre><code>npm run migrate</code></pre>
```

Inline `<code>` is click-to-copy automatically.

## Copy chips (emails, URLs, IDs, paths — anything worth one-click copying)

```html
<span class="chip">ops@example.com</span>
<span class="chip" data-copy="full-value-here">display-text</span>
```

Use `data-copy` when display text is truncated/prettified.

## Section copy-as-markdown

```html
<h2 data-md="%23%23%20Rollout%0A...">Rollout</h2>
```

`data-md` = URL-encoded raw markdown of that section. Adds a "Copy md" button on hover. Use for sections likely to be pasted elsewhere (emails, Slack, prompts); skip for trivial ones.

## Collapsible (appendices, long detail)

```html
<details>
  <summary>Appendix — full query log</summary>
  <p>Long content…</p>
</details>
```

## Mermaid (only if source has ```mermaid blocks)

```html
<pre class="mermaid">
graph TD; A-->B;
</pre>
```

`build.sh` detects this and inlines mermaid.js automatically.
