# Performance Testing

> Lighthouse budgets · k6 load tests · Vitest micro-benchmarks · DB query plan checks.

---

## 1. Performance Budgets

### 1.1 Web Vitals — Lighthouse CI

| Metric               | Budget (p75)       | Scope                    |
|----------------------|--------------------|--------------------------|
| LCP (Largest Contentful Paint) | < 2.0 s     | Marketing `/`, `/pricing`|
| LCP                  | < 1.5 s            | Platform `/dashboard`    |
| FID / INP            | < 200 ms           | All routes               |
| CLS                  | < 0.10             | All routes               |
| TTFB                 | < 600 ms           | All SSR routes           |
| First- party JS      | < 300 KB (gzip)    | Initial bundle           |
| CSS (Tailwind)       | < 40 KB (gzip)     | Initial bundle           |
| Total image weight   | < 500 KB           | Marketing hero section   |

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI
on: [pull_request]
jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm docker:up && pnpm docker:wait && pnpm db:migrate && pnpm db:seed
      - run: pnpm next build
      - run: |
          pnpm next start -p 3001 &
          npx wait-on http://127.0.0.1:3001
      - name: Lighthouse CI
        run: |
          npx @lhci/cli@0.14 autorun \
            --collect.url=http://127.0.0.1:3001/ \
            --collect.url=http://127.0.0.1:3001/pricing \
            --collect.url=http://127.0.0.1:3001/login \
            --collect.settings.preset="desktop" \
            --collect.numberOfRuns=5 \
            --upload.target=temporary-public-storage \
            --assert.preset="lighthouse:recommended" \
            --assert.budgetsFile=.lighthouse/budgets.json
```

```jsonc
// .lighthouse/budgets.json
[
  {
    "path": "/*",
    "timings": [
      { "metric": "largest-contentful-paint", "budget": 2000 },
      { "metric": "interactive",              "budget": 3500 },
      { "metric": "total-blocking-time",      "budget": 250  },
      { "metric": "cumulative-layout-shift",  "budget": 0.1  }
    ],
    "resourceSizes": [
      { "resourceType": "script",             "budget": 300 },
      { "resourceType": "stylesheet",         "budget": 40  },
      { "resourceType": "image",              "budget": 500 },
      { "resourceType": "document",           "budget": 40  }
    ],
    "resourceCounts": [
      { "resourceType": "total",              "budget": 90  }
    ]
  }
]
```

---

## 2. Load Testing (k6)

### 2.1 Scenarios

| Scenario                   | VUs  | Duration | Target                               | SLA                         |
|----------------------------|------|----------|--------------------------------------|-----------------------------|
| Platform smoke             | 50   | 5 min    | Mixed read-only platform routes      | p95 < 500 ms, 0% HTTP 5xx   |
| Invoice batch generation   | 20   | 10 min   | `POST /invoices` (authed)            | p95 < 1.2 s, 0% 5xx         |
| Portal invoice + pay       | 100  | 5 min    | Public portal routes + Stripe test   | p95 < 800 ms, <0.1% error   |
| Endurance                  | 200  | 60 min   | Full workload mix                    | 0% memory growth, 0 OOM     |

### 2.2 Smoke Script

```javascript
// tests/perf/k6-platform-smoke.js
import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";
import { Rate } from "k6/metrics";

const errorRate = new Rate("errors");

const token = __ENV.AUTH_TOKEN || (() => {
  throw new Error("Provide AUTH_TOKEN via env var (run scripts/auth-token.mjs)");
})();

const orgSlugs = new SharedArray("orgs", () => [
  "acme-property-group", "cromstel-commercial",
]);

export const options = {
  stages: [
    { duration: "30s", target: 10 },
    { duration: "1m",  target: 50 },
    { duration: "30s", target: 50 },
    { duration: "1m",  target: 0  },
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed:   ["rate<0.001"],
    errors:            ["rate<0.01"],
  },
};

export default function () {
  const params = {
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    tags: {},
  };

  const org = orgSlugs[Math.floor(Math.random() * orgSlugs.length)];
  const responses = http.batch([
    ["GET",  `${__ENV.BASE_URL}/api/trpc/invoice.list?batch=1&input=${encodeURIComponent(JSON.stringify({"0":{"json":{"limit":25,"offset":0}}}))}`, null, params],
    ["GET",  `${__ENV.BASE_URL}/api/trpc/dashboard.kpis?batch=1`, null, params],
    ["GET",  `${__ENV.BASE_URL}/api/trpc/customer.list?batch=1`, null, params],
  ]);

  for (const r of responses) {
    const ok = check(r, {
      "status is 200": (r) => r.status === 200,
      "body is JSON":  (r) => /^\{/.test(r.body || ""),
    });
    errorRate.add(!ok);
  }
  sleep(1 + Math.random() * 2);
}
```

### 2.3 Running

```bash
# Get a long-lived dev JWT for perf test service account
AUTH_TOKEN=$(node scripts/auth-token.mjs perf@cromstel.test Testpass1!)

k6 run -e BASE_URL=http://127.0.0.1:3001 -e AUTH_TOKEN=$AUTH_TOKEN \
  tests/perf/k6-platform-smoke.js
```

---

## 3. Micro-Benchmarks (Vitest)

```ts
// tests/bench/tariff.bench.ts
import { describe, bench } from "vitest";
import { TariffCalculator } from "@/lib/billing/tariff-calculator";
import { mkTariff } from "./_fixtures/tariffs";

describe("TariffCalculator hot path", () => {
  const calc = new TariffCalculator();
  const tiered = mkTariff("complex-tiered");

  bench("computeMonthly — tiered 500 units", () => {
    calc.computeMonthly(tiered, 500);
  }, { iterations: 50_000 });

  bench("computeProrated — 12 month batch", () => {
    for (let i = 0; i < 12; i++) {
      calc.computeProrated(tiered, 120, {
        cycleStart: new Date(2026, i, 1),
        cycleEnd:   new Date(2026, i + 1, 0),
        start:      new Date(2026, i, 1 + (i % 15)),
      });
    }
  }, { iterations: 10_000 });
});
```

Expected baselines (AMD Ryzen 9 7900, Node 20):

| Benchmark                       | Target (median) |
|---------------------------------|-----------------|
| `computeMonthly` single call    | < 600 ns        |
| `computeProrated` 12-month batch | < 12 μs        |

Fail the build if regressed >20%:

```bash
pnpm vitest bench tests/bench --run
```

---

## 4. DB Query Performance Checks

Every new query in `lib/db/repos/*` is required to have a plan check in its PR description. Template:

```
## Query plan — find invoices by (orgId, status, due_date range)

```sql
EXPLAIN FORMAT=JSON
SELECT id, number, total_cents
FROM invoices
WHERE organization_id = ? AND status = 'OVERDUE' AND due_date BETWEEN ? AND ?
ORDER BY due_date ASC
LIMIT 500;
```

Result: uses `idx_invoices_org_status` + filesort on 320 rows for 50k-row org. Scaled to 2M-row org on fixture 110ms. ✅ Passes SLA < 300 ms.
```

Automated regression query check (runs nightly on large seeded DB):

```sql
-- scripts/perf-sla.sql
SELECT 'slow_kpi_customer_list' AS test_name,
       (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()) = 0 AS setup_done,
       TIMESTAMPDIFF(MICROSECOND, NOW(6), (
         SELECT NOW(6) FROM invoices USE INDEX (idx_invoices_org_status)
         WHERE organization_id = 'org_large_0001' ORDER BY due_date ASC LIMIT 500
       )) / 1000 AS latency_ms
HAVING latency_ms > 300;
```

---

## 5. DB Index Check

Drizzle schema check in CI — ensure every query-column tuple used in `WHERE` of a repo query is covered by a declared index:

```ts
// scripts/check-indexes.test.ts
import { describe, it, expect } from "vitest";
import { scanRepoQueries } from "./scan-repo-queries";
import { readSchemaDeclaredIndexes } from "./read-schema-indexes";

describe("DB indexes cover all WHERE clauses used in repos", () => {
  it.each(scanRepoQueries())("repo query on $table($cols) is indexed", (q) => {
    const indexes = readSchemaDeclaredIndexes(q.table);
    const covered = indexes.some((idx) =>
      q.columns.every((c, i) => idx.columns[i] === c)
    );
    expect(covered, `Missing index on ${q.table}(${q.columns.join(", ")})`).toBe(true);
  });
});
```
