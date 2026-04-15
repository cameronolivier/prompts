---
name: handle-pr-feedback
description: |
  Triage and respond to PR review comments from GitHub. Fetches all review comments, categorizes by severity, verifies each against the codebase, drafts reply threads for pushback (user approves before posting), and fixes valid issues with atomic commits. Use when user says "address PR feedback", "handle review comments", "triage PR comments", "respond to review", or provides a PR number/URL with review feedback to process.

  <example>
  Context: User got a review on their PR and wants it processed.
  user: "address the feedback on PR 123"
  assistant: "Fetching review comments, triaging by severity, presenting plan before any commits or replies."
  <commentary>
  Default mode — pull comments from gh, categorise, show triage table, wait for user approval, then fix and reply.
  </commentary>
  </example>

  <example>
  Context: User pastes review text directly in chat.
  user: "respond to this review: <pasted feedback>"
  assistant: "Processing inline — verifying each item against the codebase, drafting replies, asking before posting anything."
  <commentary>
  Inline mode — no gh fetch needed, but verification + approval rules still apply.
  </commentary>
  </example>

  <example>
  Context: Reviewer is wrong on a specific point.
  user: "they're wrong about the schema choice — push back"
  assistant: "Drafting a reply with the technical reasoning, showing it before posting."
  <commentary>
  Pushback mode — never auto-post; user approves the reply text first.
  </commentary>
  </example>
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
  - Bash(gh api:*)
  - Bash(gh pr view:*)
  - Bash(gh pr diff:*)
  - Bash(gh pr comment:*)
  - Bash(git log:*)
  - Bash(git diff:*)
  - Bash(git add:*)
  - Bash(git commit:*)
  - Bash(git status:*)
  - Bash(jq:*)
---

# PR Feedback Triage

> **Recommended model: Opus** — verifying claims against the codebase and drafting credible pushback needs strong judgment. Sonnet rushes pushback replies and over-agrees with reviewers.

Operationally process PR review feedback: fetch, triage, verify, fix, reply.

**Mindset:** Verify before implementing. Push back when wrong. No performative agreement.

> Cross-references: `github-cli-rate-limits` for `gh api` discipline (every fetch of a multi-comment PR is multiple REST calls — pre-flight the limit on busy PRs).

## Input

Accepts:
- PR number or URL (fetches comments via `gh`)
- Pasted feedback from user in chat (process inline)

## Workflow

```
1. FETCH    — pull all review comments from GitHub
2. TRIAGE   — categorize and prioritize
3. VERIFY   — check each item against codebase
4. PRESENT  — show triage table to user
5. FIX      — implement valid items (atomic commits)
6. REPLY    — draft pushback replies (user approves before posting)
```

### Step 1: Fetch Comments

```bash
# Get PR review comments (inline)
gh api repos/{owner}/{repo}/pulls/{pr}/comments

# Get PR review summaries (top-level)
gh api repos/{owner}/{repo}/pulls/{pr}/reviews
```

Parse each comment for: author, file, line, body, thread ID, in_reply_to_id.

### Step 2: Triage

Categorize each comment into:

| Category | Description | Action |
|----------|-------------|--------|
| **Bug** | Correctness issue, will break | Fix immediately |
| **Security** | Vulnerability or exposure | Fix immediately |
| **Valid improvement** | Correct suggestion, improves code | Fix |
| **Style/preference** | Subjective, not wrong | Discuss with user |
| **Incorrect** | Reviewer is wrong or lacks context | Push back |
| **Question** | Needs clarification, not actionable | Answer |
| **Already addressed** | Fixed in a later commit | Reply with commit ref |
| **Out of scope** | Valid but belongs in a separate PR | Note for later |

### Step 3: Verify

For each comment, before acting:

1. Read the actual file and surrounding context
2. Check if the reviewer's assumption is correct
3. Check if the suggestion breaks existing functionality
4. Check git history for why the current code exists
5. Check if it conflicts with project conventions (CLAUDE.md)

### Step 4: Present Triage Table

Show the user a summary before doing anything:

```markdown
## PR #123 Review Triage

| # | File | Comment | Category | Action |
|---|------|---------|----------|--------|
| 1 | src/client.ts:7 | "Pool should be configurable" | Valid improvement | Fix |
| 2 | src/schema.ts:45 | "Use varchar instead of text" | Incorrect | Push back — text is idiomatic Postgres |
| 3 | src/migrate.ts:12 | "Missing error handling" | Bug | Fix |
| 4 | src/index.ts:1 | "Add JSDoc" | Style/preference | Skip? |

**Plan:** Fix #1, #3. Push back on #2. Skip #4. Agree?
```

Wait for user confirmation before proceeding.

### Step 5: Fix Valid Items

Process in order:
1. Blocking issues (bugs, security)
2. Simple fixes
3. Complex fixes

For each fix:
- Make the change
- Run relevant tests
- Atomic commit (conventional commit style)

### Step 6: Draft Pushback Replies

For items where the reviewer is wrong or lacks context:

1. Draft a reply with technical reasoning
2. Present to user: "Here's what I'd reply to comment #2:"
3. User approves, edits, or skips
4. Post approved replies to the GitHub thread

```bash
# Reply in the comment thread (not top-level)
gh api repos/{owner}/{repo}/pulls/{pr}/comments/{comment_id}/replies \
  -f body="<reply>"
```

## Rules

- **Never post to GitHub without user approval**
- **Never implement without verifying first**
- **Atomic commits per fix** — one commit per addressed comment
- **Reference comment in commit** — e.g., `fix(db): add pool cleanup (PR review)`
- **Skip performative replies** — don't post "Fixed!" on GitHub. The commit speaks.
- **Group related comments** — if multiple comments point to the same underlying issue, fix once and reference across threads
