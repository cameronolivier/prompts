# Code Rules

Guiding factors, not laws. Use judgment based on context.

- **Rule** — must follow. Flag deviations (auto-fix when safe).
- **Pattern** — should follow. Reasonable deviation allowed; flag for a human call.

> Set `boyscout: off` here to disable automatic boyscouting in this repo.
> Edit this file freely — it is the living standard for this project. Re-run
> `boyscout init` any time to regenerate it through the interview.

---

## Paradigm

**Functional-first, but codebase-respecting.**

- **Rule** — Match the paradigm already in the file/module. Never convert OO→FP
  (or the reverse) opportunistically. Consistency with the surrounding code beats
  paradigm purity. In an OO codebase (or an OO-leaning language like Python),
  apply OO best practices well: single-responsibility classes, encapsulation,
  composition over inheritance, no god objects.
- **Pattern** — Where the code is greenfield or already functional, prefer
  functional style: small pure functions, immutability, composition, side-effects
  pushed to the edges, declarative transforms over imperative loops where clearer.

---

## Principles

### Modularity (Rule)

Break systems into modules with clear boundaries. Each module independently
testable behind a well-defined interface.

### Cohesion (Rule)

Each module has a single, focused purpose. If you can't describe it in one
sentence, it's doing too much. No grab-bag utility files.

### Information Hiding (Pattern)

Expose behavior, hide implementation. Consumers shouldn't know which third-party
service is used internally. Don't pass implementation-specific clients as params.

### Loose Coupling (Pattern)

A few well-designed dependencies beat many hidden ones. Make temporal
dependencies explicit; use well-defined interfaces for shared data.

### Immutability (Rule)

Prefer `filter`/`map`/`reduce` over loops with mutation. Spread for updates.
Never mutate function arguments.

```typescript
// ❌ mutation
const results: Item[] = [];
items.forEach((item) => { if (item.isValid) results.push(process(item)); });

// ✅ functional transform
const results = items.filter((item) => item.isValid).map(process);
```

### Early Returns (Pattern)

Guard clauses over deep nesting. One-liner ternaries fine; nested ternaries not.

```typescript
// ✅ guard clauses
const processData = (data: Data) => {
  if (!data) return null;
  if (!data.isValid) return null;
  return result;
};
```

### Precision (Rule)

In **feature work**, change only what is necessary — no opportunistic refactoring.
(Boyscout is the sanctioned exception: a separate cleanup pass, scoped to
just-touched files. It honours the spirit by staying small and in-scope.)

### Naming (Rule)

Meaningful, intent-revealing names. A good name removes the need for a comment.

### Comments (Rule)

Comments explain **why**, never **what**. If a comment explains what code does,
make the code clearer instead. (Detailed comment triage → `comment-triage`.)

---

## Pragmatic Programmer

- **No Broken Windows (Rule)** — Fix small rot the moment you're in the file.
  Don't leave bad code "to fix later." This is the boyscout ethos.
- **DRY (Rule)** — Every piece of knowledge has a single, authoritative
  representation. Eliminate duplicated knowledge (not merely duplicated text).
- **Orthogonality (Pattern)** — Decoupled, independent components. A change in one
  place shouldn't ripple unpredictably.
- **Reversibility (Pattern)** — Avoid one-way decisions baked into many call sites.
- **No fake stubs (Rule)** — Don't leave placeholder/dead scaffolding behind.

---

## Functions

### Size & Responsibility (Pattern)

Small, single-purpose functions. Flag functions over ~40 lines or with mixed
responsibilities as extraction candidates.

### Organization (Pattern)

Order within a file: imports → types → exported (public) functions → private
functions in call order.

### Parameters (Pattern)

1–2 params: positional is fine. 3+ params: destructured object with a typed
`Params` interface.

---

<!-- ─────────────────────────────────────────────────────────────────────────
     OPTIONAL: TypeScript / React / tRPC section.
     Delete this whole block if the project is not a TS/tRPC/Next codebase.
     ───────────────────────────────────────────────────────────────────────── -->

## Type Safety (TypeScript)

- **Rule** — `import type` for type-only imports.
- **Rule** — `unknown` + schema validation instead of `any` or `as` casting.
- **Exception** — `any` acceptable in test files with an eslint-disable comment.

## Naming Conventions (TypeScript / tRPC)

- **Folders (Rule)** — entity-first camelCase: `postCreate`, `postGetById`.
  Each API operation in its own folder (`handler.ts`, `route.ts`, `index.ts`,
  `types.ts`).
- **Handlers (Pattern)** — verb-first: `createCommunityPost`, `getPostById`.
- **Routes (Pattern)** — `{operation}Route`: `createCommunityPostRoute`.
- **Types (Pattern)** — PascalCase with suffixes: `Params` (handler input),
  `Result` (handler return), `Response` (route return), `Data` (internal),
  `Filters` (list/query).
- **Validators (Pattern)** — camelCase `Validator` suffix; derive request types
  with `z.infer`.
- **Enums (Pattern)** — values array + derived type in the validators package:
  `const StatusValues = [...] as const; type Status = (typeof StatusValues)[number];`
- **Constants (Pattern)** — `UPPER_SNAKE_CASE`.

<!-- ───────────────────────────── end optional block ───────────────────────── -->
