---
name: github-cli-rate-limits
description: Use the GitHub CLI (gh) conservatively to avoid exhausting REST and GraphQL rate limits. Covers pre-flight checks, caching IDs across calls, server-side filtering, batching via graphql, and knowing which gh subcommands hit which budget. Use whenever running multiple gh commands in a row, automating GitHub workflows, touching Projects v2 (`gh project`), doing bulk issue/PR work, or after hitting a 403 secondary-rate-limit error.
allowed-tools:
  - Bash(gh:*)
  - Bash(jq:*)
  - Bash(GH_DEBUG=*)
---

# Conservative gh CLI usage

> **Recommended model: Haiku** — pure reference/discipline skill. Rules + lookup table; no reasoning required.

Personal tokens get **5000 requests/hour for REST** and **5000 points/hour for GraphQL** — tracked separately. Cheap to blow through with loops. Once exhausted, you're blocked for up to an hour. Be stingy by default.

## Pre-flight: always check before bulk work

```bash
gh api rate_limit --jq '{
  rest:    .resources.core,
  search:  .resources.search,
  graphql: .resources.graphql
} | map_values({remaining, limit, reset_in_min: ((.reset - now) / 60 | floor)})'
```

Abort or warn the user if `graphql.remaining` is under ~200 before starting a loop, or `rest.remaining` is under ~500. Don't "try and see" — the 403 leaves you locked out.

## Which budget does each command hit?

| Budget | Commands |
|---|---|
| **GraphQL** | `gh project *` (all Projects v2), `gh api graphql`, `gh search` (some paths), anything behind Discussions/Insights |
| **Search** (30/min) | `gh search issues`, `gh search prs`, `gh search code`, `gh search repos` |
| **REST** | everything else — `gh issue`, `gh pr`, `gh repo`, `gh api /repos/...`, `gh run`, `gh release`, `gh auth` |

When in doubt: `GH_DEBUG=api gh <cmd>` prints the actual endpoint hit.

## Conservation rules

1. **Cache opaque IDs in shell vars.** Project node IDs, field IDs, option IDs, repo IDs don't change. Look up once per session, reuse. Re-fetching them is the single most common waste.
2. **Filter server-side, not client-side.** `gh issue list --search "is:open label:bug"` beats pulling every issue and piping to `jq`. `gh project item-list --query "is:issue -status:Done"` beats unfiltered `item-list` + jq.
3. **Cap `-L` / `--limit`.** Defaults vary (30 for `item-list`, 30 for `issue list`). Setting `-L 1000` "just in case" paginates silently and costs N calls.
4. **Batch with `gh api graphql`.** One query can replace many REST/gh-project calls. Pass variables with `-f key=value` and extract with `--jq`. Example — fetch project ID, field IDs, and a specific item in one hit:

    ```bash
    gh api graphql -f owner="$OWNER" -F number=$NUMBER -F issue=$ISSUE -f query='
      query($owner:String!, $number:Int!, $issue:Int!) {
        user(login:$owner) {
          projectV2(number:$number) {
            id
            field(name:"Status") {
              ... on ProjectV2SingleSelectField {
                id
                options { id name }
              }
            }
            items(first:1, query:$issue) {
              nodes { id content { ... on Issue { number } } }
            }
          }
        }
      }'
    ```

   That's 1 GraphQL call instead of 3 `gh project *` calls — ~70% saving for the common "move one issue" flow.
5. **Avoid polling.** If you need to watch for state change, sleep 30-60s minimum between polls. Prefer webhooks/`gh run watch` (uses its own budget) over hand-rolled `while` loops.
6. **Skip commands you don't need.** Don't `gh repo view` just to confirm the repo exists. Don't `gh auth status` on every call — once per session.
7. **For reads, pick the cheaper path.** `gh api /repos/:o/:r/issues/:n` is 1 REST call. `gh issue view` may make 2-3 (issue + comments + reactions) depending on fields. Use `--jq` on the raw `api` call when you only need one field.

## If you've already been rate-limited

- The `reset` timestamp from `gh api rate_limit` tells you when it lifts — usually <1 hour.
- Secondary rate limits (abuse detection) kick in on rapid identical calls; back off exponentially, don't retry tight.
- A second authenticated user/token has a separate budget — switch with `gh auth switch` if urgent.
- Unauthenticated `gh` falls back to 60 REST/hour. Never a real workaround.

## Recording the damage

When a session burns through a lot of budget, note what caused it (usually: uncached ID lookups in a loop, or unbounded `--limit`). That's the pattern to fix next time.
