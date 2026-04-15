---
name: create-pr
description: |
  Create a GitHub PR with auto-generated content from branch changes and a humorous GIF. Use when user says "create pr", "make a pr", "open a pull request", or after completing implementation work. Triggers `github-project-status` to move the linked issue to "In Review" when the PR opens.

  <example>
  Context: User has finished implementing and wants the PR opened.
  user: "create a pr"
  assistant: "Diffing branch vs main, generating description, opening draft PR with --head explicit, then moving the linked issue to In Review."
  <commentary>
  Default flow — derive ticket from branch name, fill template, attach GIF, open PR, trigger project-status move.
  </commentary>
  </example>

  <example>
  Context: Dispatched by /implement step 11.
  user: "[dispatched by /implement — push branch and create draft PR for issue #42]"
  assistant: "Pushing 42-foo, creating draft PR, returning URL."
  <commentary>
  Composed mode — invoked by another skill, returns PR URL for downstream steps (post-PR review loop).
  </commentary>
  </example>
allowed-tools:
  - Read
  - Skill
  - WebSearch
  - WebFetch
  - Bash(git log:*)
  - Bash(git diff:*)
  - Bash(git branch:*)
  - Bash(git rev-parse:*)
  - Bash(git push:*)
  - Bash(gh pr create:*)
  - Bash(gh pr view:*)
  - Bash(gh repo view:*)
  - Bash(gh api:*)
  - Bash(jq:*)
---

> **Recommended model: Sonnet** — composing a readable PR body from a diff is composition work; Sonnet is the right tool. Haiku misses nuance in the "Additional Work" classification.

> Cross-references: see `github-cli-rate-limits` for `gh` discipline; invoke `github-project-status` after the PR opens to move the linked issue to "In Review".

Create a GitHub pull request with auto-generated content from the current branch.

## Requirements

1. **Analyze the work done:**
   - Use `git log` and `git diff` to understand changes on the current branch since it diverged from the base branch
   - Parse the branch name to understand the ticket scope (e.g., `12-s3-bucket-setup`)
   - Categorize changes into:
     - **Work Done**: Changes directly related to the ticket/feature scope
     - **Additional Work**: Boy scouting, refactors, adjustments outside the main scope

2. **Detect PR template:**
   - Check for `.github/pull_request_template.md` — if it exists, use it as the structure
   - If no template exists, use the default structure below

3. **Generate PR description:**
   Fill in all sections:
   - **Ticket link**: Extract issue number from branch name and link to GitHub issue. If no issue number, omit.
   - **Work Done**: List main feature work with clear descriptions
   - **Additional Work**: List any refactoring, cleanup, or tangential improvements (omit if none)
   - **Steps to Test**: Create 3-5 step-by-step manual testing instructions for reviewers
   - **Additional Notes**: Any important context, breaking changes, or migration notes
   - **GIF**: Search for a humorous, work-related GIF that relates to the PR topic

4. **Issue closure:**
   - If the branch name starts with an issue number (e.g., `12-s3-bucket-setup`), include `Closes #12` in the PR body so the issue auto-closes on merge.

5. **Detect branches:**
   - **Head branch:** Run `git branch --show-current` to get the exact current branch name. You MUST use this value as `--head` when creating the PR.
   - **Base branch:** Query the repo default branch via `gh repo view --json defaultBranchRef -q '.defaultBranchRef.name'`. Fall back to `main` if the query fails.

6. **Create the PR:**
   - Use `gh pr create` with the generated description
   - **CRITICAL:** Always pass `--head <current-branch>` and `--base <target-branch>` explicitly. Never rely on implicit branch detection — this causes wrong-branch PRs when running in worktrees.
   - Include issue number prefix in PR title if available (e.g., "#12 - S3 bucket setup")
   - Return the PR URL when complete

7. **Move the linked issue to "In Review":**
   - If a `Closes #N` link was added (step 4), invoke the `github-project-status` skill: `move.sh <N> "In Review"`.
   - Skip silently if `.github/project.yml` is absent — that repo isn't on a project board.
   - Do not block PR creation on this; report failures as a warning only.

## Default PR Structure

When no project template exists, use:

```markdown
## Summary
<1-3 bullet points of what changed and why>

## Work Done
<bulleted list of main changes>

## Additional Work
<bulleted list of tangential improvements, omit if none>

## Steps to Test
<numbered testing instructions for reviewers>

## Additional Notes
<breaking changes, migration notes, context — omit if none>

<gif>
```

## GIF Selection

Search Giphy API for humorous, coding/work-related GIFs. Prioritize GIFs that match the PR topic (e.g., "mobile responsive" for mobile work, "speed" for performance, "bug fix" for fixes). Fall back to general coding humor if no topic match found.

If the Giphy API is unavailable or rate-limited, use the agent-browser skill to navigate to giphy.com, search for a relevant GIF, and extract the URL.

## Notes

- Be concise but thorough in descriptions
- Focus on reviewer-friendly testing steps
- Ensure the GIF adds levity without being inappropriate
