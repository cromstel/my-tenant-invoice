# Monitoring Playbook — myTenant Invoice SaaS

**Document Owner:** CromStel IT Group — SRE Team
**Last Updated:** 2026-09-20
**Primary Tools:** Vercel Analytics · PlanetScale Insights · Upstash Metrics · Datadog · Better Uptime

---

## 1. Golden Signals Dashboard

The **single-pane-of-glass** for all on-call engineers lives at:
`https://datadoghq.com/dashboard/mytenant-golden-signals`

It displays the 4 golden signals + business-significant metrics, grouped by tier.

### 1.1 Golden Signals per Component

| Component       | Latency (p95)                         | Traffic (RPM)                           | Errors (5xx %)                         | Saturation (%)                         |
|-----------------|---------------------------------------|-----------------------------------------|----------------------------------------|----------------------------------------|
| Vercel Edge     | `< 150 ms` (cached) / `< 1.2 s` (SSR) | `> 0, tracked per route`                | `< 0.5 %`                              | Function memory: `< 70 % of 4GB`       |
| PlanetScale DB  | Query p95 `< 80 ms`                   | QPS `> 0, reads / writes split`         | Connection errors `= 0`, timeouts `< 0.1 %` | CPU `< 70 %`, connections `< 65 %` |
| Upstash Redis   | Command p99 `< 5 ms`                  | Commands/sec                            | Redis errors `= 0`                     | Memory `< 75 %`, eviction rate `= 0`   |
| BullMQ Workers  | Job p95 `< 6 s` (emails, PDFs)        | Queue depth, jobs/hour                  | Failed jobs `< 0.3 %`                  | Concurrency utilization `< 80 %`       |
| Stripe API      | RTT p95 `< 1.5 s`                     | Charge attempts/hour                    | Declines `< 15 %` of attempts          | API rate limit `< 60 %` used           |
| Resend API      | Deliveries: SMTP round-trip p95 `< 4 s` | Emails/hour                           | Bounce rate `< 2 %`, complaint `< 0.1 %` | N/A (API SaaS)                        |

### 1.2 Business KPIs (also on dashboard)

| Metric                          | Goal / Threshold                     | Source                |
|---------------------------------|--------------------------------------|-----------------------|
| Successful invoices generated   | hourly trend, no 0-hour gaps except 00-04 UTC | `invoices.created_at` hourly bucket |
| Payment success rate            | `> 94 %` of attempted charges        | Stripe + DB ledger    |
| Customer login success          | `> 98.5 %`                           | Auth.js logs          |
| Daily active orgs               | weekly trend visible                 | `sessions` materialized view |
| PDF generation success          | `> 99.5 %`                           | BullMQ job results    |

---

## 2. Alert Triage & Routing

Alerts are configured in Datadog Monitors + Better Uptime + native Vercel/PlanetScale/Upstash alerting.
All are forwarded to **Opsgenie**, which routes via schedule:

| Severity   | Criteria Example                                                                 | Pager      | Slack Channel      | SLA Ack Time | SLA Mitigate |
|------------|----------------------------------------------------------------------------------|------------|--------------------|:------------:|:------------:|
| **SEV1**   | Error rate ≥ 5% for 5 min · DB p95 ≥ 500 ms · 0 invoices in ≥ 60 min             | on-call SRE + manager | #prod-incidents · @sre-oncall · @lead-eng | ≤ 5 min      | ≤ 60 min     |
| **SEV2**   | Error rate ≥ 1% · BullMQ queue depth ≥ 200 for 10 min · any webhook 5xx          | on-call SRE | #prod-incidents    | ≤ 15 min     | ≤ 4 hr       |
| **SEV3**   | Single route p95 ≥ 3s for 15 min · Redis hit rate dropped 10% · warnings surge   | next business day | #eng-room          | ≤ 2 hr (W/D) | ≤ 2 business days |
| **SEV4**   | Coverage down, deprecation warnings, `info` level events                          | weekly triage | #alerts-archive    | weekly review | backlog |

**Escalation chain (SEV1):** SRE on-call → DevOps Lead → CTO (15 min unack → next level).

---

## 3. Detailed Monitors

### 3.1 Vercel / App Layer — Datadog Monitors via Vercel Integration

| Monitor ID      | Query / Threshold                                                                   | SEV  |
|-----------------|-------------------------------------------------------------------------------------|------|
| `vercel-http-5xx` | `sum(last_5m):sum:vercel.http.request.errors{env:production}.as_count() / sum:vercel.http.request.count{env:production}.as_count() * 100 > 1` | SEV1 if > 5% else SEV2 |
| `vercel-latency-api` | `avg(last_10m):p95:vercel.http.request.latency_ms{route_group:/api/*,env:production} > 2000` | SEV2 |
| `vercel-latency-ssr` | `avg(last_10m):p95:vercel.http.request.latency_ms{route_group:/_app/*,env:production} > 3000` | SEV2 |
| `vercel-cold-starts` | `sum(last_1h):avg:vercel.function.cold_start_ms{env:production}.rollup(avg, 3600) > 1500` | SEV3 |
| `vercel-usage-429` | `sum(last_5m):sum:vercel.http.response.status{code:429,env:production}.as_count() > 100` | SEV2 |

### 3.2 Database — PlanetScale Insights + Datadog

| Monitor                              | Threshold                                      | SEV  |
|--------------------------------------|------------------------------------------------|------|
| DB query timeout rate                | `> 0.1 %` queries with `query_time >= 5s`      | SEV1 |
| DB CPU                               | `>= 75 %` sustained for 10 min                 | SEV2 |
| DB connection saturation             | `>= 80 %` max_conn used                         | SEV2 |
| Replica lag                          | `>= 5 s` on any read replica                    | SEV2 |
| Slow queries (>250 ms)               | Top 10 appear weekly in Insights report        | SEV3 (ticket) |
| `SELECT *` patterns detected         | Any new query in Insights without indexed where | SEV3 (ticket) |

### 3.3 Redis / Queues — Upstash + BullMQ Metrics

| Monitor                              | Threshold                                                | SEV  |
|--------------------------------------|----------------------------------------------------------|------|
| Queue depth: `emails`, `pdfs`, `webhooks` | depth ≥ 200 for 10 min, or depth = 0 AND jobs expected | SEV2 |
| Job failure rate (1h window)         | failed / total ≥ 2 %                                     | SEV2 |
| Redis memory usage                   | used_memory / maxmemory ≥ 85 %                           | SEV2 if ≥ 85%, SEV1 if ≥ 95% |
| Redis evictions / sec                | `> 0` (means we starved sessions!)                       | SEV1 |
| Redis hit rate                       | hit_ratio < 85 % sustained 30 min                        | SEV3 |
| Session storage key count anomaly    | ± 4σ from 7-day moving average                           | SEV2 (possible leak) |

### 3.4 External Dependencies — Synthetic Monitors

| Monitor (Better Uptime)             | URL / Check                                | Interval | Region       | SEV  |
|--------------------------------------|--------------------------------------------|----------|--------------|------|
| `prod-login-page`                    | `GET https://app.mytenant-invoice.com/login` | 30 s   | 5 regions    | SEV1 (≥2 regions fail 2 min) |
| `prod-api-health`                    | `GET https://app.mytenant-invoice.com/api/health` expect JSON `status=ok` | 30 s | 5 regions | SEV1 |
| `stripe-webhook-endpoint-live`       | POST test event → expect 200 (custom)      | 5 min    | us-east-1    | SEV2 |
| `stripe-api-liveness`                | third-party statuspage.io `stripe`         | 1 min    | synthetic    | SEV2 (Stripe partial outage) |
| `resend-delivery-latency`            | send to mailbox test → receipt under 60s   | 10 min   | us-east-1    | SEV3 |
| `resend-domain-reputation`           | SenderScore ≥ 90                           | daily    | synthetic    | SEV3 |
| `sso-google-oauth`                   | test refresh token flow                    | 5 min    | synthetic    | SEV2 |

### 3.5 Job & Cron Monitors (Healthchecks.io)

Each BullMQ cron/recurring job pings a Healthchecks UUID on start + success + failure.

| Job Name                            | Schedule     | Grace (min) | Alert if Missing    |
|-------------------------------------|--------------|-------------|---------------------|
| `cron-invoice-generation-monthly`   | 1st 00:10 UTC| 45          | SEV2 (billing risk) |
| `cron-reminders-3day-before-due`    | daily 07:30  | 20          | SEV3                |
| `cron-dunning-overdue-day-1`        | daily 08:00  | 20          | SEV3                |
| `cron-dunning-overdue-day-7`        | daily 08:10  | 20          | SEV2 (collections)  |
| `cron-daily-payout-reconcile`       | daily 04:00  | 45          | SEV2 (finance)      |
| `cron-nightly-mv-refresh`           | daily 03:00  | 45          | SEV3                |
| `cron-bullmq-dead-letter-retry`     | hourly :17   | 20          | SEV4                |

---

## 4. On-Call Triage Runbook (Per Alert)

### SEV1: Error Rate ≥ 5%
1. Confirm dashboard is red on "Errors %". Open Vercel Function Logs, filter `status:5xx`.
2. Inspect latest Sentry issues. Sort by "First seen". If a release tag matches 15 min deploy window → **roll back immediately** (see [`rollback.md`](./rollback.md)).
3. If logs say `DB connection timeout` → check PlanetScale status, failover to replica, escalate to SRE.
4. If logs say `Redis ECONNREFUSED` → confirm Upstash status page; if global incident, toggle `USE_LOCAL_FALLBACK=true` (feature flag) to gracefully degrade.
5. Post status page update: `status.cromstelit.com` → "Investigating partial service disruption".

### SEV2: BullMQ queue depth ≥ 200 for 10 min
1. BullMQ Arena: `bulls.mytenant-invoice.internal` (VPN only) → identify backed-up queue.
2. If `pdfs` queue: check PDF worker memory, maybe increase concurrency to 20.
3. If `emails` queue: check Resend API status; if down, switch to SMTP fallback env var.
4. If `webhooks` queue (Stripe): inspect dead-letter; requeue with `scripts/requeue-dead-letter.sh`.
5. If the queue is due to **poison message**, move to dead-letter + create bug ticket.

### SEV2: DB Replica Lag ≥ 5 s
1. PlanetScale Insights → identify heavy write query in `max_stmt` digest.
2. If ongoing migration, throttle app writes via `WRITE_RATE_LIMIT=400` feature flag.
3. If replica lag ≥ 30 s, promote read replica → new primary (see PlanetScale failover docs).

### SEV3: Slow Query Detected (>250 ms)
1. Grab digest from PlanetScale Insights, run `EXPLAIN ANALYZE`.
2. Add covering index or refactor query. Ship as part of next release train.
3. Exception: if query is on `/api/invoices/pay` hot path → expedite PR same-day.

### Every SEV1/SEV2 Post-Mortem
- Blameless retro doc within 48h in `docs/postmortems/YYYY-MM-DD-{slug}.md`.
- Linked from `PROJECT_STATUS.md § Risks`.
- 5 Whys, corrective actions tracked as GitHub issues with label `corrective-action`.

---

## 5. Dashboards Inventory

| Name                               | Link                                                                    | Audience              |
|------------------------------------|-------------------------------------------------------------------------|-----------------------|
| Golden Signals                     | datadog/d/mytenant-golden-signals                                      | SRE, Eng leads        |
| Business KPIs (Finance-facing)     | metabase.io/dashboard/mytenant-finance                                 | Finance, PM, exec     |
| Tenant-specific perfs              | metabase.io/dashboard/mytenant-per-org                                 | Support + org admins (self-serve) |
| Billing Pipeline Detail            | datadog/d/mytenant-billing-pipeline                                    | SRE + Platform team   |
| Infrastructure Cost (daily)        | aws/vercel/planetscale consolidated view → Kubecost dashboard          | FinOps, DevOps lead   |
