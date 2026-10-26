# Deck style: what Cam wants on a weekly demo deck

Lessons from the first deck (a client infrastructure and security week, 2026-10, 17 slides after about 25 rounds of edits). Apply these on the first draft so the edit rounds are about content, not style.

## Contents

1. Words on the slide
2. Facts and claims
3. Slide order
4. Slide patterns
5. Look and layout
6. Team mode

## 1. Words on the slide

- **No Jira keys and no PR numbers in visible slide text**, footers included. Say what the work is ("prod PRs open for the auth service and the dashboard job"). Keys may stay in speaker notes.
- **Plain language a non-engineer follows.** "Strangers can't add or change files" beats "no anonymous write". "Strangers can't browse the file list" beats "no anonymous listing". Explain what each control protects and what it costs.
- **Full sentences for security slides**: "We enforced an organisation policy so that no Cloud SQL database can be opened to the internet." "We tested it: …".
- **Name people** in access changes (who was removed, from what, and what was moved off their login). Only when the record supports it.
- **Explain jargon** in place: "5 monitoring alerts: a leaked-key alarm, 3 spend spike alerts …", "billing budget alerts", "cron jobs and background work".
- No em-dashes. MOHARA Global English (short sentences, ISO dates, currency codes).

## 2. Facts and claims

- Every figure comes from the session records, git, GitHub, Jira or a live read. Never invent. If a figure is projected, the slide says "projected" or "about".
- Do not overclaim: an unfinished step reads "is being copied", "started retiring". A stopped resource is not "dead" until a usage check says so.
- Keep the user's own work apart from team work. Use "we" when the record does not say who did it. Drop items the user says belong to someone else.
- Sensitive incidents (exposed customer data, a suspicious login) stay generic on the slide ("a database export anyone could download … escalated"). Leave out anything not cleared for a wide audience.
- When a fact is wrong in the user's wording, correct it gently in the reply (for example "removed public read" was wrong because files still load by direct link).
- Make savings land: show the alternative's full cost next to today's cost and the new cost (today: USD X for one network; full cover with the same tool: about 3X; the replacement: about half of X, covering more).
- Show end states as a highlighted banner ("Once the last live cluster is shut down, <service> costs USD 0 a month").

## 3. Slide order

1. Cover (dark): "What I shipped this week", date range.
2. Plan slides for the main programme, then a slide "What we added to the plan this week" (the delta against last week).
3. One slide per security area (buckets, databases, access, repositories).
4. One slide per cost area. Big items (a cost table plus a replacement plan) get two slides.
5. Compliance (for example Vanta: overdue tests before and after, still overdue, coming up, the user's next action).
6. Analytics or other investigations that have a plan: their own slide ("what we found", "the plan", status banner).
7. Tracking: where the work is tracked (artifacts, Jira), one line each.
8. Next week: "Still in progress: about N workstreams", 3 grouped columns, 6 to 7 short items each.
9. "Where the detail lives": the artifacts, with what each page **is** (not what changed).
10. End (dark, same style as the cover): 3 numbered cards summarising the week, "Thank you. Questions?".

Cam removed these from the first deck, so do not add them:
- a "week in four numbers" overview
- a live-demo slide
- a catch-all "investigations" table
- a separate Jira-tickets slide (one line on the plan slide is enough: "deep dives and plans are in Claude Artifacts; the most pressing tickets are moving to Jira")
- Jira board housekeeping

## 4. Slide patterns

- **Card row**: 2 to 4 cards, each a big number or a short h3 plus 1 to 3 lines.
- **Comparison table**: rows are what is protected, columns are options, the last row is cost. Highlight the recommended column's cost row.
- **Status banner**: one painted line under the content (`background:#E4EDF2`) for "consultant agreed", "ready to start".
- **End-state banner**: orange tint with a left accent bar (`background:#F9E1CF;border-left:8px solid #B4501A`).
- **Dark summary cards** (cover, end): navy `#14213D`, cards `#1F2E4F`, accent `#F29A55`, number 72px, h3 32px, text 26px.

## 5. Look and layout

- Typefaces: IBM Plex Sans (text) and JetBrains Mono (commands). Palette: navy `#14213D`, light `#F6F5F0` and `#ECEAE2` alternating, cards `#FDFCF9` with border `#DCD9CE`, accent `#B4501A` on light and `#F29A55` on dark, body text `#3D4A63`.
- Type scale: h2 64px, h3 28 to 32px, body 26 to 30px, eyebrow and footer 24px. Nothing under 24px.
- Footer: "<client> · Week of <date> · <section>", pinned at bottom 64px.
- Dense slides drop to 24 to 26px. Offer to split a slide rather than shrinking further.

## 6. Team mode

Same look and the same rules as above. These parts change:

- **Cover:** "What the team shipped this week", with the team or project name.
- **Credit:** name the person on each card or line ("Ana: restored the partner data feed"). Use "we" when no source names anyone. Never put a teammate's work under the user.
- **Order:** headline wins first (3 or 4 cards), then one slide per theme (features, fixes, security, cost, platform), then risks or blockers, then next week, then the end slide.
- **Next week:** group by theme or by person, whichever the team update uses.
- **Evidence:** a claim from the team update with no matching commit, PR or ticket stays off the slides until the user confirms it. List those claims in the reply.
- Leave out the user's own deep dives unless they asked for their part in the team deck.
