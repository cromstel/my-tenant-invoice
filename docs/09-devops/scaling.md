# Scaling Strategy — Read Replicas, CDN, Horizontal Scaling

**Document Owner:** CromStel IT Group — Platform Architecture + SRE
**Last Updated:** 2026-09-20
**Reference Scale:** Designed for 10,000 orgs · 500,000 tenants · 5M invoices/month · 2k RPM peak

---

## 1. Scaling Model Summary

```
                        ╔══════════════════════════════════════════════════════════════╗
                        ║                    GLOBAL EDGE (Vercel)                      ║
                        ║  Cloudflare-style CDN (300+ PoP) · Image Optimization       ║
                        ║  Edge Middleware (Auth, Geo, Bot Mitigation, Rate Lim)      ║
                        ╚════════════════════════════╦═════════════════════════════════╝
                                                     │ 2 % miss → origin (SSR/API)
                        ┌────────────────────────────▼─────────────────────────────┐
                        │  ORIGIN TIER: Vercel Serverless Functions (horizontal)   │
                        │  • Autoscaled per route, concurrency handled by platform │
                        │  • 4096 MB memory / 15s timeout default                  │
                        │  • Hot routes (pay, webhook) → elevated limits via route │
                        └────────┬──────────────────────────────┬───────────────────┘
                                 │                              │
                 ┌───────────────▼──────────────┐   ┌───────────▼───────────────────┐
                 │ UPSTASH REDIS GLOBAL TIER    │   │ PLANETSCALE MYSQL CLUSTER    │
                 │ CACHE / SESSIONS / BULLMQ    │   │ ┌──────────────────────────┐ │
                 │ ┌─────────────────────────┐  │   │ │ PRM us-east-1 (WRITES)   │ │
                 │ │ 25 GB Memory (elastic)  │  │   │ └──────────┬───────────────┘ │
                 │ │ 50k concurrent conns    │  │   │            │ async repl < 1s │
                 │ │ 3k commands/sec baseline│  │   │    ┌───────▼────────┐        │
                 │ └─────────────────────────┘  │   │    │ RR us-west-2   │        │
                 └──────────────────────────────┘   │    └────────────────┘        │
                                                    │    ┌────────────────┐        │
                                                    │    │ RR eu-west-1   │        │
                                                    │    └────────────────┘        │
                                                    │ (reads split @Prisma)         │
                                                    └──────────────────────────────┘
```

---

## 2. Tier 1 — CDN / Edge (Vercel)

### 2.1 Cache Rules & TTLs

Vercel automatically manages CDN, but we explicitly set per-route cache behavior via `Cache-Control` headers and `revalidate`:

| Route Group          | Cache Strategy                        | TTL / Stale                                             | Expected Hit Rate |
|----------------------|---------------------------------------|---------------------------------------------------------|:-----------------:|
| Static assets `/static/*`, `/_next/static/*`, images, CSS, JS | Immutable CDN cache + file revving (`[contenthash]`) | `cache-control: public, max-age=31536000, immutable` | `> 99 %` |
| Marketing pages `/`, `/pricing`, `/features`    | ISR, revalidate = 60s, tags `marketing`             | 60s fresh · stale-while-revalidate 1 week             | `> 95 %` (after warm) |
| Legal pages `/terms`, `/privacy`                | ISR, on-demand revalidate after content change      | 1 year fresh · SWR 1 month                            | `> 99 %` |
| Login / signup `/login`, `/signup`, `/reset`    | SSR, no cache, `Cache-Control: private, no-store`   | N/A                                                   | N/A    |
| Dashboard app `/dashboard/*`                   | SSR, Streaming, no cache, Cookie split per tenant   | N/A                                                   | N/A    |
| Invoice PDF view `/invoices/:id/pdf`           | CDN + private signed link valid 300s                | Signed URL short TTL, actual content cached for 1h    | `> 85 %` (tenant shared) |
| API: read endpoints `/api/invoices/:id`        | SWR, Stale-While-Revalidate = 30s, tag by tenantId  | `s-maxage=30, stale-while-revalidate=300`             | `> 70 %` |
| API: mutations `/api/invoices/:id/*` (POST,PUT,DELETE) | no-cache, revalidate tags on success     | `Cache-Control: no-store`                             | N/A    |
| API: webhooks `/api/webhooks/*`                | No cache, always hit origin                         | N/A                                                   | N/A    |
| API: public health `/api/health`               | CDN 10s                                              | `s-maxage=10`                                         | `> 90 %` |

### 2.2 Edge Middleware Offload

We run as much heavy lifting as possible on Vercel Edge Middleware BEFORE the function call:

```ts
// middleware.ts (Runs on Edge, 0 cold-start, 1.5ms typical)
// Offloaded list:
//  1. Tenant routing by host header (custom domain → tenantId in header)
//  2. Session token decoding (JWT verify, lightweight - no DB hit)
//  3. IP-based rate limiting (reads from Upstash Redis via REST)
//  4. Bot / scrapers block (UA + Bot Fight Mode list)
//  5. CSP nonce injection (nonce per-request, passed as header)
//  6. Geo-blocking: embargoed countries = 451 redirect
//  7. A/B test bucket assignment (cookie → x-ab header)
```

Expected offload: **50% of all requests terminated at the edge** without touching a serverless function.

### 2.3 Image Optimization

All images (tenant logos, product images) via `next/image`:
- Remote pattern: `blob.mytenant-invoice.com/**` → resized to breakpoints `640w / 1024w / 2048w`
- Source: Vercel Blob → cached at Edge for 30 days
- Fallback avatar pattern: SVG generated at Edge runtime (no function call)

---

## 3. Tier 2 — Compute (Vercel Serverless Functions)

### 3.1 Autoscaling Knobs

Vercel auto-scales horizontally by default (1 function invocation = 1 isolated instance). We configure:

| Route Pattern              | Max Duration | Memory   | Concurrency per Instance | Cold Start Strategy     |
|----------------------------|--------------|----------|--------------------------|-------------------------|
| `/api/invoices/pay`        | 60 s         | 4096 MB  | 1 (serialize per invoice)| Always warm via cron ping |
| `/api/invoices/:id/pdf`    | 30 s         | 4096 MB  | 1                        | Warm via invocation pattern |
| `/api/webhooks/stripe`     | 15 s         | 1792 MB  | 50 (high burst capacity) | Idle concurrency = 3  |
| `/api/webhooks/resend`     | 15 s         | 1024 MB  | 20                       | Idle concurrency = 1  |
| `/api/*` (general reads)   | 15 s         | 1792 MB  | 100                      | Default platform       |
| BullMQ Worker cron jobs    | 5 min        | 4096 MB  | 12 workers (Vercel cron 12 schedules) | Idle concurrency 0, warm by schedule |

### 3.2 Route Splitting for Better Isolation

Every API route file is its own serverless function bundle. Routes are split to avoid bloated bundles:
- `/api/invoices/search` → small bundle (only invoice search logic)
- `/api/invoices/pay`    → separate bundle (Prisma + Stripe only)
- No catch-all `[...all]` router bundle that contains 20 MB of dead code

Bundle size limit enforced in CI (`build` stage):
```bash
# In post-build script (enforced, break pipeline if exceeded)
node -e "
  const m = require('./.next/analyze/route-manifest.json');
  const sizes = Object.values(m).reduce((a,b)=>a+b,0);
  const maxPerRoute = 2.5 * 1024 * 1024; // 2.5 MB
  for (const [route, files] of Object.entries(m)) {
    const size = files.reduce((s,f)=>s+fs.statSync('.next/'+f).size,0);
    if (size > maxPerRoute) { console.error('Bundle too big:', route, (size/1e6).toFixed(2)+'MB'); process.exit(1); }
  }
"
```

### 3.3 Horizontal Scaling Trigger Points (Monitor & React)

| Metric                                          | Threshold              | Action                                                                 |
|-------------------------------------------------|------------------------|------------------------------------------------------------------------|
| Vercel Provisioned Concurrency utilization      | ≥ 80 % for 10 min      | File Vercel support ticket for concurrency limit increase; temporary: add 20 idle concurrency |
| Average cold start > 1s for hot routes          | ≥ 1s p95               | Split route bundle further, remove unused imports                     |
| 429 responses "Function rate limit"             | ≥ 100 in 5 min         | Request enterprise concurrency uplift; identify & fix burst patterns |
| BullMQ queue depth > 500 for 10 min             | depth 500              | Temporarily double concurrency env var (`BULLMQ_CONCURRENCY=24`)      |

---

## 4. Tier 3 — Database (PlanetScale MySQL + Read Replicas)

### 4.1 Read vs Write Traffic Split

Current target: **85 % reads · 15 % writes**. All reads are offloaded to read replicas unless they are:
- In the same transaction as a write (we use Prisma `$transaction` with `interactiveTransactions`)
- Read-after-write (last 5 s) — configurable via tenant `consistency: 'strong'` flag
- Billing ledger reads during payment flow (never stale)

Prisma multi-ORM client (example implementation):

```ts
// src/lib/db/read-replicas.ts
import { PrismaClient } from '@prisma/client';

const primary = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
const replicaUsWest = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL_RR_USWEST } } });
const replicaEuWest = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL_RR_EUWEST } } });

// Round-robin reads across replicas; failover to primary on any replica error
const readReplicas = [replicaUsWest, replicaEuWest, primary];   // primary is last-resort
let rrCursor = 0;

export function readDb(): PrismaClient {
  const pick = readReplicas[rrCursor % readReplicas.length];
  rrCursor++;
  return pick;
}
export const writeDb = primary;
// Explicit strong-read (used after writes for consistency)
export const strongReadDb = primary;
```

### 4.2 Index Strategy (Scaling Reads)

Every `WHERE` and `JOIN ... ON` column is indexed. Composite indexes tuned per query patterns.
Monthly PlanetScale Insights digest → drop unused indexes, add covering indexes.

**Critical indexes today:**
- `invoices(tenantId, due_date, status)` — compound for dashboard
- `invoice_line_items(invoice_id)` — foreign key, with include(tariff_name, amount) covering
- `payments(tenantId, created_at)` — dashboard KPI queries
- `sessions(userId, expiresAt)` — auth lookup
- `bullmq_job_state(queue, state, createdAt)` — queue depth counters
- `audit_logs(actor, action, tenantId, timestamp)` — compliance queries

### 4.3 Sharding Plan (Triggered When: 1 PlanetScale cluster ≥ 80% capacity)

Shard key = **tenantId hash mod N** (N=8 initially, expandable to 128). Architecture uses the PlanetScale Vitess sharding:
- Shard `tenantId % 8 == 0` → cluster A
- Shard `tenantId % 8 == 1` → cluster B
- ...
- Global tables (reference data: `roles`, `currencies`, `tariff_catalog`) — duplicated everywhere via VReplication
- Cross-shard queries (rare — admin search) handled by application scatter-gather with 2s timeout

Trigger point: **Average DB CPU > 60% over 7 days** OR **1 PlanetScale node approaching max connections 80%** → begin shard migration project, 4-week timeline.

### 4.4 Query-Level Throttling

Prevent any single tenant from noisy-neighboring the cluster:

```sql
-- Resource groups per tenant tier (PlanetScale Enterprise feature)
CREATE RESOURCE GROUP tenant_free     VCPU_THREAD_PERCENT = 5,  THROTTLE_PRIORITY=LOW;
CREATE RESOURCE GROUP tenant_standard VCPU_THREAD_PERCENT = 20, THROTTLE_PRIORITY=MEDIUM;
CREATE RESOURCE GROUP tenant_enterprise VCPU_THREAD_PERCENT = 75, THROTTLE_PRIORITY=HIGH;
-- Quotas: per-tenant, 1 min window:
--   FREE tier:       300 queries, 50 writes
--   STANDARD tier:   3000 queries, 500 writes
--   ENTERPRISE:      unbounded
```

Enforced in Prisma middleware + PlanetScale query stats dashboard alert.

---

## 5. Tier 4 — Redis (Upstash Global Tier)

### 5.1 Caching Layers & Hit Targets

| Cache Key Pattern                        | TTL      | Cache Hit Rate Target | Eviction Policy | What Stores                            |
|------------------------------------------|----------|:---------------------:|-----------------|----------------------------------------|
| `tariff:<tenantId>:<version>`            | 3600 s   |       ≥ 99 %          | LFU             | Active tariff table (JSON)             |
| `tenant:<tenantId>:profile`              | 600 s    |       ≥ 95 %          | LFU             | Tenant brand settings, color, custom domain |
| `invoice_pdf:<invoiceId>:<hash>`         | 86400 s  |       ≥ 90 %          | LRU             | Rendered PDF binary                    |
| `dash_stats:<tenantId>:<date>`           | 300 s    |       ≥ 80 %          | LRU             | Dashboard KPI aggregations             |
| `user_sess:<jti>`                        | 1800 s   |       100 %           | LRU             | Active sessions, linked to cookie      |
| `rl:<ip-or-tenantId>:<window>`           | 900 s    |       100 %           | TTL only        | Rate limit counters                    |
| `bullmq:*`                               | per-job  |         N/A           | N/A             | Queue state, handled by BullMQ lib     |

### 5.2 Scale Trigger for Redis

| Alarm                                                    | Action                                                           |
|----------------------------------------------------------|------------------------------------------------------------------|
| Memory ≥ 75 % (25 GB global tier → 18.75 GB)              | Auto-scale to next tier via Upstash API; start eviction review |
| Commands/sec sustained ≥ 80% of limit                     | Engage Upstash support to raise quota                           |
| Redis client connections ≥ 90 % of max                    | Add connection pooling + lower connection TTL in ioredis config |
| Cache hit rate < 85 % 30 min sustained                    | Review TTL strategy; pre-warm hot keys on deploy               |

### 5.3 Horizontal Redis: When Global Tier Isn't Enough

Second layer of **tenant-dedicated shards** on top of global:
1. Upstash Enterprise allows dedicated Redis cluster (raw instances, not shared)
2. Shard by hash(tenantId) mod 8; lookup in global "shard map" cache → per-tenant cluster endpoint
3. First 1k enterprise tenants get dedicated shards (low/no noisy neighbor)

---

## 6. Tier 5 — Async Jobs (BullMQ)

### 6.1 Job Priority Classes

| Class          | Queue Name      | Concurrency | Retry Policy                           | Latency SLA      |
|----------------|-----------------|-------------|----------------------------------------|------------------|
| **Critical**   | `payments-*`    | 4 (low, serialized per tenant) | immediate, 3 retries, exp backoff, DLQ after fail | < 10 s |
| **High**       | `emails`        | 6           | 3 retries, 1 min delay                 | < 30 s           |
| **High**       | `webhooks`      | 10          | 5 retries, exp backoff → DLQ           | < 30 s           |
| **Standard**   | `pdf-generate`  | 3           | 2 retries, 5 min delay → DLQ           | < 3 min          |
| **Standard**   | `report-csv`    | 1           | 2 retries, 10 min → DLQ                | < 15 min         |
| **Low**        | `bulk-import`   | 1           | 3 retries, 30 min → DLQ                | < 4 hr           |
| **Maintenance**| `housekeeping`  | 1           | no retry, fire next day                | nightly          |

### 6.2 Scaling BullMQ Workers

- Workers run as Vercel scheduled functions — 12 schedules mapped to each priority queue (`* * * * *`, every minute, acts as worker poller)
- Beyond Vercel cron, enterprise scale-up: deploy BullMQ workers as fly.io or AWS ECS Fargate spot containers with auto-scaling rules based on queue depth metrics:
  ```
  Scale-up rule:   queue-depth > 100 for 3 min → add 1 worker (max 50)
  Scale-down rule: queue-depth < 10  for 15 min → remove 1 worker (min 1 per queue)
  ```

---

## 7. Cost Controls + Load Testing

### 7.1 Budget Alerts

| Service         | Monthly Budget  | Alert Thresholds          | Recipient                    |
|-----------------|-----------------|---------------------------|------------------------------|
| Vercel          | $6,000          | 75% / 90% / 100%          | FinOps + DevOps Lead         |
| PlanetScale     | $4,500          | 75% / 90% / 100%          | FinOps + DB Admin            |
| Upstash         | $1,200          | 75% / 90%                 | SRE                          |
| Stripe fees     | variable (% GP) | 2σ variance               | Finance                      |
| Resend          | $400            | 100%                      | Marketing + Support Lead     |

### 7.2 Quarterly Load Test

Before each major release train, run load test profile with k6:

| Profile       | Duration | Pattern                                                     | Target Pass Criteria                    |
|---------------|----------|-------------------------------------------------------------|-----------------------------------------|
| Smoke         | 5 min    | 50 VUs, happy path login → invoice list → create → view PDF | HTTP 2xx ≥ 99%, p95 < 2s                |
| Baseline      | 30 min   | 500 VUs, realistic mix: 80% read · 15% mutate · 5% pay      | HTTP 2xx ≥ 99%, p95 < 3s, 0 DB timeouts |
| Spike         | 30 min   | 100 → 2500 VUs in 60s (pay-invoice endpoint burst + webhook storm) | 2xx ≥ 95%, no crashloop, recover to baseline in 5 min |
| Soak          | 6 hr     | 800 VUs constant, realistic mix, run overnight              | Memory leak < 5% per function, no slowdown drift |
