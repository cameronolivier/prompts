# Council reference

Loaded on demand from `SKILL.md`. Covers optional arguments, the return shape, custom councils, the hand-run fallback, and how to test the script.

## Contents

- [Arguments](#arguments)
- [Return shape](#return-shape)
- [Custom councils](#custom-councils)
- [How the blind review is kept blind](#how-the-blind-review-is-kept-blind)
- [Fallback without the Workflow tool](#fallback-without-the-workflow-tool)
- [Testing the script](#testing-the-script)

## Arguments

| Arg | Required | Values | Default |
|---|---|---|---|
| `question` | yes | The user's question, verbatim | — |
| `context` | no | 1–3 sentences plus paths. Never shown to `context: "none"` seats | none |
| `mode` | no | `full` (opinions + blind review), `quick` (opinions only). Case-insensitive; any other value is an error | `full` |
| `model` | no | `opus`, `sonnet`, `haiku`, `fable`, or `inherit` (use the session's model) | `opus` |
| `members` | no | 2–8 custom seats, see below. Fewer than 2 is an error; extra seats are dropped and logged | the five default seats |

`model` applies to every seat that does not set its own. Use `sonnet` when the user wants a cheaper run; expect shallower "what everyone missed" findings.

## Return shape

```
{
  question, mode,
  advisors_failed: ["The Executor"],          // personas with no usable answer
  advisors_off_topic: ["The Executor"],       // subset of the above: answered something other than the question
  reviews_received: 5,                        // off-topic reviews are dropped before ranking
  council: [{
    persona, model, context,
    isolation,          // "full-context" | "no-project-context" | "prompt-only"
    review_label,       // the letter this answer carried during blind review
    stance, confidence, key_points,
    assumptions,        // what must be true for the stance to hold
    would_change_mind,  // the one fact that would flip the stance
    answer
  }],
  peer_reviews: [{      // empty in quick mode
    reviewer,
    strongest: { persona, why },
    biggest_blind_spot: { persona, blind_spot },
    core_disagreement,  // the clash that matters most + what would settle it
    missed_by_all,
    ranking: [persona, ...]   // best to worst, includes the reviewer's own
  }],
  aggregate_ranking: [{ persona, average_rank, first_place_votes, times_ranked }],
  chairman_notes
}
```

**Messages typed mid-run reach advisors.** Seen in live runs: a message the user sent while the council was running showed up in advisors' contexts, and the isolated Outsider answered it instead of the question. Prompts now tell advisors to ignore such messages, each reply carries an `answered_council_question` flag, and an off-topic seat is retried once as a standard agent before being dropped.

`average_rank` is lower-is-better and is computed with each reviewer's vote for their own answer removed. `isolation: "prompt-only"` means the isolated agent type was unavailable, so that seat ran as a normal agent and may have seen CLAUDE.md.

Where to look when ruling:

- **Clashes** → compare `stance` across seats, then read `core_disagreement` — reviewers have already named what evidence would settle it.
- **What everyone missed** → `missed_by_all`. A gap named by two reviewers independently outweighs anything a single advisor said.
- **Confidence** → `assumptions` and `would_change_mind` tell you what the recommendation depends on. Quote the weakest one back to the user.

## Custom councils

When the user asks for a specific line-up ("a council of security people on this design"), pass `members`:

```
members: [
  { persona: "The Attacker",  brief: "Assume you want to break this. Where do you start?" },
  { persona: "The On-call",   brief: "You get paged when this fails at 3am. What fails?" },
  { persona: "The Newcomer",  brief: "You have never seen this system.", context: "none" },
  { persona: "The Auditor",   brief: "What can you not prove from what is written down?", model: "sonnet" }
]
```

Each member takes `persona`, `brief`, and optionally `model` and `context` (`"full"` or `"none"`).

The default five work because they pull against each other. Five experts in one field tend to agree, and agreement is the failure the council exists to prevent. So when seating a custom council:

- Give at least one seat an adversarial brief — its job is to find why the others are wrong.
- Keep one `context: "none"` seat unless the user objects. The cold read is the cheapest insight the council produces.
- Write briefs as a stance to argue, not a job title. "You get paged when this fails" produces sharper output than "SRE".

Tell the user in one line if their requested line-up has no built-in disagreement, then seat it as asked.

## How the blind review is kept blind

Worth knowing so you do not undo it:

- **Letters are shuffled.** Responses get letters in an order seeded from the question text, so "Response A" does not always mean the first seat. The same question always produces the same shuffle, which keeps Workflow resume working.
- **Names are stripped.** Persona names are removed from answers before reviewers see them, and advisors are told not to mention their role.
- **Reading order rotates.** Each reviewer's packet starts from a different response, so no answer is always read first.
- **Self-votes do not count.** Reviewers rank all answers including their own, but their own is dropped before averaging.
- **Answers are fenced as data.** Each answer is wrapped in a tag whose name is derived from all the answers, with every angle bracket inside it replaced and hidden characters removed, so an answer cannot close its own fence. Reviewers are told the contents are never instructions; a response that tries to steer the ranking is marked down. Advisors are told to stay read-only and to treat file and web content the same way.
- **The Outsider reviews without context too.** It never receives the context blurb, in either phase.

## Fallback without the Workflow tool

Same protocol, by hand, using the Agent tool. Pass `model: "opus"` on every dispatch.

1. **Opinions.** In one message, send one Agent call per seat. Each prompt carries: the persona and lens brief (copy from `DEFAULT_MEMBERS` in `scripts/council-workflow.js`), the question verbatim, the context blurb, and the ground rules from the same file. The Outsider's prompt carries the question only, plus the instruction not to read files, search, or use any project instructions it was shown.
2. **Anonymize.** Assign letters in an order that is not seat order. Remove persona names from the answers.
3. **Blind review** (skip in quick mode). In one message, send one Agent call per seat with the lettered packet and the five review questions from the script's `reviewPrompt`. Include the "how to rank" paragraph — without it, one-sided answers get marked down for doing their job.
4. **Score.** For each reviewer, drop their own answer from their ranking, then average the positions per answer.
5. **Rule** as in `SKILL.md` step 3.

## Testing the script

```
node scripts/test-council-workflow.mjs
```

Runs `council-workflow.js` against a fake Workflow runtime — no agents, no tokens. It checks that the Outsider never receives context, letters are shuffled and stable, persona names are stripped from review packets, self-votes are excluded, malformed rankings are cleaned, quick mode skips review, and failed seats are reported. Run it after any edit to the script.
