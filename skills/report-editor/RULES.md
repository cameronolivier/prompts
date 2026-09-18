# Report editing rules

Ids are stable. A removed rule leaves a gap. Cite ids in critiques and commit messages.

Sources folded in: the `unslop` skill (open source, rules P1 to P29), the 2026-09-17 founder
report critique, `vhs-brief`, `edit-article`, the SHAED format brief, MOHARA Global English
(itself informed by ASD-STE100 Simplified Technical English, whose structural limits are L7 to
L9), Google developer documentation style, and the FerroxLabs report-formatting skill.
`scripts/voice_lint.py` checks nine of the Global English rules mechanically.

## S. Structure

- **S1** Lead with the answer. Order is verdict, then the arguments for it, then the evidence.
  Never open a section with background.
- **S2** Argument in the body, evidence in the appendix. Full inventories, cost breakdowns,
  claim-to-evidence tables and credential tables live in the appendix. Nothing evidenced is
  deleted for length; it moves.
- **S3** Dependencies flow forward. A section that other sections depend on comes before them.
  If the thesis section sits after the sections that are its instances, move it in front of them.
  This is a move, not a choice; cutting the forward pointers instead is not enough. Then cut every
  forward pointer except the one in the summary. Use `scripts/section_move.py`, which renumbers
  every cross-reference.
- **S4** Method sits before findings, not after the roadmap. It compresses; it does not leave.
- **S5** Parts are questions the reader has, in plain words: what you have, what we did, what we
  found, what we propose. The executive summary sits above the parts. The appendix has no number.
- **S6** Headings are short and name the thing in the reader's vocabulary. An italic subtitle
  under a heading states the section's purpose in one line. It is never a second thesis.
- **S7** One ranked action list per document. Rationale for an action lives in the finding that
  motivates it; the roadmap item keeps the action and its "done means" line only.
- **S8** Acute risk (could go wrong tomorrow) and structural risk (not built to meet a
  commitment) are separate sections. Never merge them.
- **S9** Confirmed, suspected and cleared-on-inspection are stated as three explicit buckets with
  a boundary sentence. A body section whose content is mostly method is dissolved, not kept: its
  method sentences go to the method section, its suspected list to the risks section, its
  boundaries to the appendix bucket. Keeping such a section because it exists is not an option.
- **S10** Every appendix item is referenced at least once from the body. An appendix item nobody
  points at is either evidence for nothing or a body section in disguise.
- **S11** Undefined proper names get a one-line names block under the glossary or primer.
- **S12** Glossary: the two or three load-bearing terms are defined in prose up front. The full
  term table goes to the appendix with a pointer.

## X. Executive summary

- **X1** Half a page: under 400 words for a report under 30 pages, under 500 for longer. It is the
  only part some readers finish. Count it.
- **X2** The first sentence is the verdict, and it carries a number. Not the most alarming finding,
  not context: the one-sentence answer to "what did you find". The verdict does not appear again
  lower down as its own paragraph.
- **X3** Contents: the verdict in one paragraph, three to five anchor numbers each with a "detail
  in section N" pointer, the primary recommendation as a specific action, the key limitation,
  and one sentence on the path forward.
- **X4** It does not restate the body. "How we know" is two sentences and a pointer. Verdict,
  recommendation and sequence are one paragraph, not three.
- **X5** Every number in the summary matches the body exactly. No rounding in one place only.
- **X6** Draft status, running follow-ups and caveats about the draft go in the status block above
  the summary, never inside it.
- **X7** The summary read alone is complete and actionable. Test it by reading only that.

## L. Length and placement

- **L1** Body target is 3 to 5 pages unless the project declares otherwise. If the body cannot
  reach it after every cut, propose a split into a short letter plus an annex as a ruling. Never
  split without the ruling.
- **L2** A cut is a decision about emphasis, never a re-derivation. Figures are re-derived by the
  project's scripts or left alone.
- **L3** Tables over about 12 rows leave the body for the appendix, with a summary row or
  sentence left behind and a pointer.
- **L4** Paragraphs under about 240 characters. Sentences under 20 words, one idea each. Split
  before you compress.
- **L5** Over budget means cut a point, not shrink every sentence until none of them breathe.
- **L6** Companion documents (letter, annex, brief) change together or the change is not done.
- **L7** No sentence over 25 words. Aim under 20. A list that will not split cleanly becomes a
  bulleted list or a table instead of one long sentence. (ASD-STE100 limit for descriptive text.)
- **L8** No paragraph over six sentences. Split at the change of idea. (ASD-STE100.)
- **L9** No more than three nouns in a row. "Production identity database script" becomes "the
  script that changes the production identity database". (ASD-STE100 noun-cluster rule.)

## R. Repetition

- **R1** A good line lands once, in the section that owns the finding. It may appear a second
  time in a roadmap "done means". Cut every other occurrence. The structure check counts them.
- **R2** A point made in a section's lead paragraph is not re-argued in a later subsection.
- **R3** Duplicate bullet lists across sections collapse into one table: gap, evidence, fixed by.
- **R4** A table row does not repeat the sentence directly above the table.
- **R5** A column that reads the same in nearly every row is dropped and stated once in the
  subtitle.
- **R6** Where two tables carry the same figures, one says "see section N" so nobody
  double-counts.
- **R7** No preamble restating the heading. No "N/A", "TBC" or a sentence whose only content is
  its own label. If a section has nothing, omit the section.

## T. Tone and credibility

- **T1** No self-referential trust statements ("this is why the rest is credible", "read this
  before challenging a figure"). Evidence carries credibility; prose asserting it weakens it.
- **T2** No hedging or alarm words: "concerning", "worrying", "a mess", "critical" as an
  adjective. State the concrete condition with its number.
- **T3** Every risk statement is followed in the same paragraph by a business consequence
  (cost, breached commitment, incident) or an action. Never a bare observation.
- **T4** No blame. Frame inherited complexity as circumstance. Never imply that finished work was
  not noticed. Write "to meet X, the system needs Y", not "we have concerns about X".
- **T5** Absolutes ("nowhere", "never", "only downwards") are verified against the invariants
  file or softened to what the evidence carries. Disclose the exception instead of denying it.
- **T6** Bold marks a lead-in or a headline number. Never mid-sentence emphasis, never every
  proper noun.
- **T7** Money is "about" unless it was measured. Every figure travels with its unit and, where
  it matters, its denominator or baseline.
- **T8** Never present a qualitative intensity word where a quantity exists. "Declined 11 points
  to 67 percent" beats "fell sharply".

## A. Audience and terms

Three audiences. The default is leadership. The project's `.claude/report-editor.json` or the `--audience` flag
picks one. What changes is a small set of rules, listed here. Everything else applies to all.

| Audience | Reader | Rules that change |
|---|---|---|
| `leadership` | Founders, executives, budget owners. Talk to engineers, are not engineers. | A1 to A6 all apply. No severity codes or finding ids in the body. Method compressed to how we know and what we did not check. |
| `engineering` | The team doing the work. | A1 and A2 relaxed: identifiers, paths and commands are kept and preferred. Glossary dropped. More tables, less narrative. Roadmap items keep "done means" and acceptance detail. |
| `board` | Non-executive readers, one sitting. | Shorter than leadership. Decisions, money, dates, risks. Method leaves the body entirely for the appendix. |

- **A1** Every technical term gets a plain-English gloss at first use, in parentheses or as the
  next sentence, or is defined in the primer. Prefer writing around the term. A term used once is
  replaced by its gloss.
- **A2** Abbreviations are spelled out at first use with the short form in parentheses. Widely
  known ones (API, PDF, URL, UK, US) are exempt. If first use is in a heading, expand in the
  first paragraph after it.
- **A3** Read-aloud test: every sentence survives being read out in a meeting to someone who does
  not write software. If it needs the glossary to land, it is not finished.
- **A4** One word, one meaning. Pick one term per concept and reuse it exactly. The only exception
  is a synonym pair the document's own glossary declares and explains. Undeclared variation is
  collapsed to one term.
- **A5** Plain common words. No idioms, metaphors, sports or pop-culture references, humour that
  depends on culture. No engineer slang as a thesis ("cargo cult"); say the plain thing.
- **A6** Findings name their subject inline: the identifier and its consequence in one sentence.
  Never "the issue in section 6"; say what it is.
- **A7** Dates: ISO in tables and citations, always; `scripts/iso_tables.py` does it. In narrative,
  follow the project's declared style, else ISO. Times carry a zone. Money carries a currency code
  (USD, GBP, ZAR).
- **A8** No cross-references to documents the reader does not receive. Cite by section of this
  document or by a finding id the appendix resolves.
- **A9** Technical facts are never softened or paraphrased for any audience. An exact figure, name
  or path stays exact. Only the framing around it changes.

## B. Tables

- **B1** A table needs three or more data points per item. One column becomes a list. One row is
  usually a sentence.
- **B2** One matrix table replaces paragraphs of description when the content is one row per
  item. The long tail of items is always a table, never prose.
- **B3** Branching choices render as a table: choice, what you do, done means.
- **B4** Units that belong together stay as grouped rows, not independent rows.
- **B5** No tables inside a numbered procedure. No table that is mostly empty cells.

## F. Figures and evidence

- **F1** An editing pass never changes a number. `scripts/figure_diff.py` runs after every
  stage; every row gets a disposition: moved (to where), summed (into what, working shown),
  spelled (word to numeral or back), or dropped (why it was noise).
- **F2** Every number in the body traces to a source the method section names. Every headline
  claim resolves to a section and a source document in the claim-to-evidence appendix.
- **F3** Every number travels with its counting rule or unit. Re-derive with the project's
  scripts; never copy forward from an earlier draft or adjust by arithmetic in prose.
- **F4** Two figures for related things are stated together with a one-sentence reconciliation.
  Never one silently.
- **F5** State what was not checked. Scope boundaries are written, not omitted.
- **F6** Where the client's own documents agree with a finding, cite them beside it.

## P. Prose

Sentence-level rules. P1 to P29 are the `unslop` rules, renumbered; P30 onward are additions.

- **P1** Superficial -ing phrases ("highlighting", "ensuring", "showcasing", "fostering"):
  delete or replace with the concrete fact.
- **P2** Vague attributions ("experts believe", "reports suggest"): name the source or delete.
- **P3** AI vocabulary: additionally, crucial, delve, enduring, enhance, fostering, garner,
  interplay, intricate, landscape (abstract), pivotal, robust, seamless, showcase, tapestry,
  testament, underscore, vibrant, leverage, utilise. Replace with the plain word.
- **P4** Fancy ways to say "is": "serves as", "stands as", "boasts", "features". Say is or has.
- **P5** "Not just X, but Y": state the point directly.
- **P6** Rule of three: use the natural number of items, not a forced three.
- **P7** Synonym cycling: see A4.
- **P8** False ranges ("from X to Y" where X and Y are not on a scale): list the items.
- **P9** No em-dashes. Not en-dashes or double hyphens either. End the sentence or use a comma.
  Parentheses are allowed for a short gloss (A1).
- **P10** Colons only before a list or example, never as a mid-sentence connector.
- **P11** Bold: see T6.
- **P12** Inline-header lists where the bold label restates the line ("**Performance:**
  Performance improved"): convert to prose. A bold lead-in ending in a full stop followed by
  new detail is fine.
- **P13** Sentence case headings.
- **P14** No decorative emoji.
- **P15** Straight quotes.
- **P16** No chatbot phrases ("I hope this helps", "Let me know", "Certainly").
- **P17** No sycophancy or self-congratulation.
- **P18** Filler: "in order to" becomes "to"; "due to the fact that" becomes "because"; "it is
  important to note that" is deleted; "it's worth noting" is deleted; "as previously mentioned"
  is deleted.
- **P19** Hedge stacking ("could potentially possibly") becomes one word or none.
- **P20** Generic conclusions ("the future looks bright"): state the specific plan or fact.
- **P21** Abstract metaphor nouns (substrate, wedge, vector, nexus, primitive, harness, surface as
  in "API surface", bedrock, scaffolding, paradigm, north star, flywheel, endgame, ratchet):
  use the concrete word.
- **P22** Say what it does, not how it feels. If a sentence cannot be restated as an instruction,
  fact or number, cut it. If it could appear unchanged in another project's report, cut it.
- **P23** Split dense sentences. One idea per sentence.
- **P24** Active voice. Name the actor. Passive only when the actor is unknown or irrelevant.
- **P25** Cut adverbs or use the number. "Significantly improves" becomes the measured change.
- **P26** Prefer the plain word: use, help, many, if, start, enough, continue, submit.
- **P27** No mannered prose: aphorisms, rhetorical fragments, personified code, figurative verbs.
  A deliberately punchy line is allowed once per document and is listed for the user.
- **P28** No over-compression: keep articles and verbs, spell out arrows and abbreviations.
- **P29** Self-audit after the pass: "what here still reads as generated?" Fix it.
- **P30** No "X, being Y" construction. Write two clauses or two sentences.
- **P31** No self-reference to the current section ("as this section shows"). Fix dangling
  pointers to sections that do not carry what is claimed.
- **P32** Each paragraph opens with its topic sentence.
- **P33** Numerals for 2 and above, except at sentence start. Comma separators above 999. Two
  decimal places at most unless the source has more.

## Q. Self-check before the final report

Run all of these and state the results.

1. `structure_check.py --strict` passes: contents match, references resolve, no self-reference.
2. `figure_diff.py` ledger has no empty disposition.
3. `voice_lint.py -v` run on the original and the edited file. Sentences over 25 words is zero
   or every remaining one is an enumeration that a list would not improve. Unexpanded
   abbreviations are only proper names, units and currency codes. Passive count is lower and
   every remaining passive has an unknown actor or avoids assigning blame. Em-dash count is zero.
4. Body word count against target; appendix word count.
5. Repeated-phrase table: every remaining phrase appears at most twice.
6. Read the executive summary alone. It answers what, so what, now what.
7. Spot-check three claim-to-evidence rows against their cited section.
8. The project's `verify` commands, if declared, still agree with the document.
