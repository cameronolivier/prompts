#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SETTINGS_FILE="$HOME/.claude/settings.json"

echo "Mo AI — Status Line Installer"
echo "=============================="
echo ""

# Check optional dependencies
if ! command -v jq &> /dev/null; then
  echo "⚠  jq not found. Context % display requires jq (install: brew install jq)"
fi

# Ensure ~/.claude exists
mkdir -p "$HOME/.claude"

# Build the statusLine config pointing to the wrapper
STATUSLINE_CMD="bash ${SCRIPT_DIR}/statusline-wrapper.sh"

if [ ! -f "$SETTINGS_FILE" ]; then
  # No settings file — create one with just the statusLine
  cat > "$SETTINGS_FILE" << EOF
{
  "statusLine": {
    "type": "command",
    "command": "$STATUSLINE_CMD"
  }
}
EOF
  echo "Created $SETTINGS_FILE with status line config."
else
  # Settings file exists — check if statusLine already configured
  if grep -q '"statusLine"' "$SETTINGS_FILE"; then
    echo "statusLine already exists in $SETTINGS_FILE"
    echo ""
    echo "To update manually, set:"
    echo ""
    echo "  \"statusLine\": {"
    echo "    \"type\": \"command\","
    echo "    \"command\": \"$STATUSLINE_CMD\""
    echo "  }"
    echo ""
    read -p "Overwrite existing statusLine config? [y/N] " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo "Skipped. No changes made."
      exit 0
    fi
  fi

  # Use node (guaranteed available — Claude Code requires it)
  node -e "
    const fs = require('fs');
    const settings = JSON.parse(fs.readFileSync('$SETTINGS_FILE', 'utf8'));
    settings.statusLine = {
      type: 'command',
      command: '$STATUSLINE_CMD'
    };
    fs.writeFileSync('$SETTINGS_FILE', JSON.stringify(settings, null, 2) + '\n');
  "
  echo "Updated statusLine in $SETTINGS_FILE"
fi

echo ""
echo "Done. Restart Claude Code to see the status line."
echo ""
echo "Shows: [repo] | [branch] | S: [staged] | U: [unstaged] | A: [untracked] | [context%]"
