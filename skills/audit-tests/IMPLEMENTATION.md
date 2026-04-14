# Test Implementation Guide

Best practices for writing tests during the implementation phase.

## General Principles

### Write Behaviour Tests

```typescript
// Bad — tests implementation
it('calls calculateTotal with items', () => {
  const spy = vi.spyOn(service, 'calculateTotal')
  processOrder(items)
  expect(spy).toHaveBeenCalledWith(items)
})

// Good — tests behaviour
it('returns correct total for order with multiple items', () => {
  const result = processOrder([
    { price: 10, qty: 2 },
    { price: 5, qty: 1 },
  ])
  expect(result.total).toBe(25)
})
```

### Use Table-Driven Tests

For logic with multiple cases, parameterize:

```typescript
it.each([
  { input: '', expected: false },
  { input: 'a@b.com', expected: true },
  { input: 'no-at-sign', expected: false },
  { input: 'a@b', expected: false },
])('validates email "$input" → $expected', ({ input, expected }) => {
  expect(isValidEmail(input)).toBe(expected)
})
```

### Use Factories, Not Fixtures

```typescript
const createUser = (overrides: Partial<User> = {}): User => ({
  id: 'user_1',
  email: 'test@example.com',
  role: 'member',
  isActive: true,
  ...overrides,
})

// Usage — only specify what matters for this test
const admin = createUser({ role: 'admin' })
const inactive = createUser({ isActive: false })
```

### One Assertion Cluster Per Test

Multiple assertions are fine if they describe the same behaviour:

```typescript
// Good — one behaviour, multiple aspects
it('creates project and returns it with metadata', async () => {
  const result = await createProject({ name: 'Test' })
  expect(result.status).toBe(201)
  expect(result.body.name).toBe('Test')
  expect(result.body.id).toBeDefined()
  expect(result.body.createdAt).toBeDefined()
})
```

### Name Tests Like Requirements

```typescript
// Good
describe('when the user is not authorized', () => {
  it('returns 403 and does not modify the resource', ...)
  it('logs the unauthorized access attempt', ...)
})

// Bad
describe('auth', () => {
  it('works', ...)
  it('test 2', ...)
})
```

## Mock Discipline

### Mock at Boundaries Only

```typescript
// Good — mocking an external HTTP call
vi.mock('./stripe-client', () => ({
  chargeCard: vi.fn().mockResolvedValue({ id: 'ch_123', status: 'succeeded' }),
}))

// Bad — mocking an internal utility
vi.mock('./utils/formatPrice') // just use the real function
```

### Control Time

```typescript
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2024-01-15T10:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})
```

### Typed Mocks

Keep mocks type-safe. Use framework helpers:

```typescript
// Vitest
const mockFetch = vi.fn<typeof fetch>()

// Jest
const mockFetch = jest.fn<typeof fetch>()
```

## Failure Path Patterns

### Test Error Responses

```typescript
it('returns 400 when name is empty', async () => {
  const res = await request.post('/projects').send({ name: '' })
  expect(res.status).toBe(400)
  expect(res.body.error).toMatch(/name.*required/i)
})
```

### Test Auth Boundaries

```typescript
it('rejects access from another tenant', async () => {
  const project = await createProject({ tenantId: 'tenant_1' })
  const res = await request
    .get(`/projects/${project.id}`)
    .set('Authorization', tokenFor('tenant_2'))
  expect(res.status).toBe(403)
})
```

### Test Idempotency

```typescript
it('handles duplicate webhook delivery', async () => {
  const event = createWebhookEvent({ id: 'evt_1' })
  await handleWebhook(event)
  await handleWebhook(event) // duplicate
  const records = await db.query('SELECT * FROM payments WHERE event_id = $1', ['evt_1'])
  expect(records).toHaveLength(1) // not duplicated
})
```

## Component Test Patterns (Testing Library)

### Test Through the User Surface

```typescript
it('shows validation error when submitting empty form', async () => {
  render(<CreateProjectForm />)
  await userEvent.click(screen.getByRole('button', { name: /create/i }))
  expect(screen.getByRole('alert')).toHaveTextContent(/name is required/i)
})
```

### Prefer Accessible Selectors

Priority order:
1. `getByRole` — most accessible, most stable
2. `getByLabelText` — for form fields
3. `getByText` — for visible text
4. `getByTestId` — fallback for complex UIs

### Test Keyboard Interaction

```typescript
it('closes dialog on Escape', async () => {
  render(<ConfirmDialog open />)
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
```

## Integration Test Patterns

### Test at the HTTP Boundary

```typescript
describe('POST /api/projects', () => {
  it('creates project and persists to database', async () => {
    const res = await request
      .post('/api/projects')
      .set('Authorization', validToken)
      .send({ name: 'New Project' })

    expect(res.status).toBe(201)

    // Verify persistence — don't trust just the response
    const saved = await db.query('SELECT * FROM projects WHERE id = $1', [res.body.id])
    expect(saved[0].name).toBe('New Project')
  })
})
```

### Reset State Between Tests

```typescript
beforeEach(async () => {
  await db.query('BEGIN')
})

afterEach(async () => {
  await db.query('ROLLBACK')
})
```

## Structuring New Test Files

When creating a new test file:

1. **Match project conventions** for filename and location
2. **Import the module under test** and its dependencies
3. **Group by behaviour** using `describe` blocks
4. **Order:** happy path first, then edge cases, then failure paths
5. **Setup:** shared setup in `beforeEach`, test-specific setup inline

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { processOrder } from './process-order'

describe('processOrder', () => {
  describe('when order is valid', () => {
    it('calculates total correctly', () => { ... })
    it('applies discount for VIP customers', () => { ... })
  })

  describe('edge cases', () => {
    it('handles empty item list', () => { ... })
    it('rounds currency to 2 decimal places', () => { ... })
  })

  describe('when order is invalid', () => {
    it('rejects negative quantities', () => { ... })
    it('rejects items with zero price', () => { ... })
  })
})
```
