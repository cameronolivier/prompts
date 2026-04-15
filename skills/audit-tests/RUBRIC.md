# Test Quality Rubric

Evaluation criteria for the audit. Assess each test file against these dimensions.

## Core Dimensions

### 1. Behaviour Focus

Tests should verify what the system does, not how.

**Good signals:**
- Input → output assertions
- State transitions
- API contract validation
- UI effects visible to user
- Persisted data shape

**Red flags:**
- Asserting private/internal method calls
- Asserting exact call order unless order matters
- Giant snapshot tests
- Mocking everything until nothing real is tested

### 2. Failure Path Coverage

Production quality is defined by failure behaviour, not happy path.

**Check for:**
- Error handling tested (upstream timeout, constraint violation, invalid input)
- Auth/permission failures tested explicitly
- Partial failure scenarios
- Retry/fallback paths
- Stale state handling
- Duplicate request handling (idempotency)

**Critical gap if:** only happy path is tested for business-critical code.

### 3. Edge Cases & Boundaries

**Check for:**
- null/undefined handling
- Empty inputs (empty string, empty array, zero)
- Boundary values (off-by-one, limits, thresholds)
- Duplicates
- Invalid state transitions
- Timezone/date edge cases
- Numeric rounding/precision
- Partial data / optional fields

### 4. Assertion Quality

**Good signals:**
- Specific value assertions (`toBe`, `toEqual` with expected value)
- Error type and message assertions
- Structure assertions for complex objects
- Multiple assertions describing same behaviour in one test

**Red flags:**
- `toBeTruthy()` / `toBeDefined()` when value matters
- No assertions at all (test "passes" by not throwing)
- Asserting too much (entire object when one field matters)
- Snapshot overuse for dynamic data

### 5. Test Isolation & Determinism

**Check for:**
- No shared mutable state between tests
- No test order dependence
- Time controlled (fake timers or injected clock)
- Randomness controlled (seeded or deterministic)
- Network mocked/stubbed at boundaries
- Environment variables controlled
- Database state reset between tests
- Async properly awaited

**Critical gap if:** tests can produce different results on re-run.

### 6. Mock Discipline

**Mock at real boundaries:**
- Network calls
- Filesystem
- External service APIs (Stripe, email, S3)
- Current time
- Randomness

**Don't mock:**
- Internal collaborators (unless truly necessary)
- Database in integration tests (use real DB)
- The subject under test itself

**Red flags:**
- Mocking so much the test proves nothing
- Mock implementations that drift from real behaviour
- Mocking to avoid fixing the real code

### 7. Conciseness & Signal

Tests should be lean. Every test should earn its place.

**Good signals:**
- Table-driven / parameterized tests for multiple cases of same logic
- Focused setup (only what's needed for this test)
- Clear arrange/act/assert structure
- One behavioural assertion cluster per test
- Factories over verbose fixture objects

**Red flags:**
- Copy-paste test blocks with minor variations (should be parameterized)
- Giant setup for simple assertions
- Tests that duplicate other tests
- Testing trivial pass-through wrappers
- Testing implementation details that the type system already guarantees

### 8. Naming & Readability

Tests should read as executable specifications.

**Good:** `rejects updates from users outside the tenant`
**Bad:** `test project`, `works`, `should be true`

**Check for:**
- Describe blocks mirror business meaning, not file internals
- Test names describe behaviour, not implementation
- Setup is understandable without reading the full file

### 9. Appropriate Test Level

Each test should live at the right level of the pyramid.

**Unit tests for:** pure logic, validation, transformations, reducers, permission functions, formatting/parsing
**Integration tests for:** API routes + DB, auth + authorization, service + persistence, job handlers
**Component tests for:** rendered output, user interactions, callback effects, accessibility
**E2E tests for:** critical user journeys only (login, checkout, onboarding, core CRUD)

**Red flags:**
- E2E testing what a unit test could catch
- Unit testing what needs a real database
- No integration tests at all (unit + E2E gap)

### 10. Domain-Critical Coverage

Certain areas demand explicit testing regardless of other coverage.

**Always test:**
- Auth and permissions
- Money/billing calculations
- Data deletion/destruction
- Tenant isolation (multi-tenant systems)
- Data transformation at boundaries (API input/output, serialization)
- Public API contracts
- Migration/schema changes

**Critical gap if:** any of these areas are changed in the branch but untested.

## Anti-Patterns Checklist

Flag if present:

| Anti-Pattern | Why It's Bad |
|-------------|-------------|
| Too many mocks | Testing a fake world |
| Giant snapshots | Noisy, lazy, brittle |
| Implementation detail assertions | Blocks refactoring |
| Shared fixture state | Order dependence, flaky |
| Arbitrary sleeps (`waitForTimeout`) | Flaky, slow |
| No failure path tests | False confidence |
| Coverage worship (high % but weak assertions) | Low-value tests |
| Tests with unclear purpose | Maintenance burden |
| Asserting incidental formatting/text | Brittle |
| `any` type in test code | Hides bugs |

## Frontend-Specific Checks

When auditing React/UI tests:

- **Prefer Testing Library patterns** — test through the user-visible surface
- **Accessible selectors** — role, label, text over CSS classes or DOM structure
- **Test ids as fallback** — `data-testid` for complex UIs when accessible selectors aren't stable
- **No component internals** — don't test hook state directly (unless testing a custom hook)
- **Accessibility basics** — roles, labels, keyboard interaction, focus management, error association

## Backend/API-Specific Checks

When auditing API/service tests:

- **HTTP boundary tests** — status codes, auth, validation, response contracts
- **Persistence side effects** — verify DB writes, not just response
- **Idempotency** — especially for webhooks, payment callbacks, queue consumers
- **Contract testing** — response shape matches what consumers expect
- **Factories over fixtures** — typed builders with overrides, not static JSON blobs
