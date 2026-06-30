#!/usr/bin/env python3
"""Render a Spark Cartel standard HTML timesheet from a JSON spec.

This is the canonical renderer for the standard timesheet format: summary cards,
per-section invoice-bullets + email-paragraph cards (each with one-click copy),
per-stream / per-category session tables with "Copy for Sheets" (TSV) exports,
and an excluded (not-billed) section. Stdlib-only.

    python3 render_timesheet.py spec.json out.html      # write file
    python3 render_timesheet.py spec.json               # write to stdout

All hours are DERIVED by summing the rows you pass — you never hand the renderer a
total. The model's job is categorisation + the plain-language prose; the renderer
owns look, totals and copy behaviour so every sheet is identical.

Copy text deliberately OMITS the hours (kept only in the on-screen header pills),
so pasting an invoice/email line never drags a time figure in.

------------------------------------------------------------------------------
SPEC (JSON)
------------------------------------------------------------------------------
{
  "customer": "Citi Shuttles",
  "title_period": "11–28 Jun 2026",        // <title> + visible period
  "period_label": "11–28 June 2026",       // used in 'Copy all' headers
  "sub": "11 Jun → 28 Jun 2026 · times in SAST · per-session ...",
  "banner": null,                           // optional HTML string (e.g. 'paused')
  "paused": false,                          // tweaks summary wording
  "scope_note": "Citi Shuttles only. ...",  // optional, appended to method note
  "method_note": null,                      // optional override of the default note

  "streams": [                              // billable streams, in display order
    {
      "card_class": "a",                    // a | b  (border/dot colour)
      "card_label": "Stream A — Multi-Country / Israel (Rideways)",
      "card_note": "bill separately",       // optional small note under the card hours
      "section_label": "Stream A · Multi-Country / Israel (Rideways)",
      "tsv_header": "Israel - Rideways",     // sub-header used in TSV exports
      "show_category_col": true,            // render a Category column in the table
      "groups": [                           // one group = one category bucket
        { "id": "stream_a",
          "name": null,                     // null -> flat single table (Stream-A style)
          "category_label": "Multi-Country",// shown in the Category column
          "rows": [ {row}, ... ] }
      ]
    },
    {
      "card_class": "b",
      "card_label": "Stream B — HBX & Other",
      "section_label": "Stream B · HBX & Other",
      "show_category_col": false,
      "groups": [                           // 2+ named groups -> grouped tables (Stream-B style)
        { "id": "hbx_inv", "name": "HBX Investigation", "rows": [...] },
        { "id": "reporting", "name": "Reporting", "rows": [...] }
      ]
    }
  ],

  "summaries": [                            // per-section invoice/email cards, in order
    { "title": "Israel / Multi-Country launch (Rideways)",
      "group_ids": ["stream_a"],           // hours = sum of these groups' rows
      "bullets": ["...", "..."],
      "para": "one client-email paragraph ..." }
  ],

  "excluded": [                             // not billed; listed for completeness
    { "name": "Timesheet generation", "cat": "Timesheet", "rows": [...] }
  ]
}

A "row" is: { "date":"2026-06-11", "day":"Thu", "start":"23:36", "end":"00:33",
              "hrs":0.95, "desc":"...", "sess":"f14837c9" }
`end < start` means the session crossed midnight (handled in the TSV split).
"""
from __future__ import annotations
import html
import json
import sys

MONTHS = {1:"Jan",2:"Feb",3:"Mar",4:"Apr",5:"May",6:"Jun",
          7:"Jul",8:"Aug",9:"Sep",10:"Oct",11:"Nov",12:"Dec"}

def esc(s):
    return html.escape(str(s), quote=False)
def to_min(t):
    h, m = t.split(":"); return int(h)*60 + int(m)
def fmt_hm(mins):
    return f"{mins//60}:{mins%60:02d}"
def disp_date(date):  # '11 Jun 2026'
    return f"{int(date[8:10])} {MONTHS[int(date[5:7])]} {date[0:4]}"
def next_date(date):  # increment day-of-month (within a month — sessions don't span month-ends here)
    return date[:8] + f"{int(date[8:10])+1:02d}"
def total(rows):
    return round(sum(r["hrs"] for r in rows), 2)

def tsv_lines(rows):
    out = []
    for r in rows:
        sm, em = to_min(r["start"]), to_min(r["end"])
        d = esc(html.escape(r["desc"]))  # entity-escape & inside the textarea
        if em < sm:  # crosses midnight -> two dated rows
            out.append(f"{disp_date(r['date'])}\t{d}\t{r['start']}\t23:59\t{fmt_hm(1439-sm)}")
            out.append(f"{disp_date(next_date(r['date']))}\t{d}\t00:00\t{r['end']}\t{fmt_hm(em)}")
        else:
            out.append(f"{disp_date(r['date'])}\t{d}\t{r['start']}\t{r['end']}\t{fmt_hm(em-sm)}")
    return out

def session_table(rows, cat_label=None):
    head = "<thead><tr><th>Date</th><th>Day</th><th>Start</th><th>End</th><th>Hrs</th>"
    head += ("<th>Category</th>" if cat_label else "") + "<th>Description</th><th>Session</th></tr></thead>"
    body = []
    for r in rows:
        cat = f'<td><span class="cat">{esc(cat_label)}</span></td>' if cat_label else ""
        body.append(f'<tr><td>{esc(r["date"])}</td><td>{esc(r["day"])}</td><td>{esc(r["start"])}</td>'
                    f'<td>{esc(r["end"])}</td><td class="num">{r["hrs"]:.2f}</td>{cat}'
                    f'<td>{esc(r["desc"])}</td><td class="sess">{esc(r["sess"])}</td></tr>')
    return f"<table>{head}<tbody>{''.join(body)}</tbody></table>"

def ta(_id, text, hidden=True):
    cls = ' class="hidden-ta"' if hidden else ""
    return f'<textarea id="{esc(_id)}"{cls} readonly>{esc(text)}</textarea>'

def tsv_block(_id, header, rows):
    lines = ["Date\tDescription\tTime Start\tTime End\tActual", f"\t{esc(header)}\t\t\t"] + tsv_lines(rows)
    return ta(_id, "\n".join(lines), hidden=False)

def ul(items):
    return "<ul>" + "".join(f"<li>{esc(i)}</li>" for i in items) + "</ul>"

CSS = """ :root{--a:#2563eb;--b:#0f766e;--ink:#0f172a;--mut:#64748b;--line:#e2e8f0;--bg:#f8fafc}
 *{box-sizing:border-box}
 body{font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:var(--ink);
   margin:0;background:var(--bg);padding:32px}
 .wrap{max-width:1180px;margin:0 auto}
 h1{font-size:24px;margin:0 0 4px} .sub{color:var(--mut);margin:0 0 24px}
 .banner{background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:12px 16px;margin:0 0 22px;color:#92400e}
 .cards{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:28px}
 .card{flex:1;min-width:200px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px 18px}
 .card .lbl{color:var(--mut);font-size:12px;text-transform:uppercase;letter-spacing:.04em}
 .card .big{font-size:30px;font-weight:700;margin-top:4px}
 .card.a{border-top:3px solid var(--a)} .card.b{border-top:3px solid var(--b)}
 .card.x{border-top:3px solid #cbd5e1;opacity:.85}
 section{background:#fff;border:1px solid var(--line);border-radius:12px;padding:20px;margin-bottom:22px}
 .shead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;flex-wrap:wrap}
 h2{font-size:17px;margin:0;display:flex;align-items:center;gap:9px}
 .dot{width:11px;height:11px;border-radius:3px;display:inline-block}
 .dot.a{background:var(--a)} .dot.b{background:var(--b)} .dot.x{background:#cbd5e1}
 .pill{background:var(--bg);border:1px solid var(--line);border-radius:999px;padding:3px 11px;font-size:13px;color:var(--mut)}
 button.copy{background:var(--ink);color:#fff;border:0;border-radius:8px;padding:8px 14px;font-size:13px;
   cursor:pointer;font-weight:600} button.copy:hover{background:#1e293b} button.copy.ok{background:var(--b)}
 button.copy.sm{margin-left:auto;padding:5px 11px;font-size:12px}
 .hidden-ta{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}
 table{width:100%;border-collapse:collapse;font-size:13px}
 th,td{text-align:left;padding:7px 9px;border-bottom:1px solid var(--line);vertical-align:top}
 th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--mut);font-weight:600}
 td.num{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}
 td.sess{color:#94a3b8;font-family:ui-monospace,Menlo,monospace;font-size:11px}
 .cat{font-size:11px;background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:1px 7px;white-space:nowrap}
 tbody tr:hover{background:#fafcff}
 .note{color:var(--mut);font-size:12.5px;margin-top:8px}
 .grp{margin-top:18px} .grp:first-child{margin-top:4px}
 .grphd{display:flex;align-items:center;gap:10px;margin-bottom:6px;padding-bottom:5px;border-bottom:2px solid var(--line)}
 .grphd h3{font-size:14px;margin:0;color:var(--b)}
 .tot{font-weight:700}
 details{margin-top:8px} summary{cursor:pointer;color:var(--mut);font-size:12.5px}
 textarea{width:100%;height:120px;margin-top:8px;font-family:ui-monospace,Menlo,monospace;font-size:11px;
   border:1px solid var(--line);border-radius:8px;padding:8px}

 .ssum{border:1px solid var(--line);border-radius:12px;margin-bottom:14px;overflow:hidden}
 .ssh{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 16px;background:var(--bg);border-bottom:1px solid var(--line)}
 .ssh h3{margin:0;font-size:14.5px;color:var(--ink)}
 .two{display:flex;flex-wrap:wrap}
 .half{flex:1;min-width:300px;padding:14px 16px}
 .half + .half{border-left:1px solid var(--line)}
 .hlbl{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--mut);font-weight:600;margin:0 0 8px;display:flex;align-items:center;gap:8px}
 .half ul{margin:0;padding-left:18px} .half li{margin:3px 0}
 .half p{margin:0}
 @media(max-width:640px){.half + .half{border-left:0;border-top:1px solid var(--line)}}"""

JS = """document.querySelectorAll('button.copy').forEach(function(btn){
  btn.addEventListener('click',function(){
    var ta=document.getElementById(btn.dataset.t);
    var txt=ta.value;
    function flash(){var o=btn.textContent;btn.textContent='Copied ✓';btn.classList.add('ok');
      setTimeout(function(){btn.textContent=o;btn.classList.remove('ok');},1600);}
    function fallback(){var d=ta.closest('details'); if(d) d.open=true;
      ta.style.position='static';ta.style.left='auto';ta.style.width='100%';ta.style.height='120px';ta.style.opacity=1;
      ta.focus();ta.select(); try{document.execCommand('copy');flash();}catch(e){} }
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(txt).then(flash,fallback);
    } else { fallback(); }
  });
});"""

DEFAULT_METHOD = ("derived from Claude Code session files (one row per session, gap-split at 20&nbsp;min, "
    "blocks &lt;5&nbsp;min dropped as noise, 6am day boundary). Because concurrent sessions are kept "
    "separate, the same wall-clock minute can appear in more than one stream — so the streams are each "
    "independent and their sum can exceed elapsed clock time. Hours = active Claude Code sessions only; "
    "work done without Claude (calls, browser, deploy waits) isn’t captured.")

def render(spec):
    streams = spec["streams"]
    excluded = spec.get("excluded", [])
    # row index by group id (single source of truth for summary hours)
    by_id = {}
    for st in streams:
        for g in st["groups"]:
            by_id[g["id"]] = g["rows"]

    def stream_rows(st):
        rows = []
        for g in st["groups"]:
            rows += g["rows"]
        return rows

    billable_rows = [r for st in streams for r in stream_rows(st)]
    excl_rows = [r for e in excluded for r in e["rows"]]
    billable = total(billable_rows)

    # ---- cards ----
    cards = []
    for st in streams:
        rows = stream_rows(st)
        note = f'<div class="note">{esc(st["card_note"])}</div>' if st.get("card_note") else ""
        cards.append(f'<div class="card {st["card_class"]}"><div class="lbl">{esc(st["card_label"])}</div>'
                     f'<div class="big">{total(rows):.2f}h</div>'
                     f'<div class="note">{len(rows)} sessions{" · " if st.get("card_note") else ""}'
                     f'{esc(st.get("card_note","")) }</div></div>')
    btot_label = "Billable total"
    if len(streams) > 1:
        btot_label += " (" + " + ".join(s["card_class"].upper() for s in streams) + ")"
    cards.append(f'<div class="card"><div class="lbl">{esc(btot_label)}</div>'
                 f'<div class="big">{billable:.2f}h</div><div class="note">excl. timesheet &amp; dev-env</div></div>')
    if excl_rows:
        cards.append(f'<div class="card x"><div class="lbl">Excluded (timesheet + dev-env)</div>'
                     f'<div class="big">{total(excl_rows):.2f}h</div>'
                     f'<div class="note">{len(excl_rows)} sessions</div></div>')

    # ---- per-section summary cards (hours in pill ONLY, never in copy text) ----
    s_html, all_inv, all_em = [], [], []
    covered = set()
    for i, s in enumerate(spec["summaries"], start=1):
        rows = [r for gid in s["group_ids"] for r in by_id.get(gid, [])]
        covered.update(s["group_ids"])
        hrs = total(rows)
        inv_id, em_id = f"inv{i}", f"em{i}"
        inv_text = s["title"] + "\n" + "\n".join("• " + b for b in s["bullets"])  # no hours
        all_inv.append(inv_text)
        all_em.append(s["title"] + "\n" + s["para"])
        s_html.append(f"""  <div class="ssum">
   <div class="ssh"><h3>{i} · {esc(s["title"])}</h3><span class="pill">{hrs:.2f}h</span></div>
   <div class="two">
    <div class="half">
     <div class="hlbl">Invoice — bullet points <button class="copy sm" data-t="{inv_id}">Copy</button></div>
     {ul(s["bullets"])}
     {ta(inv_id, inv_text)}
    </div>
    <div class="half">
     <div class="hlbl">Email — paragraph <button class="copy sm" data-t="{em_id}">Copy</button></div>
     <p>{esc(s["para"])}</p>
     {ta(em_id, s["para"])}
    </div>
   </div>
  </div>""")
    missing = set(by_id) - covered
    if missing:
        sys.stderr.write(f"WARNING: groups not covered by any summary section: {sorted(missing)}\n")

    all_inv_text = f'{spec["customer"]} — invoice line summary ({spec["period_label"]})\n\n' + "\n\n".join(all_inv)
    all_em_text = f'{spec["customer"]} — work summary ({spec["period_label"]})\n\n' + "\n\n".join(all_em)

    pick = (f'This period totals <strong>{billable:.2f}h</strong> billable but is <strong>paused</strong> '
            f'(not invoiced now); the per-session breakdown follows further down.'
            if spec.get("paused") else
            f'Billing everything = <strong>{billable:.2f}h</strong>; the detailed per-session breakdown follows further down.')
    summ_title = "Per-section summaries" + ("" if spec.get("paused") else " — pick what to invoice")

    body = [f"<h1>{esc(spec['customer'])} — Timesheet</h1>", f'<p class="sub">{esc(spec["sub"])}</p>']
    if spec.get("banner"):
        body.append(f'<div class="banner">{spec["banner"]}</div>')
    body.append(f'<div class="cards">{"".join(cards)}</div>')
    body.append(f"""<section>
  <div class="shead"><h2>{summ_title}</h2>
   <div><button class="copy" data-t="allInv">Copy all bullets</button>
   <button class="copy" data-t="allEm">Copy all paragraphs</button></div></div>
  <p style="margin:0 0 16px;color:var(--mut)">Each work area below has its own <strong>invoice bullets</strong> (high-level, for the invoice) and an <strong>email paragraph</strong> (for the client email). {pick}</p>
{"".join(s_html)}
  {ta("allInv", all_inv_text)}
  {ta("allEm", all_em_text)}
 </section>""")

    # ---- per-stream session sections ----
    combined = ["Date\tDescription\tTime Start\tTime End\tActual"]  # all billable rows, for the A+B export
    for si, st in enumerate(streams):
        rows = stream_rows(st)
        flat = len(st["groups"]) == 1 and not st["groups"][0].get("name")
        stream_tsv = f"tsvS{si}"          # id the header "Copy for Sheets" button targets
        if flat:
            g = st["groups"][0]
            inner = (session_table(rows, cat_label=g.get("category_label")) +
                     f'<details><summary>Show tab-separated text (manual copy)</summary>'
                     f'{tsv_block(stream_tsv, st.get("tsv_header", st["section_label"]), rows)}</details>')
            combined.append(f'\t{esc(st.get("tsv_header", st["section_label"]))}\t\t\t')
            combined += tsv_lines(rows)
        else:
            grp_html, combo = [], ["Date\tDescription\tTime Start\tTime End\tActual"]
            for gi, g in enumerate(st["groups"]):
                if not g["rows"]:
                    continue
                tid = f"tsvS{si}g{gi}"
                grp_html.append(f'<div class="grp"><div class="grphd"><h3>{esc(g["name"])}</h3>'
                                f'<span class="pill">{len(g["rows"])} · {total(g["rows"]):.2f}h</span>'
                                f'<button class="copy sm" data-t="{tid}">Copy for Sheets</button></div>'
                                f'{session_table(g["rows"], cat_label=g.get("category_label"))}'
                                f'{tsv_block(tid, g["name"], g["rows"])}</div>')
                for acc in (combo, combined):
                    acc.append(f'\t{esc(g["name"])}\t\t\t')
                    acc += tsv_lines(g["rows"])
            inner = ("".join(grp_html) +
                     f'<details><summary>Show tab-separated text (manual copy)</summary>'
                     f'{ta(stream_tsv, chr(10).join(combo), hidden=False)}</details>')
        body.append(f"""<section>
  <div class="shead"><h2><span class="dot {st["card_class"]}"></span>{esc(st["section_label"])}</h2>
   <div><span class="pill">{len(rows)} sessions · {total(rows):.2f}h</span>
   <button class="copy" data-t="{stream_tsv}">Copy for Sheets</button></div></div>
  {inner}
 </section>""")

    # ---- all billable rows combined (only meaningful with 2+ streams) ----
    if len(streams) > 1:
        body.append(f"""<section>
  <div class="shead"><h2>All billable rows ({" + ".join(s["card_class"].upper() for s in streams)} combined)</h2>
   <div><span class="pill">{len(billable_rows)} sessions · {billable:.2f}h</span>
   <button class="copy" data-t="tsvAll">Copy for Sheets</button></div></div>
  <details><summary>Show tab-separated text (manual copy)</summary>{ta("tsvAll", chr(10).join(combined), hidden=False)}</details>
  <p class="note">Combined export so you can filter the streams in Sheets.</p>
 </section>""")

    # ---- excluded ----
    if excluded:
        eg = []
        for e in excluded:
            if not e["rows"]:
                continue
            eg.append(f'<div class="grp"><div class="grphd"><h3>{esc(e["name"])}</h3>'
                      f'<span class="pill">{len(e["rows"])} · {total(e["rows"]):.2f}h</span></div>'
                      f'{session_table(e["rows"], cat_label=e.get("cat"))}</div>')
        body.append(f"""<section>
  <div class="shead"><h2><span class="dot x"></span>Excluded — not billed</h2>
   <span class="pill">{len(excl_rows)} sessions · {total(excl_rows):.2f}h</span></div>
  {"".join(eg)}
  <p class="note">Listed for completeness only; not counted in billable totals.</p>
 </section>""")

    method = spec.get("method_note") or DEFAULT_METHOD
    scope = (" " + spec["scope_note"]) if spec.get("scope_note") else ""
    body.append(f'<p class="note"><strong>Method:</strong> {method}{scope}</p>')

    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(spec["customer"])} Timesheet · {esc(spec["title_period"])}</title>
<style>
{CSS}
</style></head>
<body><div class="wrap">
 {chr(10).join(body)}
</div>
<script>
{JS}
</script>
</body></html>
"""

def main(argv):
    if len(argv) < 2:
        sys.stderr.write("usage: render_timesheet.py spec.json [out.html]\n")
        return 2
    spec = json.loads(open(argv[1]).read())
    out = render(spec)
    if len(argv) >= 3:
        open(argv[2], "w").write(out)
        sys.stderr.write(f"wrote {argv[2]}\n")
    else:
        sys.stdout.write(out)
    return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv))
