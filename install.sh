#!/usr/bin/env bash

# Install script for Claude Code commands
# Usage: ./install.sh [command-name|--all] [--uninstall]

set -e

COMMANDS_DIR="$HOME/.claude/commands"
REPO_COMMANDS=".claude/commands"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Ensure target directory exists
mkdir -p "$COMMANDS_DIR"

install_command() {
    local cmd_name="$1"
    local source_file="$REPO_COMMANDS/${cmd_name}.md"
    local target_file="$COMMANDS_DIR/${cmd_name}.md"

    if [[ ! -f "$source_file" ]]; then
        echo -e "${RED}Error: $source_file not found${NC}"
        return 1
    fi

    # Create symlink
    ln -sf "$(pwd)/$source_file" "$target_file"
    echo -e "${GREEN}✓${NC} Installed: /${cmd_name} → $target_file"
}

uninstall_command() {
    local cmd_name="$1"
    local target_file="$COMMANDS_DIR/${cmd_name}.md"

    if [[ -L "$target_file" ]] || [[ -f "$target_file" ]]; then
        rm "$target_file"
        echo -e "${GREEN}✓${NC} Uninstalled: /${cmd_name}"
    else
        echo -e "${YELLOW}⚠${NC} Command not found: /${cmd_name}"
    fi
}

list_available_commands() {
    echo "Available commands:"
    for file in "$REPO_COMMANDS"/*.md; do
        if [[ -f "$file" && "$(basename "$file")" != "README.md" ]]; then
            local cmd_name=$(basename "$file" .md)
            echo "  - $cmd_name"
        fi
    done
}

# Parse arguments
MODE="install"
TARGET="all"

while [[ $# -gt 0 ]]; do
    case $1 in
        --uninstall|-u)
            MODE="uninstall"
            shift
            ;;
        --list|-l)
            list_available_commands
            exit 0
            ;;
        --help|-h)
            echo "Usage: $0 [command-name|--all] [--uninstall]"
            echo ""
            echo "Options:"
            echo "  --all, -a         Install all commands (default)"
            echo "  --uninstall, -u   Uninstall instead of install"
            echo "  --list, -l        List available commands"
            echo "  --help, -h        Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                 # Install all commands"
            echo "  $0 clarify         # Install only /clarify command"
            echo "  $0 -u clarify      # Uninstall /clarify command"
            exit 0
            ;;
        --all|-a)
            TARGET="all"
            shift
            ;;
        *)
            TARGET="$1"
            shift
            ;;
    esac
done

# Execute
if [[ "$TARGET" == "all" ]]; then
    for file in "$REPO_COMMANDS"/*.md; do
        if [[ -f "$file" && "$(basename "$file")" != "README.md" ]]; then
            cmd_name=$(basename "$file" .md)
            if [[ "$MODE" == "install" ]]; then
                install_command "$cmd_name"
            else
                uninstall_command "$cmd_name"
            fi
        fi
    done
else
    if [[ "$MODE" == "install" ]]; then
        install_command "$TARGET"
    else
        uninstall_command "$TARGET"
    fi
fi

echo ""
echo -e "${GREEN}Done!${NC}"
if [[ "$MODE" == "install" ]]; then
    echo "Commands are now available in Claude Code"
    echo "Restart Claude Code if commands don't appear immediately"
fi
