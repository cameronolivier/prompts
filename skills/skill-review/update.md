# --check and --update

`best-practice.md` is a distilled snapshot of the sources in `sources.json`. Each source carries the SHA-256 hash of its text when it was last distilled. `check-drift.mjs` fetches every source and compares hashes. No model runs in the check.

## --check

```bash
node ${CLAUDE_SKILL_DIR}/scripts/check-drift.mjs
```

Report its output in one or two lines and stop. Exit 0 means up to date. Exit 1 lists each source as `changed`, `new` or `unreachable`.

## --update

Done when a PR is open with the refreshed `best-practice.md` and the new hashes, or when the check finds no drift.

1. **Find the source copy.** The installed skill is a copy. Edit the one in the repository that hosts it. From the current directory, run `git rev-parse --show-toplevel`, then look for `skills/skill-review/sources.json` under it, at any depth. When none exists, stop and tell the user to run `--update` from the repository that hosts skill-review.

2. **Check.** Run this from the hosting repository:

   ```bash
   node ${CLAUDE_SKILL_DIR}/scripts/check-drift.mjs --json --sources <repo>/<path>/sources.json --save <scratchpad>/drift
   ```

   No drift: say so and stop.

3. **Branch in a worktree.** This never touches the user's working copy:

   ```bash
   git fetch origin
   git worktree add -b chore/skill-review-best-practice-<YYYY-MM-DD> <scratchpad>/bp-update origin/HEAD
   ```

   Edit files only inside `<scratchpad>/bp-update`.

4. **Refresh the rules.** For each `changed` or `new` source, read its saved text (`<scratchpad>/drift/<id>.md`) in full, then every rule in `best-practice.md` that cites that source id.
   - A rule the source still supports stays as written.
   - A rule the source now contradicts gets rewritten, or removed if the source drops it.
   - New guidance becomes a new rule at the next free number in its layer.
   - Rule IDs never move. A removed rule leaves a gap, because past reviews cite the IDs.
   - House rules stay in skill-conventions. Where new upstream guidance matches one, write a pointer line, not a rule.

   Record every edit in this form, for the PR body: rule ID, before, after, and the upstream sentence that drove it, quoted.

5. **Unreachable source.** Look for the moved page in the host's `llms.txt` index. If you find it, update the `url` in `sources.json`. If you do not, leave the entry and list it in the PR body under "Unreachable".

6. **Stamp.** Set `Last distilled:` in `best-practice.md` to today (ISO date). Then store the new hashes:

   ```bash
   node ${CLAUDE_SKILL_DIR}/scripts/check-drift.mjs --write --sources <scratchpad>/bp-update/<path>/sources.json
   ```

7. **Verify.** Run `node --test <scratchpad>/bp-update/<path>/tests/*.test.mjs`. All tests pass.

8. **Ship.** Commit (`docs(skill-review): refresh best practice from upstream`), push the branch, and open a PR. The body has one section per changed source, with each rule edit and its quoted upstream sentence, then "Unreachable" if needed. Follow the repository's PR title convention.

9. **Clean up.** Run `git worktree remove <scratchpad>/bp-update`, then report the PR URL.
