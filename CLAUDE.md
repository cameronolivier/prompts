# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Purpose

This is a **prompt library** - a collection of markdown files containing reusable prompts, coding standards, and resources for AI-assisted development. No build system, compilation, or tests exist; all content is plain markdown.

## Repository Structure

```
dev/                    # Development-focused prompts
├── editors/            # Code editor rules (Cursor, Windsurf)
│   ├── globalrules.md  # Universal TypeScript/React standards
│   └── cursorrules.md  # Cursor-specific formatting
├── projects/           # Project management prompts
│   ├── code_director.md           # High-level architecture prompt
│   ├── generic-plan-from-prd.md   # PRD → implementation plan
│   └── generic-project-prompt-generator.md
├── mcps/               # MCP server directory and recommendations
├── howtos/             # How-to guides
└── theorising-and-advice/  # Development tips and UX patterns

general/                # General-purpose prompts
├── generic-prompt-generator.md
├── weekly-planner-workflow.md
└── judges/             # Prompt evaluation tools

meta/                   # Meta-prompts for prompt engineering
├── evaluate-prompt.md  # 35-criteria prompt evaluation
└── refine-prompt.md    # Iterative prompt improvement

resources/              # Curated links and references
├── links-and-resource-dump.md  # AI agent community resources
├── plugins.md          # Plugin recommendations
└── ralph.md            # Ralph Loop documentation

skills/                 # Claude Code skill definitions
design/                 # Design-related prompts
```

## Key Files and Their Purpose

- **`dev/editors/globalrules.md`**: Universal coding standards template for TypeScript, React, conventional commits, and quality gates. Use when creating `.cursorrules` or project-specific standards.

- **`dev/mcps/README.md`**: Curated list of MCP servers (Exa, Firecrawl, Ref.ai, Playwright, etc.). Reference when recommending MCPs.

- **`meta/evaluate-prompt.md` + `meta/refine-prompt.md`**: Prompt Refinement Chain - evaluate prompts against 35 criteria, then iteratively improve them.

- **`resources/links-and-resource-dump.md`**: Community skills, agent patterns, videos, and dotfile examples.

## Working with This Repository

### Adding New Prompts
- Place in appropriate directory based on category
- Use descriptive filenames (kebab-case.md)
- Include clear purpose/goal section at top
- Structure prompts with XML tags or markdown sections for clarity

### Editing Existing Prompts
- Read entire prompt first to understand context
- Preserve structure and formatting conventions
- Update related prompts if they reference each other

### Git Workflow
- Use conventional commits: `feat:`, `docs:`, `fix:`
- Add all files before committing
- Commit message format: `type: brief description` (e.g., `docs: Update MCP list with Serena`)
- List changed files in commit body for visibility

### No Build/Test Commands
This repository has no package manager, build scripts, or tests. All operations are file edits.

## Architecture Notes

**Prompt Categories**:
- **Skills** (`skills/`): Discrete, invocable behaviors for Claude Code (follow format with name/description frontmatter)
- **Editor Rules** (`dev/editors/`): Templates for `.cursorrules`, global standards, etc.
- **Project Templates** (`dev/projects/`): Prompts for generating architecture plans, PRDs, etc.
- **Meta-Prompts** (`meta/`): Self-referential prompts for improving prompts
- **Resources** (`resources/`): External references, not prompts

**Common Patterns**:
- XML tags for structured sections (`<role>`, `<requirements>`, `<goal>`)
- Numbered workflows with clear steps
- Example code snippets in fenced code blocks
- Links to external resources (GitHub, Twitter, YouTube)
