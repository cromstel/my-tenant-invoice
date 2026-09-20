# Observability — Logs, Traces, Metrics, Sentry

**Document Owner:** CromStel IT Group — SRE Team
**Last Updated:** 2026-09-20
**Stack:** Pino (structured logging) · OpenTelemetry → Datadog · Sentry (errors, perf, replay, profiling) · PlanetScale Query Insights · Upstash Metrics

---

## 1. Observability Pillars Overview

| Pillar       | Primary Tool       | Secondary       | Retention       | Cost Class   |
|--------------|--------------------|-----------------|-----------------|--------------|
| **Logs**     | Datadog Logs (pipeline JSON) | Vercel Runtime Logs | 7d hot · 60d cold | mid |
| **Metrics**  | Datadog Metrics (OTLP exporter) | PlanetScale / Upstash native | 15m rollup 15 mo · hourly rollup 15 mo | low-mid |
| **Traces**   | Sentry Tracing + Datadog APM | OpenTelemetry SDK | 7d (Sentry) · 7d (DD) | high (sample) |
| **Errors**   | Sentry Issues (incl. frontend JS) | — | 90d active · archived 12 mo | mid |
| **Session Replay** | Sentry Replay | — | 30d (PII-scrubbed) | mid |
| **Profiles** | Sentry Node/Browser Profiling | Vercel function logs | 30d | mid |

**Sampling Strategy** (critical to keep observability cost under 8% of infra cost):
- Errors: **100%** sampled, always.
- Traces: prod = **5%** base + **100%** for any span with `status=error` / `latency > 3 s` (tail-based decision before drop). Staging = 100%.
- Session Replay: prod = **10%** of sessions, **100%** if session had an error.
- Metrics: 100% (counters, gauges are cheap). Histograms only for latency distributions.

---

## 2. Logging: Pino → Datadog / Vercel

### 2.1 Structured Logger Contract

All app code MUST use the shared logger in `src/lib/observability/logger.ts`. Never `console.log`/`.error`/`.warn` (enforced by ESLint `no-console:error`).

```ts
// src/lib/observability/logger.ts
import pino from 'pino';

type TenantCtx = { tenantId?: string; orgId?: string; userId?: string };
type ReqCtx    = { reqId?: string; method?: string; url?: string; ip?: string; ua?: string };

export function createLogger(ctx: TenantCtx & ReqCtx = {}) {
  return pino({
    level: process.env.LOG_LEVEL ?? 'info',
    ...(process.env.LOG_PRETTY === 'true'
      ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
      : {}),
    base: {
      app:      'mytenant-invoice',
      version:  process.env.NEXT_PUBLIC_APP_VERSION ?? process.env.VERCEL_GIT_COMMIT_SHA?.slice(0,8),
      env:      process.env.NODE_ENV,
      ...ctx,
    },
    // ⚠️ DO NOT LOG THESE
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.body.password',
        'req.body.stripeToken',
        'req.body.cardNumber',
        'req.body.ssn',
        'req.body.taxId',
        'req.body.bankAccount',
        'res.set-cookie',
        '*.email',          // replaced with [Redacted Email]
        '*.phone',          // replaced with [Redacted Phone]
        'ctx.userId',       // OPT OUT for support debugging: enable via toggle
      ],
      censor: '[REDACTED]',
      remove: false,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

// Usage in route handler:
export async function POST(req: NextRequest) {
  const session = await auth();
  const log = createLogger({
    tenantId: session?.user.tenantId,
    orgId:    session?.user.orgId,
    userId:   session?.user.id,
    reqId:    crypto.randomUUID(),
    method:   req.method,
    url:      req.url,
    ip:       req.headers.get('x-forwarded-for') ?? undefined,
  });
  log.info({ step: 'begin', bodySize: (await req.text()).length });
  // ...
}
```

### 2.2 Log Level Conventions

| Level  | When To Use                                                                | Example                                                             |
|--------|----------------------------------------------------------------------------|---------------------------------------------------------------------|
| `fatal`| System is unrecoverable, will crash immediately.                           | Uncaught `uncaughtException`, DB connection cannot be established after retries. |
| `error`| User-visible failure, operation not retried, financial impact possible.    | `log.error({ err, invoiceId }, 'failed to charge invoice')`        |
| `warn` | Non-blocking anomaly, automated fallback succeeded, retry path triggered.  | `log.warn({ attempts, queue }, 'job retried')`                      |
| `info` | Expected business operation — one line per request/job start & success.    | `log.info({ invoiceId, amount, tenantId }, 'invoice finalized')`    |
| `debug`| Developer-only diagnostic, never logged in prod (gate kept at `info`).     | `log.debug({ row }, 'fetched tariff row')`                           |
| `trace`| Reserved for future OpenTelemetry auto-injection. Do not call directly.    | N/A                                                                 |

### 2.3 Vercel Runtime → Datadog Pipeline

Forwarded via the Vercel → Datadog integration plus an HTTP drain for `stdout` JSON.
Datadog Log Pipeline applies these processing rules IN ORDER:

1. **Parse JSON** — if message is JSON, parse to structured fields (pino JSON log body).
2. **Extract** `tenantId, orgId, userId, reqId, version, env` to top-level facets (for filtering).
3. **Scrub** — run additional PII regex on `message` field as safety net (credit card, SSN, email).
4. **Remap severity** → `pino.level` → Datadog severity (30=info,40=warn,50=error,60=critical).
5. **Route** to indexes:
   - `env=production` → `mytenant-prod-main` (retain 7d hot, 60d cold)
   - `level >= 50` (error/fatal) → `mytenant-errors` (retain 180d)
   - `tenantId=*` → `mytenant-billing-trace` (retain 13mo for audit/compliance)

### 2.4 Log Queries Cheat Sheet (Datadog Log Explorer)

```datadog
# Find all failed Stripe charges last 24h for a specific tenant
service:mytenant-invoice env:production tenantId:org_9F2a3x AND "charge failed"

# Find slow API handlers >2s (from latency attribute)
env:production @type:request_end @latency:>2000

# Count 5xx per route last hour (timeseries)
env:production status:>=500 | count by route

# Find BullMQ dead letters
env:production queue:* state:dead-letter

# All actions by superadmin user (audit trail)
env:production role:superadmin @step:* | count by step,userId
```

---

## 3. Distributed Tracing (Sentry + Datadog APM)

### 3.1 Instrumentation

```ts
// src/lib/observability/tracing.ts — Sentry init on server + client
import * as Sentry from '@sentry/nextjs';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn:          process.env.SENTRY_DSN,
    environment:  process.env.NODE_ENV === 'production' ? (process.env.VERCEL_ENV ?? 'production') : process.env.NODE_ENV,
    release:      process.env.NEXT_PUBLIC_APP_VERSION ?? process.env.VERCEL_GIT_COMMIT_SHA,
    sampleRate:                  1.0,                          // errors: always
    tracesSampleRate:            parseFloat(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? '0.05'),
    profilesSampleRate:          0.2,                          // for perf regressions
    replaysSessionSampleRate:    parseFloat(process.env.NEXT_PUBLIC_SENTRY_REPLAY_SESSION_SAMPLE_RATE ?? '0.1'),
    replaysOnErrorSampleRate:    1.0,                          // capture replay on ANY error
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Prisma({ client: prisma }),
      new Sentry.Integrations.Mysql(),
      new Sentry.Integrations.Auth(),
    ],
    beforeSend(event) {
      // Strip secrets from event extra
      const redactKeys = /(secret|token|password|cookie|api.?key|stripe.*(secret|key))/i;
      JSON.stringify(event, (k, v) => (redactKeys.test(k) ? '[REDACTED]' : v));
      return event;
    },
    beforeSendTransaction(transaction) {
      // Tail-based sampling: keep slow / errored
      if (transaction.transaction.includes('/api/webhooks/')) return transaction;   // keep 100% of webhooks
      const duration = (transaction as any).end_timestamp - (transaction as any).start_timestamp;
      if (duration > 3 || (transaction as any).status === 'internal_error') return transaction;
      return Math.random() < 0.05 ? transaction : null;
    },
  });
}
```

BullMQ jobs also get a wrapping span (`src/lib/queues/with-tracing.ts`) auto-tagged with `job.name`, `job.queue`, `job.attempts`, `job.tenantId`, `job.orgId`.

### 3.2 Critical Transaction Names (to filter in Sentry)

| Transaction                         | P95 Goal     | Breach Alert |
|-------------------------------------|--------------|--------------|
| `GET /api/invoices`                 | `700 ms`     | SEV2         |
| `POST /api/invoices/:id/pay`        | `3000 ms`    | SEV1 (revenue) |
| `POST /api/webhooks/stripe`         | `1000 ms`    | SEV2 (missed webhook → failed invoice) |
| `GET /dashboard` (SSR)              | `1500 ms`    | SEV3         |
| `POST /api/auth/[...nextauth]`      | `800 ms`     | SEV3         |
| `job:pdf-generate`                  | `5000 ms`    | SEV2         |
| `job:email-send`                    | `2000 ms`    | SEV2         |

---

## 4. Metrics (OpenTelemetry → Datadog)

### 4.1 Metric Taxonomy

All custom metrics are prefixed `mytenant.*`. Use the following namespaces:

```
mytenant.api.*                     # API/Route metrics
mytenant.api.request_duration_ms   # histogram, tags: method, route, status, tenantId
mytenant.api.request_count         # counter,   tags: method, route, status

mytenant.invoices.*                # Billing KPI metrics
mytenant.invoices.generated_count  # counter, tags: tenantId, currency
mytenant.invoices.amount_usd       # counter (sum of amounts), tags: tenantId
mytenant.invoices.payment_success  # counter, tags: tenantId, paymentMethod
mytenant.invoices.payment_failed   # counter, tags: tenantId, declineCode

mytenant.bullmq.*                  # Queue metrics
mytenant.bullmq.enqueued           # counter, tags: queue, tenantId
mytenant.bullmq.completed          # counter, tags: queue, tenantId
mytenant.bullmq.failed             # counter, tags: queue, tenantId, reason
mytenant.bullmq.duration_ms        # histogram, tags: queue

mytenant.tenant.*                  # Per-tenant business counters
mytenant.tenant.active_login       # counter, tags: tenantId, role
```

### 4.2 Emission Pattern

```ts
// src/lib/observability/metrics.ts
const meter = opentelemetry.metrics.getMeter('mytenant-invoice');

export const apiRequestDuration = meter.createHistogram('mytenant.api.request_duration_ms', {
  description: 'API request duration in ms',
  unit: 'ms',
  advice: { explicitBucketBoundaries: [10,50,100,250,500,1000,2500,5000,10000] },
});

// Middleware emits on each request end:
// apiRequestDuration.record(latencyMs, { method, route, status, tenantId })
```

---

## 5. Sentry Configuration & Features Deep-Dive

### 5.1 Issue Triage Rules

Automated rules run on every new Sentry event:

| Rule                                                        | Action                                                                            |
|-------------------------------------------------------------|-----------------------------------------------------------------------------------|
| Any first-time-seen issue on env=production + release=current | Slack #prod-incidents, P1 alert if HTTP handler / payment flow                  |
| Issue `fingerprint` matches `stripe-*-timeout`              | Auto-link to RUNBOOK-STRIPE-TIMEOUT, page SRE if > 10/hour                        |
| Issue has tags `queue=pdf-generate` AND error=OOM           | Auto-trigger deploy to add worker memory, create GitHub issue to optimize PDF lib |
| Issue matches "Database error: deadlock found"              | Auto-tag `needs-perf-review`, assign to platform team                             |
| Issue fingerprint already marked "Ignore Until Fix"         | Drop from alerts (but keep ingesting for regression testing)                      |

### 5.2 Fingerprinting Rules for Aggregation

`sentry.properties` / JS `beforeSend`:
```ts
beforeSend(event) {
  // Aggregate all DB constraint failures of same type regardless of values
  if (event.exception?.values?.[0].value?.includes('Unique constraint failed')) {
    event.fingerprint = ['db-unique-constraint', event.exception.values[0].value.match(/on table: (\w+)/)?.[1] ?? 'unknown-table'];
  }
  // Aggregate Stripe rate-limits
  if (event.tags?.provider === 'stripe' && event.exception?.values?.[0].value.includes('429')) {
    event.fingerprint = ['stripe-rate-limit'];
  }
  return event;
}
```

### 5.3 Session Replay PII Scrubbing

Scrubbed at capture time (never leaves browser):

```ts
new Sentry.Replay({
  maskAllText:      true,
  blockAllMedia:    true,
  mask: ['.pii-email', '.pii-phone', '.pii-address', '.invoice-total'],
  block: ['iframe', '[data-sentry-block]'],
  unmask: ['.logo', '.brand-name', '.kpi-number'],      // OK to see in replay
});
```

### 5.4 Release Health (Crash-Free Sessions)

Targets tracked by Sentry Release Health widget:
- Frontend crash-free sessions: `> 99.8 %`
- Backend crash-free rate (abnormal function exits): `> 99.95 %`
- Regression alert: if any new release drops crash-free by 0.3% → SEV2, auto-open rollback candidate issue.

---

## 6. Custom Dashboards Reference

| Datadog Dashboard                | Key Panels                                                                 |
|----------------------------------|----------------------------------------------------------------------------|
| `mytenant-golden-signals`        | p95 latency per tier, error %, RPM, Redis saturation, queue depths        |
| `mytenant-slo-status`            | SLO burn-rate for `/api/invoices/pay`, webhook endpoint, login            |
| `mytenant-billing-pipeline`      | invoices generated/hour, charges attempted, success $, failed $, top decline reasons |
| `mytenant-tenant-traffic-top-50` | Top tenant RPM, errors, slowest routes, for each org (support tool)       |

---

## 7. SLO Definitions

Tracked in Datadog SLO feature. Each SLO has error budget policy: when budget < 30% → no feature deploys until SRE fixes.

| SLO ID       | Description                                        | Target    | Window  | Burn Alert  |
|--------------|----------------------------------------------------|-----------|---------|-------------|
| `SLO-001`    | API availability (`GET /api/health` all regions)   | 99.9 %    | 30-day  | 14x 1h      |
| `SLO-002`    | `/api/invoices/pay` success rate                   | 99.5 %    | 30-day  | 10x 1h      |
| `SLO-003`    | Stripe webhook delivery 2xx                         | 99.0 %    | 7-day   | 8x 1h       |
| `SLO-004`    | Invoice PDF generation success                     | 99.5 %    | 7-day   | 6x 1h       |
| `SLO-005`    | Login flow availability                            | 99.9 %    | 30-day  | 12x 1h      |
| `SLO-006`    | p95 latency `/api/invoices` (read)                | < 700 ms  | 7-day   | 6x 1h       |
