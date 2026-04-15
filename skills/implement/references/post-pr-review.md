# Post-PR review reference

Extended flow that runs after the draft PR exists and the primary pr-review
QA loop (step 12 of `SKILL.md`) has converged. Load this when security review,
CI watch, or CodeRabbit responses are needed.

## 1. Security review

Run `/security-review` against the branch using the same two-level QA loop
pattern as step 12 — one orchestrator, fresh worker per iteration, so each
security pass is independent of the last.

```
Agent tool:
  description: "Security review QA loop orchestrator"
  subagent_type: general-purpose
  prompt: |
    Orchestrate a /security-review QA loop on PR #<pr-number>.

    DO NOT review the code yourself. Dispatch fresh worker subagents.

    Loop up to 3 iterations. Each iteration, dispatch:

      Agent tool:
        description: "Security review iteration <n>"
        subagent_type: general-purpose
        prompt: |
          Run /security-review on the current branch as a fresh audit.
          You have no prior context — treat every finding as newly
          discovered. Commit fixes as atomic conventional commits
          and push.
          Report exactly:
            COMMITS: <n>
            STATUS: CLEAN | DIRTY
            NOTES: <one-line summary>

    Termination: CLEAN, zero-commit iteration, or 3 iterations.
    Final report back: iterations, total_commits, final_status, notes.
```

## 2. CI watch

Block on CI:

```bash
gh pr checks <pr-number> --watch
```

On failure:
1. Fetch logs: `gh pr checks <pr-number>` (or `gh run view <run-id> --log-failed`).
2. Identify the failing job.
3. Fix locally, commit, push.
4. Re-run `gh pr checks <pr-number> --watch`.

## 3. Reviewer / CodeRabbit comments

Poll PR comments:

```bash
gh pr view <pr-number> --json reviews,comments
gh api repos/{owner}/{repo}/pulls/<pr-number>/comments
```

For each unresolved comment:
1. Classify: valid fix | invalid (pushback) | clarification.
2. Valid fix → atomic commit addressing the comment, push.
3. Pushback → reply via `gh pr review <pr-number> --comment --body "..."` with
   rationale; do not change code.
4. Re-run `gh pr checks <pr-number>` after any push.

For anything beyond ~3 comments, delegate to `/handle-pr-feedback` which
already handles the triage + reply + commit flow.

## 4. Transition to `in_review`

`in_review` and `complete` are human-driven. Do not set them automatically.
The orchestrator (`/work status`, `/work cleanup`) or the user sets them after
the PR is taken out of draft or merged.
