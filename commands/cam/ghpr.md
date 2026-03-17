---
description: Create a GitHub PR using the project template with auto-generated content and a humorous GIF
tools:
  - Read
  - Bash
  - WebSearch
  - WebFetch
---

Create a GitHub pull request using the template at `.github/pull_request_template.md`.

## Requirements

1. **Analyze the work done:**
   - Use `git log` and `git diff` to understand changes on the current branch since it diverged from the base branch
   - Parse the branch name to understand the ticket scope (e.g., `DEC-121-make-chat-mobile-friendly`)
   - Categorize changes into:
     - **Work Done**: Changes directly related to the ticket/feature scope
     - **Additional Work**: Boy scouting, refactors, adjustments outside the main scope

2. **Generate PR description:**
   - Read the PR template at `.github/pull_request_template.md`
   - Fill in all sections:
     - **Ticket link**: Extract ticket ID from branch name and link to Jira. If no ticket ID exists in the branch, request from user, if none is provided, ignore adding the ticket id.
     - **Work Done**: List main feature work with clear descriptions
     - **Additional Work**: List any refactoring, cleanup, or tangential improvements (omit section if none)
     - **Steps to Test**: Create 3-5 step-by-step manual testing instructions for reviewers
     - **Visuals**: Leave placeholder text noting "Screenshots/videos to be added"
     - **Additional Notes**: Any important context, breaking changes, or migration notes
     - **GIF**: Search Giphy API for a humorous, work-related GIF that relates to the PR topic if possible

3. **Detect target branch:**
   - Check git config for tracking branch
   - Default to `main` if unable to determine
   - Use the detected base branch for the PR

4. **Create the PR:**
   - Use `gh pr create` with the generated description
   - Include ticket ID prefix in PR title (e.g., "DEC-121 - Make chat mobile friendly")
   - Return the PR URL when complete

## GIF Selection

Use the Giphy Search API to find a relevant GIF:

1. **Build search query**: Derive a fun search term from the PR topic (e.g., "mobile responsive" for mobile work, "speed" for performance, "bug fix" for fixes). Keep it under 50 chars.
2. **Hit the API** via `curl`:
   ```
   curl -s "https://api.giphy.com/v1/gifs/search?api_key=API_KEY&q=QUERY&limit=5&rating=pg"
   ```
   - Use the `GIPHY_API_KEY` env var if set, otherwise fall back to the Giphy public beta key `dc6zaTOxFJmzC`
   - Parse the JSON response with `jq` to extract a random GIF URL from `data[].images.downsized.url`
3. **Fallback**: If the topic query returns no results, retry with a general term like "coding" or "programmer". If the API fails entirely, skip the GIF gracefully.
4. **Embed** the GIF in the PR description as: `![GIF](URL)`

## Notes
- Be concise but thorough in descriptions
- Focus on reviewer-friendly testing steps
- Ensure the GIF adds levity without being inappropriate
