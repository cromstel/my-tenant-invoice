# Testing Strategy

> Four-tiered automated pyramid + manual gates. Objective: 80%+ line coverage for domain logic, zero regressions on critical paths per release.

---

## 1. Test Pyramid

```
┌──────────────────────────────────────┐
│           ▲  Manual QA (pre-release) │  1-2 days per release
│           │  10 exploratory sessions │  + UAT with 2 enterprise clients
│     E2E  ─┤  40 Playwright flows     │  10-15 min (sharding x6)
│     Int  ─┤  120 integration specs   │  4-6 min  (testcontainers)
│    Unit  ─┤  600+ unit specs         │  45-90 s
│    Lint  ─┤  typecheck + biome       │  <30 s
└──────────┴───────────────────────────┘
```

### 1.1 Coverage Gate

| Tier               | Minimum Coverage  | Measured on                |
|--------------------|-------------------|----------------------------|
| `lib/billing/*`    | 95% line          | All tariff, invoice math   |
| `lib/payments/*`   | 90% line          | Provider adapters + guards |
| `lib/auth/*`       | 90% line          | Session, RBAC, crypto      |
| `lib/db/*` repos   | 75% line          | Query logic (not SQL driver) |
| `components/*`     | 40% line          | Form + state components    |
| **Weighted total** | **≥ 80%**         | CI gate on every PR        |

```yaml
# .github/workflows/ci.yml — coverage gate
- name: Coverage threshold
  run: pnpm coverage:check
```

```jsonc
// package.json (vitest coverage)
{
  "scripts": {
    "coverage:check": "vitest run --coverage --coverage.100=false --coverage.thresholds.lines=80 --coverage.thresholds.functions=80 --coverage.thresholds.branches=75"
  }
}
```

---

## 2. Tier Responsibilities

### 2.1 Static Checks (Fastest)

| Check              | Tool            | CI Runs On   | Time Budget |
|--------------------|-----------------|--------------|-------------|
| Formatting         | biome format    | every commit | 5 s         |
| Lint rules         | biome lint      | every commit | 15 s        |
| TS strict          | tsc --noEmit    | every commit | 25 s        |
| Dep audit          | pnpm audit      | daily        | 10 s        |
| Licence check      | license-checker | weekly       | 5 s         |
| Spellcheck (docs)  | cspell          | every PR     | 5 s         |

### 2.2 Unit Tests — `tests/unit/**`

Scope: pure logic. No network, no DB, no filesystem.

- Tariff + tax calculators
- Invoice numbering, prorating, discounts
- Validation schemas (zod)
- React components via `@testing-library/react` for complex state (forms, wizard steps)
- Error mapping, idempotency helpers

### 2.3 Integration Tests — `tests/integration/**`

Scope: real MySQL (testcontainers) + real Redis + service layer together. No HTTP server.

- Full invoice lifecycle (create → send → pay → refund)
- Organization + membership RBAC
- Webhook idempotency (Stripe `payment_intent.succeeded`)
- Numbering uniqueness under concurrency
- Bulk invoice generation correctness

### 2.4 End-to-End Tests — `tests/e2e/**`

Scope: running Next.js app, browser automation (Playwright) against a seeded, isolated DB.

- Register org → onboarding → create invoice → pay via Stripe test mode
- Tenant switcher, role visibility gating
- Password reset flow via Mailpit SMTP capture
- Portal invoice view + Pay Now button with Stripe test card

### 2.5 Manual / UAT

Scope: UX, cross-browser, complex edge scenarios.

- Safari on iPhone 14 + latest macOS Safari (WebKit quirks)
- NVDA screen reader audit of billing flows
- 2 enterprise tenant UAT sign-off before each minor release
- Release notes reviewed by product + compliance

---

## 3. When to Write Which

| Scenario                                | Tier         |
|-----------------------------------------|--------------|
| Fix bug                                 | **Unit** test to reproduce + prevent regression |
| Add tariff rule / discount              | **Unit** with full matrix + **Integration** for end-to-end totals |
| Add new DB table / query                | **Integration** only (no unit needed on raw SQL) |
| Add new page / UI flow                  | **E2E** for happy path + smoke + **Unit** for any complex components |
| Payment webhook                         | **Integration** with Stripe signature + **Unit** on signature validator |
| Role / permission change                | **Integration** matrix across roles + **E2E** smoke for two most-permissive / restrictive roles |
| Performance-sensitive code path         | **Unit benchmark** in `tests/bench/` + **Perf test** (§6) |

---

## 4. CI Pipeline

```yaml
# .github/workflows/ci.yml
name: CI
on: [pull_request, push]
jobs:
  static:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm biome ci .
      - run: pnpm typecheck
      - run: pnpm --silent licenses:check

  unit:
    needs: static
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm vitest run --coverage tests/unit

  integration:
    needs: static
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - uses: docker/setup-buildx-action@v3   # for testcontainers
      - run: pnpm install --frozen-lockfile
      - run: pnpm vitest run tests/integration

  e2e:
    needs: [unit, integration]
    runs-on: ubuntu-latest
    timeout-minutes: 25
    strategy:
      fail-fast: false
      matrix:
        shard: [1,2,3,4,5,6]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm playwright install chromium --with-deps
      - run: pnpm docker:up
      - run: pnpm docker:wait
      - run: pnpm db:migrate
      - run: pnpm db:seed
      - run: pnpm next build
      - run: |
          pnpm next start -p 3001 &
          npx wait-on http://localhost:3001
      - run: pnpm playwright test --shard=${{ matrix.shard }}/6

  security:
    needs: static
    uses: ./.github/workflows/security.yml
    secrets: inherit
```

---

## 5. Flaky Test Policy

A test is "flaky" if it fails twice on `main` in 24 hours without a real code change.

1. Immediately quarantine the spec with `test.skipIf(process.env.CI)` + open `TBI-???` ticket.
2. Assigned owner fixes within 1 week. Flaky tests on `main` are treated as P1 bugs.
3. Root cause must be documented in commit message. Common flake sources:
   - Real clock timers → use `vi.useFakeTimers()` or clock locks.
   - Auto-increment IDs in assertions → compare shape, not literal numeric IDs.
   - Race on async writes → `waitFor()` with explicit conditions in Playwright.
   - Shared Redis keys → namespace by test worker id: `key:vitest:${process.env.VITEST_POOL_ID}:foo`.

---

## 6. Bug Fix Discipline

Every bug fix PR must contain:

1. A **new test** that fails without the fix (shows reproduction).
2. The minimal code change to make it pass.
3. A comment linking the test to the Jira ticket ID.

```ts
it("TBI-456 overdue cron skips invoices with NULL due_date", () => {
  // https://linear.app/cromstel/issue/TBI-456
  expect(runOverdueCron([{ dueDate: null }])).toEqual([]);
});
```
