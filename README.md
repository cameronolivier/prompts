# Prompts

A collection of prompts, commands, and resources for AI-assisted development.

## Quick Start

### Install Commands

Install custom Claude Code slash commands:

```bash
./install.sh           # Install all commands
./install.sh clarify   # Install specific command
./install.sh --help    # See all options
```

Commands will be symlinked to `~/.claude/commands/` and available as `/command-name` in Claude Code.

## Repository Contents

- **`.claude/commands/`** - Custom slash commands for Claude Code
- **`dev/`** - Development prompts (editor rules, project templates, MCPs)
- **`general/`** - General-purpose prompts
- **`meta/`** - Prompt engineering tools (evaluate, refine)
- **`resources/`** - Curated links and references
- **`skills/`** - Claude Code skill definitions
