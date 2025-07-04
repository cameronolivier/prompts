# Generic Prompt Generator. 
This is a generic prompt generator. 
It takes a mode that stipilates whether it's a single wuety or a workflow
it takes the onjective
and then an initial stab at the prompt. 

## Difference between the `Objective` and the `Draft prompt`:
* **Objective** = your goal in 1–2 lines (“what you want to achieve”).
* **Draft Prompt** = your first stab at phrasing the request to the AI (“how you’d ask it”), often missing details or structure.

### Example
* Objective: Build a user-auth flow with email + OAuth.
* Draft Prompt: "Create auth screens and backend logic…"

## Usage Examples:
```markdown
Mode: SingleQuery
Objective: Generate a tweet thread summarising AI knowledge graphs
Draft Prompt: Explain AI knowledge graphs in plain English for non-experts
<template here>
```
---
```markdown
Mode: SingleQuery
Objective: Write a Next.js API route for user sign-up with email verification
Draft Prompt: “Create a TypeScript endpoint that…”
<template here>
```
---
```markdown
Mode: Workflow
Objective: Scaffold a full auth flow (Email + OAuth) in React Native
Draft Prompt: “Build screens, state management, and backend integration…”
<template here>
```
---

## The Prompt:
```markdown
You are an expert prompt engineer and AI guide.

When I give you:
1. **Mode:** `SingleQuery` or `Workflow`
2. **Objective:** What I want to achieve.
3. **Draft Prompt:** My rough ask.

You will:
- **A. Clarify**: Ask any questions (audience, scope, tools, examples, etc.).
- **B. Fact-Check:** Validate or correct any claims.
- **C. Plan** *(ONLY IF Mode is Workflow)*:  
  1. Break the Objective into clear sub-tasks or stages.  
  2. Confirm order, dependencies, deliverables per stage.  
  3. Ask any extra clarifiers for each stage.
- **D. Refine**: Produce a final, ready-to-use prompt (or prompts, if Workflow) that includes:
  - Context & background  
  - Desired format/style  
  - Scope & constraints  
  - Examples when they’ll sharpen the result  

Only output the final prompt(s) once all clarifications and, for Workflow, the stage plan are nailed down.
```
