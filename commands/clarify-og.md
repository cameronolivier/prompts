---
name: clarify
description: Interview-driven requirements clarification for apps and features, outputs specification document
---

# Clarify Requirements

## Purpose

Interview the user to transform a high-level idea into a detailed specification document through structured clarification. Primary focus: web/mobile apps and software features, ranging from single tasks to full applications.

## Workflow

### Phase 1: Initial High-Level Interview (Max 10 Questions)

When invoked, the user will provide an initial idea/topic. Your job:

1. **Ask 1-10 broad questions** to establish rails around the work
   - Use `AskUserQuestion` tool to batch questions
   - Keep questions HIGH-LEVEL (scope, users, core purpose, constraints)
   - Goal: Understand WHAT and WHY, not HOW yet
   - Ask session preference: "Do you want to answer questions in batches (I ask several at once) or iteratively (one at a time)?" Default to batch.

2. **Question categories to cover** (adapt based on topic):
   - Core objective: What problem does this solve? For whom?
   - Scope: Full app, feature addition, or single task?
   - Users: Who uses this? How technical are they?
   - Success criteria: What does "done" look like?
   - Constraints: Budget, timeline, team size, tech stack?
   - Context: Existing systems/data to integrate with?
   - Priority: Must-have vs nice-to-have features?

3. **Tone**: Concise, efficient, no fluff. Get to the point.

### Phase 2: Generate Clarification Document

After Phase 1, create a markdown file in `/plans/` directory:

1. **Filename**: Suggest a descriptive name based on topic (e.g., `user-authentication-clarification.md`, `mobile-expense-tracker-clarification.md`)

2. **Document structure**:
   ```markdown
   # [Project/Feature Name] - Requirements Clarification

   ## Phase 1 Summary
   [Synthesize user's answers from initial interview]

   ## Clarification Questions

   ### [Category 1: e.g., User Experience]
   **Q1: [Question]**
   - [ ] Option A: [description]
   - [ ] Option B: [description]
   - [ ] Option C: [description]
   - [ ] Other: _____

   **Q2: [Question]**
   ...

   ### [Category 2: e.g., Technical Architecture]
   ...

   ### [Category 3: e.g., Data & Privacy]
   ...

   ## Instructions
   Complete all questions above, then notify me that you're done.
   ```

3. **Multiple-choice format**: Pick best approach per question
   - Simple checkboxes for binary/straightforward choices
   - Detailed options with pros/cons for complex architectural decisions
   - Tiered (Recommended/Alternative/Advanced) when clear best practice exists
   - Open-ended when creativity/specificity needed

4. **Question generation strategy**:
   - Think comprehensively: features, constraints, architecture, success metrics, risks, edge cases
   - Organize by logical categories (UX, Technical, Data, Security, Deployment, etc.)
   - Prioritize questions that eliminate ambiguity or prevent rework
   - Challenge assumptions: If something seems risky/contradictory, call it out as a question

5. **Tell user**: "I've created `[filename]` in `/plans/`. Complete the questions and let me know when done."

### Phase 3: Iterative Refinement

When user says they've completed the document:

1. **Read the updated document** with their answers
2. **Identify gaps**: Are there new questions based on their answers? Any contradictions?
3. **Update the same document** with new questions (append to existing categories or add new ones)
4. **Repeat** until either:
   - You judge you have sufficient detail to write a complete spec
   - User says "generate spec now"

### Phase 4: Generate Final Specification

When ready, create the final specification document in `/plans/`:

1. **Filename**: `[project-name]-specification.md`

2. **Format selection** (decide based on scope):
   - **Single task/small feature**: User story format + acceptance criteria
   - **Feature/module**: PRD style with user stories, success metrics, technical approach
   - **Full application**: Comprehensive (overview, user personas, features, architecture, constraints, success metrics, risks, rollout plan)

3. **Core sections to include** (adapt based on scope):
   ```markdown
   # [Project Name] - Specification

   ## Overview
   - Problem statement
   - Solution summary
   - Target users

   ## Requirements
   ### Functional Requirements
   [What it must do]

   ### Non-Functional Requirements
   [Performance, security, scalability, accessibility]

   ## User Stories / Features
   [Organized by priority: Must-Have, Should-Have, Nice-to-Have]

   ## Technical Approach
   - Architecture overview
   - Tech stack decisions
   - Data models (if applicable)
   - Key APIs/integrations

   ## Constraints & Assumptions
   - Budget, timeline, team
   - Technical constraints
   - Assumptions made

   ## Success Metrics
   [How we measure success]

   ## Risks & Mitigations
   [What could go wrong, how to handle it]

   ## Out of Scope
   [Explicit exclusions]
   ```

4. **Validation step**: After generating spec, ask: "Review the specification above. Any gaps or changes needed?"

## Guidelines

**Do:**
- Be concise and efficient in communication
- Actively question risky/problematic assumptions
- Organize questions logically by category
- Provide context for why you're asking each question
- Suggest sensible defaults when appropriate
- Scale the specification detail to match project scope

**Don't:**
- Ask more than 10 questions in Phase 1
- Repeat questions already answered
- Generate specs with obvious gaps
- Use generic/vague language in the spec
- Make up technical details - ask if unsure

## Example Invocation

```
User: /clarify

User: I want to build a habit tracking app