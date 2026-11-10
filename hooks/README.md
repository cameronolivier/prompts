# Hooks

Personal Claude Code hooks. `install.sh` symlinks them into `~/.claude/hooks/` and registers them in `~/.claude/settings.json`. Edits in this folder take effect at once.

```bash
./hooks/install.sh              # install or repair (safe to run again)
./hooks/install.sh --uninstall  # remove symlinks and settings entries
./hooks/test.sh                 # run the self-contained tests
```

The installer backs up `settings.json` before each change and does not touch other hooks. Restart open Claude Code sessions after you install.

## typecheck-lint.sh

Checks the files Claude edited in the current session when Claude tries to stop.

| Mode    | Event                                              | What it does                                         |
| ------- | -------------------------------------------------- | ---------------------------------------------------- |
| `track` | PostToolUse (`Edit\|Write\|MultiEdit\|NotebookEdit`) | Adds the edited file path to a per-session list      |
| `check` | Stop                                               | Runs the checks on that list and blocks if they fail |

Checks, each only if the project uses the tool:

- `typecheck` script: runs on the whole project, but only errors in edited files count.
- ESLint, Prettier (`--check`) and markdownlint-cli2: run on the edited files only.

Rules:

- Files in `node_modules`, files outside the project, and files the session did not edit never block.
- It blocks at most once per stop. When Claude Code sends `stop_hook_active: true`, the hook exits 0. Claude can then end its turn and ask you.
- The block message tells Claude to fix its own source files. For generated, vendored or third-party files, Claude must suggest an exact ignore entry and ask you. It must not edit or delete those files.
- Edits made through Bash (for example `sed`) are not tracked.

## boyscout-nudge.sh

After a turn that edited source code, asks Claude to run the `boyscout` skill once.

| Mode    | Event                                    |
| ------- | ---------------------------------------- |
| `clear` | UserPromptSubmit                         |
| `mark`  | PostToolUse (`Edit\|Write\|MultiEdit`)    |
| `check` | Stop (also skips on `stop_hook_active`)  |

## Why the loop guard matters

A Stop hook that exits 2 tells Claude it may not stop. Asking you a question is also a stop. So a hook that always fails, for example on lint errors Claude must not fix, blocks every stop and Claude loops. The `stop_hook_active` check breaks that cycle.

## Test in a live session

1. Open Claude Code in a JS or TS project that uses Prettier.
2. Ask: "Create `tmp-hook-test.ts` with the content `const   x=1`".
3. Expected result: the hook blocks once with a Prettier error, Claude fixes the file, and then the turn ends.
4. Ask Claude to delete `tmp-hook-test.ts`.
