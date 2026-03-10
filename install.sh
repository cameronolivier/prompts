#!/usr/bin/env bash

# Install script for Claude Code commands and skills
# Usage: ./install.sh [command-name|skill-name|--all] [--uninstall] [--skills]

set -e

COMMANDS_DIR="$HOME/.claude/commands"
REPO_COMMANDS="commands"
REPO_SKILLS="skills"
REPO_URL="cameronolivier/prompts"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
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

    ln -sf "$(pwd)/$source_file" "$target_file"
    echo -e "${GREEN}✓${NC} Installed command: /${cmd_name}"
}

uninstall_command() {
    local cmd_name="$1"
    local target_file="$COMMANDS_DIR/${cmd_name}.md"

    if [[ -L "$target_file" ]] || [[ -f "$target_file" ]]; then
        rm "$target_file"
        echo -e "${GREEN}✓${NC} Uninstalled command: /${cmd_name}"
    else
        echo -e "${YELLOW}⚠${NC} Command not found: /${cmd_name}"
    fi
}

install_skill() {
    local skill_name="$1"
    local skill_path="$REPO_SKILLS/$skill_name"

    if [[ ! -d "$skill_path" ]]; then
        echo -e "${RED}Error: skill '$skill_name' not found in $REPO_SKILLS/${NC}"
        return 1
    fi

    echo -e "${CYAN}Installing skill: $skill_name via npx skills...${NC}"
    npx -y skills add "https://github.com/${REPO_URL}/tree/main/skills/${skill_name}"
    echo -e "${GREEN}✓${NC} Installed skill: $skill_name"
}

list_available() {
    echo "Available commands:"
    for file in "$REPO_COMMANDS"/*.md; do
        if [[ -f "$file" && "$(basename "$file")" != "README.md" ]]; then
            echo "  - $(basename "$file" .md)"
        fi
    done
    echo ""
    echo "Available skills:"
    for dir in "$REPO_SKILLS"/*/; do
        if [[ -d "$dir" ]]; then
            echo "  - $(basename "$dir")"
        fi
    done
}

show_help() {
    echo "Usage: $0 [options] [name]"
    echo ""
    echo "Options:"
    echo "  --all, -a         Install all commands (default)"
    echo "  --skills, -s      Install skills (use with --all or a skill name)"
    echo "  --uninstall, -u   Uninstall instead of install"
    echo "  --list, -l        List available commands and skills"
    echo "  --help, -h        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                       # Install all commands"
    echo "  $0 clarify               # Install /clarify command"
    echo "  $0 -s clarify            # Install clarify skill"
    echo "  $0 -s --all              # Install all skills"
    echo "  $0 -u clarify            # Uninstall /clarify command"
}

# Parse arguments
MODE="install"
TARGET="all"
TYPE="commands"

while [[ $# -gt 0 ]]; do
    case $1 in
        --uninstall|-u)
            MODE="uninstall"
            shift
            ;;
        --skills|-s)
            TYPE="skills"
            shift
            ;;
        --list|-l)
            list_available
            exit 0
            ;;
        --help|-h)
            show_help
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
if [[ "$TYPE" == "skills" ]]; then
    if [[ "$TARGET" == "all" ]]; then
        for dir in "$REPO_SKILLS"/*/; do
            if [[ -d "$dir" ]]; then
                install_skill "$(basename "$dir")"
            fi
        done
    else
        install_skill "$TARGET"
    fi
else
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
fi

echo ""
echo -e "${GREEN}Done!${NC}"
if [[ "$MODE" == "install" ]]; then
    echo "Restart Claude Code if commands/skills don't appear immediately"
fi
