# Prompts

A collection of prompts, commands, and resources for AI-assisted development.

## Quick Start

### Install Commands

```bash
./install.sh           # Install all commands
./install.sh clarify   # Install specific command
./install.sh --help    # See all options
```

Commands symlink to `~/.claude/commands/` and are available as `/command-name` in Claude Code.

### Install Skills

```bash
./install.sh -s clarify          # Install specific skill
./install.sh -s --all            # Install all skills
```

Skills are installed via [`npx skills add`](https://github.com/vercel-labs/skills).

## Repository Contents

- **`commands/`** - Custom slash commands for Claude Code
- **`skills/`** - Claude Code skill definitions
- **`dev/`** - Development prompts (editor rules, project templates, MCPs)
- **`general/`** - General-purpose prompts
- **`meta/`** - Prompt engineering tools (evaluate, refine)
- **`resources/`** - Curated links and references
