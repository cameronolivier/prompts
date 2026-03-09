---
name: grill-me
description: Relentlessly interview the user about every aspect of a plan or design until reaching shared understanding. Use when user says "grill me", "interrogate this plan", "challenge my design", "poke holes", or wants rigorous plan review through structured questioning.
---

# Grill Me

Systematically interrogate a plan by walking each branch of the design tree, resolving dependencies between decisions one-by-one.

## Trigger

User has a plan, PRD, design doc, or architectural proposal they want stress-tested through questioning.

## Process

### 1. Ingest the plan

- Read the plan file or ask the user to share it
- Silently build a mental map of the **design tree**: every decision point, assumption, dependency, and open question

### 2. Identify the decision tree

Before asking anything, map out:

- **Root decisions** - foundational choices everything else depends on
- **Branch decisions** - choices that follow from root decisions
- **Leaf decisions** - implementation details that depend on branches
- **Cross-cutting concerns** - decisions that affect multiple branches (security, performance, error handling, rollback)
- **Implicit assumptions** - things the plan takes for granted without stating

### 3. Interview top-down, resolve bottom-up

Start from **root decisions** and work down each branch:

1. State which decision you're examining and why it matters
2. Ask **one focused question** at a time — never bundle questions
3. Wait for the answer before proceeding
4. If the answer reveals a dependency on an unresolved decision, pause and resolve that first
5. When a branch is fully resolved, summarize the agreed decisions before moving to the next branch
6. Track resolved vs. unresolved decisions explicitly

### 4. Question types to rotate through

- **Clarification**: "What exactly do you mean by X?"
- **Constraint**: "What happens when Y fails / is unavailable / exceeds limits?"
- **Alternative**: "Why X over Z? What did you consider and reject?"
- **Dependency**: "This assumes A is true — have we validated that?"
- **Sequencing**: "Which of these must happen first? What blocks what?"
- **Scope**: "Is this in v1 or later? What's the minimum viable version?"
- **Contradiction**: "Earlier you said X, but this implies Y — which is it?"

### 5. Close out

When all branches are resolved:

- Print a **decision log**: numbered list of every resolved decision
- Flag any **remaining open questions** or **risks**
- Offer to update the plan file with the resolved decisions

## Rules

- Be relentless but respectful — the goal is clarity, not gotchas
- One question at a time. Wait for the answer.
- Never assume — if something is ambiguous, ask
- If the user says "skip" or "park it", note it as unresolved and move on
- Explicitly track: `[RESOLVED]`, `[OPEN]`, `[PARKED]` for each decision
- Revisit parked items at the end
