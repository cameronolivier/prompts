---
name: cmux-cli
description: Control cmux terminal multiplexer via CLI and socket API. Manage workspaces, splits, notifications, sidebar metadata, and browser automation. Use when user mentions cmux, wants to automate terminal workflows, manage workspaces/splits, send notifications, control an embedded browser, or interact with cmux surfaces.
---

# cmux CLI

cmux is a native macOS terminal multiplexer built on Ghostty. It exposes a CLI and Unix socket API for scripting.

## Quick start

```bash
# CLI symlink (one-time, if using outside cmux)
sudo ln -sf "/Applications/cmux.app/Contents/Resources/bin/cmux" /usr/local/bin/cmux

# Verify
cmux ping
```

## Detection

```bash
# Check if inside cmux
[ -n "${CMUX_WORKSPACE_ID:-}" ] && echo "Inside cmux"
# Check socket
[ -S "${CMUX_SOCKET_PATH:-/tmp/cmux.sock}" ] && echo "Socket available"
```

## Core commands

| Command | Purpose |
|---------|---------|
| `cmux list-workspaces` | List all workspaces |
| `cmux new-workspace` | Create workspace |
| `cmux select-workspace --workspace <id>` | Switch workspace |
| `cmux current-workspace` | Get active workspace |
| `cmux close-workspace --workspace <id>` | Close workspace |
| `cmux new-split {left\|right\|up\|down}` | Create split pane |
| `cmux list-surfaces` | List surfaces in workspace |
| `cmux focus-surface --surface <id>` | Focus a surface |
| `cmux send "command"` | Send text to focused terminal |
| `cmux send-key enter` | Send key press (enter/tab/escape/backspace/up/down/left/right) |
| `cmux send-surface --surface <id> "cmd"` | Send text to specific surface |
| `cmux identify` | Show current window/workspace/surface context |

## Notifications

```bash
cmux notify --title "Build done" --body "Deployed to staging"
cmux list-notifications
cmux clear-notifications
```

## Sidebar metadata

```bash
cmux set-status <key> <value> [--icon <icon>] [--color <hex>]
cmux clear-status <key>
cmux set-progress 0.75 --label "Building..."
cmux clear-progress
cmux log --level success --source build "Compiled OK"  # levels: info/progress/success/warning/error
cmux clear-log
cmux sidebar-state
```

## CLI flags

- `--json` — JSON output
- `--socket PATH` — custom socket path
- `--window ID` — target window
- `--workspace ID` — target workspace
- `--surface ID` — target surface

## Browser automation

cmux has a built-in browser with full automation. See [BROWSER.md](BROWSER.md) for complete reference.

```bash
cmux browser open https://example.com
cmux browser open-split https://example.com  # opens in split
cmux browser surface:2 snapshot --interactive --compact
cmux browser surface:2 click "button[type='submit']"
cmux browser surface:2 fill "#email" --text "user@example.com"
cmux browser surface:2 wait --text "Success"
```

## Socket API

For programmatic access. See [API-REFERENCE.md](API-REFERENCE.md) for full details.

Socket: `/tmp/cmux.sock` (override via `CMUX_SOCKET_PATH`)

```bash
# Send JSON-RPC over Unix socket
echo '{"id":"1","method":"workspace.list","params":{}}' | nc -U /tmp/cmux.sock
```

## Environment variables

| Variable | Purpose |
|----------|---------|
| `CMUX_SOCKET_PATH` | Override socket path |
| `CMUX_SOCKET_MODE` | Access mode: `cmuxOnly` (default), `allowAll`, `off` |
| `CMUX_WORKSPACE_ID` | Auto-set inside cmux |
| `CMUX_SURFACE_ID` | Auto-set inside cmux |
