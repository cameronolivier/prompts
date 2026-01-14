# Commands

Custom slash commands for Claude Code.

## Installation

Install individual commands or all at once:

### Install All Commands
```bash
./install.sh
```

### Install Individual Command
```bash
./install.sh clarify
```

### Uninstall
```bash
./install.sh --uninstall clarify
```

## Available Commands

### `/clarify`
Interview-driven requirements clarification. Transforms high-level ideas into detailed specifications through structured questioning.

**Usage:**
```
/clarify
I want to build [your idea]
```

**Process:**
1. High-level interview (≤10 questions)
2. Generates `/plans/[topic]-clarification.md` with detailed questions
3. Iterative refinement based on your answers
4. Outputs final specification document

---

## Command Structure

Commands are stored in `.claude/commands/` and follow this format:

```markdown
---
name: command-name
description: Brief description
---

# Command Name

[Instructions for Claude Code]
```
