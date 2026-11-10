#!/usr/bin/env bash
# Install (or uninstall) the Claude Code hooks in this folder.
#
#   ./hooks/install.sh              symlink scripts + register them in settings.json
#   ./hooks/install.sh --uninstall  remove the symlinks + settings entries
#
# Idempotent: settings entries for these scripts are removed and re-added, so
# running it twice never duplicates hooks. Other hooks are left untouched.
# settings.json is backed up before every change.
set -euo pipefail

REPO_HOOKS="$(cd "$(dirname "$0")" && pwd)"
HOOKS_DIR="$HOME/.claude/hooks"
SETTINGS="$HOME/.claude/settings.json"
SCRIPTS=(typecheck-lint.sh boyscout-nudge.sh)

command -v jq >/dev/null 2>&1 || { echo "jq is required (brew install jq)"; exit 1; }
mkdir -p "$HOOKS_DIR"
[ -f "$SETTINGS" ] || echo '{}' > "$SETTINGS"

uninstall=false
[ "${1:-}" = "--uninstall" ] && uninstall=true

backup="$SETTINGS.bak-$(date +%Y%m%d-%H%M%S)"
cp "$SETTINGS" "$backup"

# 1. Symlinks
for s in "${SCRIPTS[@]}"; do
  target="$HOOKS_DIR/$s"
  if $uninstall; then
    [ -L "$target" ] && rm "$target" && echo "removed $target"
    continue
  fi
  if [ -e "$target" ] && [ ! -L "$target" ]; then
    mv "$target" "$target.bak"
    echo "backed up existing $target -> $target.bak"
  fi
  ln -sfn "$REPO_HOOKS/$s" "$target"
  echo "linked $target -> $REPO_HOOKS/$s"
done

# 2. Settings: drop every hook entry that runs one of our scripts, drop
# groups left empty, then (on install) add the canonical entries.
tl="bash $HOOKS_DIR/typecheck-lint.sh"
bs="bash $HOOKS_DIR/boyscout-nudge.sh"

jq --arg tl "$tl" --arg bs "$bs" --argjson uninstall "$uninstall" '
  def ours: (.command // "") | (contains("typecheck-lint.sh") or contains("boyscout-nudge.sh"));
  def strip: map(.hooks |= map(select(ours | not))) | map(select((.hooks | length) > 0));
  def add($event; $group): .hooks[$event] = ((.hooks[$event] // []) + [$group]);

  .hooks = (.hooks // {})
  | .hooks |= with_entries(.value |= strip)
  | if $uninstall then . else
      add("UserPromptSubmit"; {hooks: [{type: "command", command: ($bs + " clear")}]})
    | add("PostToolUse"; {matcher: "Edit|Write|MultiEdit|NotebookEdit",
        hooks: [{type: "command", command: ($tl + " track")}]})
    | add("PostToolUse"; {matcher: "Edit|Write|MultiEdit",
        hooks: [{type: "command", command: ($bs + " mark")}]})
    | add("Stop"; {hooks: [{type: "command", command: ($tl + " check"),
        timeout: 180, statusMessage: "Running typecheck + lint"}]})
    | add("Stop"; {hooks: [{type: "command", command: ($bs + " check"),
        statusMessage: "Boy Scout check"}]})
    end
' "$backup" > "$SETTINGS.tmp"

jq -e . "$SETTINGS.tmp" >/dev/null
mv "$SETTINGS.tmp" "$SETTINGS"
echo "updated $SETTINGS (backup: $backup)"
$uninstall || echo "Restart open Claude Code sessions to load the hooks."
