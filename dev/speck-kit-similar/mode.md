# Development Modes

This document defines two structured development workflows for this project: **Spec Mode** and **Vibe Mode**. Each mode serves different project needs and team preferences.

---

## Mode Selection

At the start of each new task or feature request, use the AskUserQuestion tool to present mode options:

```javascript
AskUserQuestion({
  questions: [{
    question: "Which development mode would you like to use for this feature?",
    header: "Dev Mode",
    multiSelect: false,
    options: [
      {
        label: "Spec Mode",
        description: "Structured approach with Requirements â†’ Design â†’ Tasks phases. Best for complex features, team collaboration, or when clear documentation is needed."
      },
      {
        label: "Vibe Mode",
        description: "Rapid implementation with minimal upfront planning. Best for prototypes, small features, or when speed is the priority."
      }
    ]
  }]
})
```

Wait for the user's response before proceeding.

---

## Mode Decision Matrix

Use this matrix to recommend the appropriate mode:

| Factor | Spec Mode | Vibe Mode |
|--------|-----------|-----------|
| **Feature Complexity** | High (multiple components, systems) | Low (single component, isolated change) |
| **Team Size** | Multiple developers | Solo developer |
| **Documentation Needs** | Required for handoff/review | Minimal/none |
| **Timeline** | Sufficient time for planning | Urgent/tight deadline |
| **Requirements Clarity** | Unclear, needs exploration | Well-understood |
| **Risk Level** | High (affects core functionality) | Low (experimental, easily reversible) |

---

## SPEC MODE WORKFLOW

When the user selects Spec Mode, follow this three-phase gated process:

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Requirements   â”‚
â”‚    Document     â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”˜
         â”‚
    â”Œâ”€â”€â”€â”€â–¼â”€â”€â”€â”€â”
    â”‚ Gate 1  â”‚ Review & Approve
    â””â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”˜
         â”‚
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚     Design      â”‚
â”‚    Document     â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”˜
         â”‚
    â”Œâ”€â”€â”€â”€â–¼â”€â”€â”€â”€â”
    â”‚ Gate 2  â”‚ Review & Approve
    â””â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”˜
         â”‚
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚      Tasks      â”‚
â”‚    Document     â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”˜
         â”‚
    â”Œâ”€â”€â”€â”€â–¼â”€â”€â”€â”€â”
    â”‚ Gate 3  â”‚ Review & Begin Implementation
    â””â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”˜
         â”‚
         â–¼
   Implementation
```

---

### Phase 1: Requirements Document

**Objective:** Define WHAT needs to be built, not HOW to build it.

#### Document Structure

Create a requirements document that includes:

1. **Overview**
   - Brief description of the feature and its purpose
   - Business value and success metrics
   - Target users and use cases

2. **User Stories**
   - Format: "As a [user type], I want [goal], so that [benefit]"
   - Prioritize by impact (Must Have, Should Have, Nice to Have)

3. **Acceptance Criteria**
   - Specific, testable conditions that must be met
   - Given-When-Then format where applicable
   - Edge cases and error scenarios

4. **Non-functional Requirements**
   - Performance targets (load time, response time)
   - Security considerations
   - Accessibility requirements (WCAG compliance)
   - Browser/device compatibility

5. **Out of Scope**
   - Explicitly state what this feature does NOT include
   - Future enhancements to consider separately

6. **Dependencies & Constraints**
   - Required APIs, services, or third-party integrations
   - Technical or business constraints

#### Gate 1: Requirements Review

After creating the requirements document:

1. Save it to `docs/requirements/[feature-name].md`
2. Present to the user using AskUserQuestion:

```javascript
AskUserQuestion({
  questions: [{
    question: "Requirements document is ready for review. How would you like to proceed?",
    header: "Gate 1",
    multiSelect: false,
    options: [
      {
        label: "Approve & Continue",
        description: "Requirements look good. Proceed to design phase."
      },
      {
        label: "Request Changes",
        description: "I have feedback or changes needed before moving forward."
      },
      {
        label: "Discuss Specific Section",
        description: "I want to discuss or clarify specific requirements."
      }
    ]
  }]
})
```

3. **Wait for approval** before proceeding to Phase 2
4. If changes requested, iterate on the requirements until approved

---

### Phase 2: Design Document

**Objective:** Define HOW to build it technically, ensuring alignment with requirements.

#### Document Structure

Based on approved requirements, create a design document that includes:

1. **Architecture Overview**
   - High-level technical approach and patterns
   - System architecture diagram (text-based)
   - Integration points with existing systems

2. **Component Design**
   - Key modules, services, or components needed
   - Component hierarchy and relationships
   - State management approach

3. **Data Models**
   - Database schemas and migrations
   - TypeScript interfaces and types
   - Data flow diagrams

4. **API Design** (if applicable)
   - Endpoints and HTTP methods
   - Request/response formats
   - Authentication and authorization
   - Error responses and status codes

5. **Correctness Properties**
   - Testable properties that verify implementation works correctly
   - Map each acceptance criterion to specific correctness properties
   - Unit test and integration test strategies

6. **Technical Decisions**
   - Key architectural choices and rationale
   - Trade-offs considered
   - Alternatives evaluated

7. **Dependencies**
   - External libraries and versions
   - Third-party services
   - Impact on bundle size and performance

8. **Security Considerations**
   - Input validation and sanitization
   - Authentication and authorization flows
   - Data encryption and privacy

9. **Error Handling Strategy**
   - Error boundaries and fallbacks
   - User-facing error messages
   - Logging and monitoring

#### Gate 2: Design Review

After creating the design document:

1. Save it to `docs/design/[feature-name].md`
2. Ensure it references the requirements document
3. Present to the user using AskUserQuestion:

```javascript
AskUserQuestion({
  questions: [{
    question: "Design document is ready for review. How would you like to proceed?",
    header: "Gate 2",
    multiSelect: false,
    options: [
      {
        label: "Approve & Continue",
        description: "Design looks solid. Proceed to task breakdown."
      },
      {
        label: "Request Changes",
        description: "I have technical feedback or architectural concerns."
      },
      {
        label: "Discuss Alternatives",
        description: "I want to explore different technical approaches."
      }
    ]
  }]
})
```

4. **Wait for approval** before proceeding to Phase 3
5. If changes requested, iterate on the design until approved

---

### Phase 3: Tasks Document

**Objective:** Break down the implementation into manageable, trackable tasks with visual progress tracking.

#### Document Structure

Based on approved requirements and design, create a tasks document with visual progress indicators:

1. **Visual Progress Header**
   ```markdown
   ## Progress Overview

   ðŸ“Š **Overall Progress:** â–“â–“â–“â–“â–“â–“â–‘â–‘â–‘â–‘ 60% (6/10 tasks completed)

   ðŸ“ **Current Phase:** Core Functionality
   â±ï¸  **Last Updated:** 2025-01-24 14:30
   ðŸŽ¯ **Next Milestone:** Complete data layer (Tasks #7-8)

   ### Phase Breakdown
   ```
   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
   â”‚ Foundation      [â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆ] 100% (3/3) âœ“            â”‚
   â”‚ Core Features   [â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–‘â–‘â–‘â–‘]  66% (2/3) â† IN PROGRESSâ”‚
   â”‚ Polish & UX     [â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘]   0% (0/2)              â”‚
   â”‚ Testing         [â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘]   0% (0/2)              â”‚
   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
   ```

2. **Task Breakdown with Visual Status**
   - Tasks organized by phase with dependency tree
   - Each task shows: status icon, progress, blockers, time estimate
   - Visual dependency relationships

3. **Task Format**
   ```markdown
   ### ðŸ—ï¸ Foundation Phase

   - [x] **Task #1:** Create TypeScript interfaces â±ï¸ 2h
     - **Status:** âœ… COMPLETED (2025-01-24 10:15)
     - **Addresses:** Requirements 1.1, Design Section 3.1
     - **Dependencies:** None
     - **Files:** `src/types/user.ts`, `src/types/profile.ts`
     - **Completion Criteria:**
       - [x] All interfaces exported and documented
       - [x] No TypeScript errors
     - **Notes:** Added additional `ProfileMetadata` interface for future extensibility

   - [x] **Task #2:** Set up database migrations â±ï¸ 3h
     - **Status:** âœ… COMPLETED (2025-01-24 13:45)
     - **Addresses:** Design Section 3.2
     - **Dependencies:** Task #1
     - **Files:** `prisma/migrations/`, `prisma/schema.prisma`
     - **Completion Criteria:**
       - [x] Migration files created and tested
       - [x] Schema validated

   ### âš™ï¸ Core Features Phase

   - [x] **Task #3:** Implement UserService â±ï¸ 4h
     - **Status:** âœ… COMPLETED (2025-01-24 14:20)
     - **Addresses:** Design Section 2.1, Requirements 2.1-2.3
     - **Dependencies:** Task #1, Task #2
     - **Files:** `src/services/UserService.ts`
     - **Completion Criteria:**
       - [x] CRUD operations implemented
       - [x] Unit tests pass (15/15)

   - [âš¡] **Task #4:** Build Profile component â±ï¸ 3h â† CURRENT
     - **Status:** ðŸ”„ IN PROGRESS (Started 2025-01-24 14:30)
     - **Progress:** â–“â–“â–“â–“â–“â–‘â–‘â–‘â–‘â–‘ 50%
     - **Addresses:** Requirements 3.1, Design Section 2.2
     - **Dependencies:** Task #3
     - **Files:** `src/components/Profile/index.tsx`
     - **Completion Criteria:**
       - [x] Component scaffolding complete
       - [x] Props interface defined
       - [ ] Render logic implemented
       - [ ] Event handlers wired up
       - [ ] Accessibility attributes added
     - **Current Work:** Implementing form validation logic
     - **Blockers:** None

   - [ ] **Task #5:** Add profile edit functionality â±ï¸ 4h
     - **Status:** â³ PENDING
     - **Addresses:** Requirements 3.2-3.4
     - **Dependencies:** Task #4
     - **Files:** `src/components/ProfileEdit/index.tsx`
     - **Completion Criteria:**
       - [ ] Edit form with validation
       - [ ] Optimistic updates
       - [ ] Error handling
   ```

4. **Task Ordering & Dependency Visualization**
   ```markdown
   ## Task Dependency Graph

   Task #1 (Types) â”€â”€â”¬â”€â”€> Task #3 (UserService) â”€â”€> Task #4 (Profile) â”€â”€> Task #5 (Edit)
                     â”‚                                    â”‚
   Task #2 (DB) â”€â”€â”€â”€â”€â”˜                                    â””â”€â”€> Task #6 (Avatar)
                                                               â”‚
                     â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                     â”‚
                     â””â”€â”€> Task #7 (Polish) â”€â”€> Task #9 (Unit Tests)
                          Task #8 (UX) â”€â”€â”€â”€â”€â”€â”€â”€> Task #10 (E2E Tests)
   ```

5. **Live Progress Tracking**
   - Update the document after EVERY task completion
   - Update progress bars when starting/completing tasks
   - Add timestamps and notes for significant milestones
   - Track blockers and resolution in real-time

#### Gate 3: Tasks Review & Implementation Start

After creating the tasks document:

1. Save it to `docs/tasks/[feature-name].md`
2. Reference both requirements and design documents
3. Present to the user using AskUserQuestion:

```javascript
AskUserQuestion({
  questions: [{
    question: "Task breakdown is complete with visual progress tracking. Ready to begin implementation?",
    header: "Gate 3",
    multiSelect: false,
    options: [
      {
        label: "Start Implementation",
        description: "Tasks look good. Let's begin building and track progress in real-time."
      },
      {
        label: "Adjust Task Order",
        description: "I want to change the sequence or priority of tasks."
      },
      {
        label: "Break Down Further",
        description: "Some tasks seem too large or complex."
      },
      {
        label: "Review All Docs",
        description: "I want to review requirements, design, and tasks together."
      }
    ]
  }]
})
```

4. Once approved, begin implementation with **dual tracking:**
   - Use **TodoWrite tool** for in-session task tracking (temporary, fast)
   - Update **tasks document** after each task completion (permanent, detailed)

#### During Implementation: Live Document Updates

**CRITICAL:** The tasks document must be updated in real-time as work progresses:

1. **When Starting a Task:**
   - Mark status as `ðŸ”„ IN PROGRESS`
   - Add start timestamp
   - Update progress header to show current task
   - Example:
   ```markdown
   - [âš¡] **Task #4:** Build Profile component â±ï¸ 3h â† CURRENT
     - **Status:** ðŸ”„ IN PROGRESS (Started 2025-01-24 14:30)
   ```

2. **During Task Execution:**
   - Update progress bar if task has subtasks (e.g., `â–“â–“â–“â–“â–“â–‘â–‘â–‘â–‘â–‘ 50%`)
   - Check off completion criteria as they're met
   - Add notes about implementation decisions or discoveries
   - Document any blockers immediately
   - Example:
   ```markdown
   - **Completion Criteria:**
     - [x] Component scaffolding complete
     - [x] Props interface defined
     - [ ] Render logic implemented â† working on this
   - **Current Work:** Implementing form validation logic
   - **Blockers:** None
   ```

3. **When Completing a Task:**
   - Change status to `âœ… COMPLETED`
   - Add completion timestamp
   - Mark checkbox as `[x]`
   - Update progress header percentages
   - Add any final notes or learnings
   - Example:
   ```markdown
   - [x] **Task #4:** Build Profile component â±ï¸ 3h
     - **Status:** âœ… COMPLETED (2025-01-24 17:45)
     - **Notes:** Added additional loading state for better UX
   ```

4. **Update Progress Header:**
   ```markdown
   ðŸ“Š **Overall Progress:** â–“â–“â–“â–“â–“â–“â–“â–‘â–‘â–‘ 70% (7/10 tasks completed)
   ðŸ“ **Current Phase:** Core Functionality
   â±ï¸  **Last Updated:** 2025-01-24 17:45
   ðŸŽ¯ **Next Milestone:** Complete data layer (Task #8)
   ```

5. **When Blocked:**
   - Add blocker immediately to current task
   - Update status with warning icon
   - Example:
   ```markdown
   - [âš ï¸] **Task #5:** Add profile edit functionality
     - **Status:** â›” BLOCKED (2025-01-24 18:00)
     - **Blockers:**
       - Waiting for API endpoint deployment (Backend Team)
       - ETA: 2025-01-25 10:00
     - **Workaround:** Using mock data for development
   ```

#### Task Status Icons Reference

Use these visual indicators throughout the document:

- `[ ]` or `â³` = Pending (not started)
- `[âš¡]` or `ðŸ”„` = In Progress (currently working)
- `[x]` or `âœ…` = Completed (done)
- `[âš ï¸]` or `â›”` = Blocked (waiting on dependency)
- `[ðŸ’¡]` = Discovery (new task found during implementation)
- `[ðŸ”¥]` = High Priority
- `[ðŸ“Œ]` = Pinned (important reference)
- `[â­ï¸]` = Skipped (deferred to later)

#### Progress Visualization Guide

**Progress Bars:**
- Use `â–“` for completed portions
- Use `â–‘` for remaining portions
- Always show percentage: `â–“â–“â–“â–“â–“â–“â–‘â–‘â–‘â–‘ 60%`

**Phase Progress Example:**
```markdown
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Foundation      [â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆ] 100% (3/3) âœ“            â”‚
â”‚ Core Features   [â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–‘â–‘â–‘â–‘]  66% (2/3) â† IN PROGRESSâ”‚
â”‚ Polish & UX     [â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘]   0% (0/2)              â”‚
â”‚ Testing         [â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘]   0% (0/2)              â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

### Spec Mode Principles

- **Incremental:** Each phase builds on the previous with clear gates
- **Traceable:** Tasks â†’ Design â†’ Requirements form a clear chain
- **Testable:** Correctness properties map to acceptance criteria
- **Iterative:** Refine each document before moving forward
- **Collaborative:** Gates provide natural review and feedback points
- **Documented:** Creates lasting reference for future maintainers

### Spec Mode Best Practices

1. **Requirements Phase**
   - Focus on user value, not technical solutions
   - Include specific metrics for success
   - Get stakeholder alignment early

2. **Design Phase**
   - Map every requirement to design elements
   - Document why decisions were made
   - Consider edge cases and failure modes

3. **Tasks Phase**
   - Keep tasks atomic and independent where possible
   - Include testing tasks explicitly
   - Plan for incremental delivery

4. **Throughout All Phases**
   - Update documents as implementation reveals new information
   - Track decisions and rationale
   - Maintain bidirectional traceability

---

## VIBE MODE

When the user selects Vibe Mode, proceed with agile implementation:

### Workflow

1. **Quick Planning** (5 minutes)
   - Briefly understand the goal
   - Identify major components involved
   - Ask 1-2 clarifying questions if needed

2. **Rapid Implementation**
   - Jump straight into code
   - Make reasonable technical decisions on the fly
   - Use established patterns from the codebase
   - Focus on working code first, optimization later

3. **Iterative Refinement**
   - Get something working quickly
   - Show progress frequently
   - Adjust based on feedback
   - Refactor as you go if it improves clarity

4. **Minimal Documentation**
   - Code comments for complex logic only
   - No formal specification documents
   - Keep git commit messages descriptive

### When to Use Vibe Mode

- **Prototyping:** Testing ideas or proof of concepts
- **Small Features:** Simple, isolated changes
- **Bug Fixes:** Addressing specific issues
- **Urgent Work:** Time-critical implementations
- **Solo Development:** Working alone without handoff needs
- **Experimental Work:** Trying new approaches

### Vibe Mode Principles

- **Speed over perfection:** Ship working code quickly
- **Iterate rapidly:** Make changes based on real usage
- **Stay flexible:** Adapt to discoveries during implementation
- **Trust instincts:** Leverage experience for quick decisions
- **Keep it simple:** Avoid over-engineering

### Vibe Mode Best Practices

1. **Still write tests** for critical logic
2. **Follow existing patterns** in the codebase
3. **Ask quick questions** rather than making wrong assumptions
4. **Commit frequently** with descriptive messages
5. **Refactor obvious issues** as you encounter them

### Transitioning from Vibe to Spec

If a Vibe Mode feature grows in complexity, suggest transitioning to Spec Mode:

```javascript
AskUserQuestion({
  questions: [{
    question: "This feature has grown complex. Would you like to formalize the approach?",
    header: "Mode Switch",
    multiSelect: false,
    options: [
      {
        label: "Switch to Spec Mode",
        description: "Create formal requirements and design docs for remaining work."
      },
      {
        label: "Continue in Vibe Mode",
        description: "Keep iterating quickly with minimal planning."
      }
    ]
  }]
})
```

---

## Mode Comparison Summary

| Aspect | Spec Mode | Vibe Mode |
|--------|-----------|-----------|
| **Planning Time** | Hours to days | Minutes |
| **Documentation** | Comprehensive (3 documents) | Minimal (code comments) |
| **Best For** | Complex, high-risk features | Simple, low-risk changes |
| **Team Size** | Multiple developers | Solo developer |
| **Flexibility** | Structured phases | Highly flexible |
| **Traceability** | Full requirement tracing | Git history |
| **Review Points** | 3 formal gates | Continuous informal review |
| **Time to First Code** | After 3 approvals | Immediate |

---

## Appendix: Example Questions & Prompts

### Mode Selection Examples

**For Complex Features:**
> "This looks like a substantial feature touching authentication and data models. I recommend Spec Mode for proper planning. Which mode would you prefer?"

**For Simple Changes:**
> "This is a straightforward UI update. Vibe Mode would get this done quickly. Which mode works for you?"

**For Unclear Scope:**
> "I'm not sure of the full scope yet. Spec Mode would help us explore requirements, or we could prototype in Vibe Mode. What's your preference?"

### Phase Gate Examples

**Requirements Approval:**
> "I've documented 5 user stories with acceptance criteria, plus performance and accessibility requirements. Please review docs/requirements/user-profile.md. Ready to move to design?"

**Design Approval:**
> "The design includes a new ProfileService, 3 React components, and updates to the User data model. All acceptance criteria are mapped to correctness properties. Review docs/design/user-profile.md?"

**Tasks Approval:**
> "I've broken this into 12 tasks ordered by dependency. Each task should take 2-3 hours. The full breakdown is in docs/tasks/user-profile.md. Ready to start?"

### Mid-Implementation Questions

**Discovering New Requirements:**
> "While implementing, I discovered we need to handle social login providers. Should I update the requirements doc, or handle this as a follow-up task?"

**Technical Blockers:**
> "Task #5 is blocked by a missing API endpoint. Should we implement that first, or mock it for now?"

**Scope Creep:**
> "This could also include email verification, but that wasn't in the original requirements. Add to scope, or create a separate feature?"

---

## Document Templates

### Requirements Template

```markdown
# [Feature Name] - Requirements

**Document Status:** Draft | In Review | Approved
**Last Updated:** YYYY-MM-DD
**Owner:** [Name]

## Overview
[Brief description and business value]

## User Stories
1. As a [user], I want [goal], so that [benefit]
   - Priority: Must Have | Should Have | Nice to Have

## Acceptance Criteria
- [ ] Given [context], when [action], then [outcome]
- [ ] [Specific testable condition]

## Non-functional Requirements
- **Performance:** [Targets]
- **Security:** [Requirements]
- **Accessibility:** [Standards]

## Out of Scope
- [Explicitly excluded items]

## Dependencies
- [Required systems/APIs]
```

### Design Template

```markdown
# [Feature Name] - Design

**Document Status:** Draft | In Review | Approved
**Last Updated:** YYYY-MM-DD
**Owner:** [Name]
**Requirements:** [Link to requirements doc]

## Architecture Overview
[High-level approach]

## Component Design
[Key modules and relationships]

## Data Models
```typescript
interface Example {
  // ...
}
```

## Correctness Properties
- Requirement X â†’ Property Y: [How to verify]

## Technical Decisions
- **Decision:** [Choice made]
- **Rationale:** [Why]
- **Alternatives:** [What else was considered]
```

### Tasks Template

```markdown
# [Feature Name] - Tasks

**Document Status:** In Progress
**Last Updated:** YYYY-MM-DD HH:MM
**Requirements:** [Link to docs/requirements/feature-name.md]
**Design:** [Link to docs/design/feature-name.md]

---

## Progress Overview

ðŸ“Š **Overall Progress:** â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘ 0% (0/10 tasks completed)

ðŸ“ **Current Phase:** Not Started
â±ï¸  **Last Updated:** YYYY-MM-DD HH:MM
ðŸŽ¯ **Next Milestone:** Complete Foundation Phase (Tasks #1-3)

### Phase Breakdown
```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Foundation      [â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘]   0% (0/3)              â”‚
â”‚ Core Features   [â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘]   0% (0/4)              â”‚
â”‚ Polish & UX     [â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘]   0% (0/2)              â”‚
â”‚ Testing         [â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘]   0% (0/1)              â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## Task Dependency Graph

Task #1 â”€â”€â”¬â”€â”€> Task #4 â”€â”€> Task #5
          â”‚
Task #2 â”€â”€â”¤â”€â”€> Task #6 â”€â”€> Task #7
          â”‚
Task #3 â”€â”€â”´â”€â”€> Task #8 â”€â”€> Task #9 â”€â”€> Task #10

---

## Tasks

### ðŸ—ï¸ Foundation Phase

- [ ] **Task #1:** [Brief description] â±ï¸ Xh
  - **Status:** â³ PENDING
  - **Addresses:** Requirement X.X, Design Section Y.Y
  - **Dependencies:** None
  - **Files:** `path/to/file.ts`
  - **Completion Criteria:**
    - [ ] Specific testable outcome
    - [ ] Tests pass
    - [ ] Code reviewed

- [ ] **Task #2:** [Brief description] â±ï¸ Xh
  - **Status:** â³ PENDING
  - **Addresses:** Requirement X.X
  - **Dependencies:** None
  - **Files:** `path/to/another.ts`
  - **Completion Criteria:**
    - [ ] Specific outcome

- [ ] **Task #3:** [Brief description] â±ï¸ Xh
  - **Status:** â³ PENDING
  - **Addresses:** Design Section Y.Y
  - **Dependencies:** Task #1, Task #2
  - **Files:** `path/to/service.ts`
  - **Completion Criteria:**
    - [ ] Service implemented
    - [ ] Unit tests written and passing

### âš™ï¸ Core Features Phase

- [ ] **Task #4:** [Brief description] â±ï¸ Xh
  - **Status:** â³ PENDING
  - **Addresses:** Requirement X.X, Design Section Y.Y
  - **Dependencies:** Task #1
  - **Files:** `path/to/component.tsx`
  - **Completion Criteria:**
    - [ ] Component renders correctly
    - [ ] Props validated
    - [ ] Accessibility tested

- [ ] **Task #5:** [Brief description] â±ï¸ Xh
  - **Status:** â³ PENDING
  - **Addresses:** Requirement X.X
  - **Dependencies:** Task #4
  - **Files:** `path/to/feature.tsx`
  - **Completion Criteria:**
    - [ ] Feature functional
    - [ ] Edge cases handled

### âœ¨ Polish & UX Phase

- [ ] **Task #6:** [Brief description] â±ï¸ Xh
  - **Status:** â³ PENDING
  - **Addresses:** Design Section Y.Y
  - **Dependencies:** Task #5
  - **Files:** `path/to/styles.ts`
  - **Completion Criteria:**
    - [ ] Animations smooth
    - [ ] Responsive design verified

### ðŸ§ª Testing Phase

- [ ] **Task #7:** [Brief description] â±ï¸ Xh
  - **Status:** â³ PENDING
  - **Addresses:** All Requirements
  - **Dependencies:** All previous tasks
  - **Files:** `__tests__/feature.test.ts`
  - **Completion Criteria:**
    - [ ] E2E tests passing
    - [ ] Code coverage > 80%

---

## Change Log

### YYYY-MM-DD HH:MM
- Initial task breakdown created
- 10 tasks identified across 4 phases

<!-- Updates will be added here as tasks progress -->

---

## Notes & Discoveries

<!-- Add implementation notes, discoveries, and decisions made during development -->
```

---