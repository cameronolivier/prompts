# Work Skill Grid Refactor

**Date:** 2026-04-10
**Status:** In Progress

## Overview

Refactor `/work` skill from separate cmux workspaces / tmux sessions per issue to a **single workspace with split panes** (dashboard grid). Orchestrator stays in pane 0, agent panes split alongside.

## Status Model

```
pending → in_progress → agent_complete → in_review → complete
                    ↘ failed
```

| Status | Set by | Trigger |
|--------|--------|---------|
| `pending` | `/work` orchestrator | Worktree created, agent not yet started |
| `in_progress` | `/implement` agent | Agent begins work |
| `agent_complete` | `/implement` agent | Draft PR created, all checks pass |
| `in_review` | Human / orchestrator | PR taken out of draft |
| `complete` | Human / orchestrator | PR merged |
| `failed` | `/implement` agent | Blocker after 2 attempts |

## Grid Architecture

- **Single workspace** — orchestrator in pane 0, agents in split panes
- **Dynamic splits** — create panes as needed per wave, no fixed grid
- **Pane lifecycle** — panes stay open after agent finishes (user interacts/verifies), close on cleanup or user request
- **Launch script** (`work-launch.sh`) handles grid mechanics (split, boot, send /implement, close)
- **Skill markdown** keeps orchestration logic (waves, deps, status), delegates grid plumbing to script

## Launch Script (`skills/work/scripts/work-launch.sh`)

Subcommands:
- `split --issue <n> --slug <slug> --worktree <path>` — create split, boot claude, send `/implement <n>`
- `close --surface <ref>` — close a pane
- `status --surface <ref>` — check if claude is running in pane

Supports both cmux and tmux via `$DISPATCH` env var.

## Skill Changes

### `/work` skill
- [x] New status model (add `agent_complete`)
- [x] Single workspace grid (cmux: one workspace + splits, tmux: one session + panes)
- [x] Call `work-launch.sh` for grid mechanics instead of inline cmux/tmux commands
- [x] Add `.olvrcc/` to project `.gitignore` on first creation
- [x] All PRs created as draft
- [x] Panes close on cleanup, not auto-close

### `/implement` skill
- [x] Create draft PRs (not regular)
- [x] Set `agent_complete` status when draft PR is up
- [x] Explicit inline commands with variables (reduce agent derivation)

## Design Decisions

- **No auto-close panes** — user wants to verify and interact with agents post-implementation
- **No CLI tool yet** — inline commands in skill markdown, scripts for mechanical parts only
- **Agent dispatch unchanged** — parallel Agent tool calls remain the fallback when no multiplexer available
- **.olvrcc/ not .moai/** — repo source uses .olvrcc (user's installed copy uses .moai via personal override)
