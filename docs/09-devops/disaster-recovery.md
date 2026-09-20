# Disaster Recovery (DR) — RPO/RTO, Backup Rotation

**Document Owner:** CromStel IT Group — SRE Team
**Last Updated:** 2026-09-20
**Classification:** Internal — Restricted (contains runbooks for outages)

---

## 1. Disaster Taxonomy & RPO/RTO Targets

| Tier | Scenario Example                                                 | Category       | RPO Target | RTO Target | Owner             |
|------|------------------------------------------------------------------|----------------|:----------:|:----------:|-------------------|
| T0   | Entire PlanetScale region down (us-east-1)                       | Regional       |   ≤ 1 hr   |   ≤ 4 hr   | SRE + Platform    |
| T1   | PlanetScale DB unrecoverable corruption (bad migration rollout) | Data           |  ≤ 30 min  |   ≤ 2 hr   | SRE + DB admin    |
| T2   | Accidental mass-delete by superadmin (no soft-delete bug)       | Data           |  ≤ 15 min  |   ≤ 2 hr   | Platform + SRE    |
| T3   | Vercel region-wide outage (all functions returning 5xx)         | Compute        |     0      | ≤ 30 min   | DevOps lead       |
| T4   | Upstash Redis global cluster down (sessions/queues lost)        | Cache/Queue    |   ≤ 1 hr   |   ≤ 1 hr   | SRE               |
| T5   | Stripe Connect platform outage → no payments                    | 3rd-party      |   =Stripe  |   ≤ 4 hr   | Finance + Support |
| T6   | Compromised secret (key leaked via CI logs, engineer laptop)    | Security       |     —      |   ≤ 1 hr   | Sec + DevOps      |
| T7   | Bad deploy to prod → widespread 5xx or data mutation            | Bad Release    |  ≤ 10 min  |  ≤ 15 min  | SRE on-call       |

Definitions:
- **RPO (Recovery Point Objective):** Maximum acceptable data loss measured in time.
- **RTO (Recovery Time Objective):** Maximum acceptable downtime window from declared incident to "fully operational" (not degraded-mode).

---

## 2. Backup Rotation Policy

### 2.1 PlanetScale (MySQL) — Source of Truth

| Backup Type             | Schedule                      | Retention                                                             | Location            |
|-------------------------|-------------------------------|-----------------------------------------------------------------------|---------------------|
| **Automated Snapshot**  | Hourly, on-the-hour           | Hourlies 48 h, Daily 35 days, Weekly 12 weeks, Monthly 12 months      | PlanetScale managed |
| **Manual DR Snapshot**  | Weekly Sunday 01:00 UTC       | 2 years (cold, object-locked WORM — immutable)                        | AWS S3 us-west-2 + eu-west-1 (cross-region) |
| **Point-in-Time (PITR)**| Continuous (binlog streamed) | 7 day rolling window, 1 second granularity                             | PlanetScale managed |
| **Pre-migration Snap**  | Before every `prisma migrate deploy` | Retain until next 3 successful migrations + 7 days grace        | PlanetScale, named `migrate-<YYYYMMDDHHMM>` |
| **Schema-only Backup**  | Daily                         | Forever                                                               | Git (in `prisma/migrations/` folder, audited) |

### 2.2 Upstash Redis

| Backup Type                | Schedule          | Retention                  | Notes                              |
|----------------------------|-------------------|----------------------------|------------------------------------|
| Automated AOF rewrite      | Continuous        | Upstash managed            | Used for routine restarts only     |
| RDB snapshot export        | Daily 00:30 UTC   | 14 days hot, 90 days cold  | Encrypted (AES-256) at rest, KMS CMK rotated monthly |
| Critical-data RDB export   | Before prod deploys | retain 30 days           | Uploaded to S3                      |

Note: Redis stores ONLY transient data (sessions, queue jobs, rate limit counters). Queue jobs are also persisted in MySQL `bullmq_journal` table as double-write for reconstruction.

### 2.3 Object Storage (Invoice PDFs, Logo Uploads)

Stored in **Vercel Blob + S3 cross-region replica (us-east → eu-west)**.

| Backup Method                              | Retention            |
|--------------------------------------------|----------------------|
| Object versioning (on both buckets)        | 120 versions / 365 d |
| Daily S3 Replication Metrics verification  | automated            |
| Monthly restore test (sample 1% of files)  | documented result    |

### 2.4 Stripe Subledger / Financial Records

Stripe IS the source of truth for payment movements. We ALSO maintain our own DB ledger (double-entry), verified daily.

| Backup Method                                      | Retention             |
|----------------------------------------------------|-----------------------|
| Stripe Sigma hourly snapshot to S3 (CSV exports)   | 7 years (tax req)     |
| Own DB `ledger_*` tables included in PlanetScale backups | same as DB         |
| Daily reconcile runbook (`scripts/reconcile-stripe.ts`)  | emails discrepancies to finance@cromstelit.com |

---

## 3. Restore Runbooks

### 3.1 Runbook R-1: PITR for a Single Table / Tenant (T2, accidental delete)

Example scenario: `tenantId=org_S2aF` invoices mass-deleted via buggy admin API at 2026-09-20 14:23:00 UTC.

```bash
# 1. Confirm precise timestamp — check audit trail + logs for delete event
#    Target restore time = 2026-09-20 14:22:30 UTC (30s before first delete)
export RESTORE_TS="2026-09-20 14:22:30+00:00"

# 2. Spin up PITR branch in PlanetScale (do NOT touch production)
pscale branch restore mytenant_invoice recovery-org-S2aF \
  --restore-from mytenant_invoice/main \
  --restore-to "$RESTORE_TS" \
  --region us-east-2

# 3. Wait for ready, connect via pscale shell or Prisma, export affected rows:
pscale shell mytenant_invoice recovery-org-S2aF --execute \
  "SELECT * FROM invoices WHERE tenantId='org_S2aF' AND deletedAt IS NULL" \
  --format csv > /tmp/invoices-org-S2aF-pre-loss.csv

# 4. Restore to prod via upsert SQL (wrapped in a transaction!)
#    This runs only after QA confirms CSV row count matches pre-loss count
pscale shell mytenant_invoice main --execute \
  "START TRANSACTION;
   -- upsert 238 rows from CSV (LOAD DATA LOCAL or batched SQL via script)
   -- example placeholder — actual script: scripts/restore-upsert-invoices.sql
   COMMIT;"

# 5. Verification (double-count before + after)
#    post-restore count should equal (pre-loss count + fresh invoices created during recovery window)
#    Finance signs off on ledger totals.

# 6. Delete PITR recovery branch after 72h retention for audit trail
pscale branch delete mytenant_invoice recovery-org-S2aF --force --wait
```

### 3.2 Runbook R-2: Full DB Restore (T0, T1 — region loss/corruption)

Prerequisites:
- Failover DNS TTL set to 60s on `app.mytenant-invoice.com`
- Warm standby PlanetScale cluster in us-west-2 with continuous replication (async < 1 s)

Steps:
1. **Declare incident** — Opsgenie SEV1 page, Statuspage set to "Major Outage"
2. **Freeze writes** — Flip `FEATURE_FLAGS` → `READ_ONLY_MODE=true` via emergency Vercel env redeploy (prevents split brain)
3. **Promote standby** — In PlanetScale UI: Cluster `mytenant_invoice-west` → Promote → make writable primary
4. **Repoint app DB env var** — `vercel env add DATABASE_URL <new-primary-string> production --yes` + `vercel env add DIRECT_URL … production --yes`
5. **Redeploy** — `vercel --prod --force` (or trigger pipeline workflow_dispatch for `deploy-production`)
6. **Catch up any lost writes** (if async lag had data in flight):
   - Extract diff from binlog of old primary (if reachable)
   - OR use Stripe Sigma to replay missed payment events into our DB via `scripts/stripe-replay.ts`
7. **Verify smoke tests pass** (see `deployment.md §6`)
8. **Flip read-only off**, announce all-clear.

### 3.3 Runbook R-3: Vercel Compute Outage (T3)

1. Confirm with Vercel status page → Major incident on us-east-1.
2. Route traffic to DR deploy: `app-dr.mytenant-invoice.com` — warm stand-by deployed simultaneously on `us-west-2` via secondary Vercel project.
3. DNS failover via Cloudflare Load Balancer (geo + health-check based) → active on DR project within 60s TTL.
4. DB still same PlanetScale primary, Upstash still global — no data state change.
5. After Vercel all-clear, wait 30 min then fail back gradually (5%, 25%, 50%, 100% weights).

### 3.4 Runbook R-4: Redis Cluster Loss (T4)

1. Redis down → sessions temporarily break, queues stop, rate limits go into fail-open mode.
2. App code already has graceful degradation (env `REDIS_FAIL_OPEN=true` auto-set by Helm on repeated connection failures):
   - Sessions: fall back to signed JWT cookie-only (shorter TTL = 30 min) via middleware
   - BullMQ: falls back to direct in-memory queue (single instance, not distributed — acceptable for 1h)
3. Upstash support engaged via enterprise PagerDuty integration (15 min response SLA).
4. Once Redis returns, `redis-cli -u <new-url>` — restore latest RDB snapshot to new cluster (or let Upstash do it).
5. Run `scripts/rebuild-queue-from-mysql-journal.sh` to rehydrate BullMQ jobs we queued in-memory/DB.

---

## 4. Quarterly DR Drill

A full DR exercise is required every calendar quarter per SRE charter. Results go in `docs/disaster-recovery/dr-drill-YYYY-QN.md`:

| Drill Scenario            | Cadence      | Validates                | Responsible       |
|---------------------------|--------------|--------------------------|-------------------|
| PITR of 1 tenant's invoices | Monthly    | R-1 runbook accuracy     | Platform team     |
| Full DB failover to standby | Quarterly  | R-2, T0 RPO 1h / RTO 4h  | SRE + DB admin    |
| Vercel DR failover        | Quarterly    | R-3 runbook              | DevOps lead       |
| Redis loss simulation     | Every 6 mo   | R-4, fail-open behavior  | SRE               |
| Stripe API failure mock   | Every 6 mo   | T5 recovery, UI messaging | Finance + Eng    |
| Secret rotation drill     | Quarterly    | §5 runbook + zero downtime| Sec + DevOps    |

Pass/Fail: **Pass only if RPO/RTO targets are actually met** (not just "we could do it").

---

## 5. Secret Rotation Runbook

All secrets in scope: DB passwords, AUTH_SECRET, Stripe API keys, Redis tokens, Resend API key, Sentry tokens.
**Goal:** Rotate any secret within 60 minutes of disclosure, with zero downtime (dual-write window).

```
Step-by-step (example: DATABASE_URL rotation):

1. Generate NEW credential in PlanetScale → password-create with same role.
2. In Vercel Project: env → add a SECOND DATABASE_URL (label it new-creds) —
   BUT our app only reads DATABASE_URL. For dual-write, enable our lib/db/rotating-client:
     → when both DATABASE_URL and DATABASE_URL_LEGACY are set, client tries DATABASE_URL first and falls back.
3. Deploy a canary: set NEXT_PUBLIC_FLAGS_ROTATION_DB=canary; 5% traffic uses new cred.
4. Validate 30 min: no connection errors, PlanetScale new user login events visible.
5. Flip all traffic: remove _LEGACY suffix logic, keep only new key.
6. Revoke OLD password in PlanetScale after 24h (leaves time for any lingering function containers).
7. Record in 1Password audit log + change control ticket.
```

Critical note on `AUTH_SECRET` rotation: users are NOT logged out if you use dual-sign-off (accept old+new) for at least 1 session TTL (default 30 days). Implementation in `src/auth.ts`:
```ts
// For rotation window, accept signatures from BOTH secrets:
signingKeys: [
  process.env.AUTH_SECRET_NEW!,
  process.env.AUTH_SECRET_LEGACY!,
]
```

---

## 6. Communication During DR Incident

| Audience              | Channel                        | Frequency               | Template |
|-----------------------|--------------------------------|-------------------------|----------|
| Eng teams             | Slack #prod-incidents          | every 15 min SEV1, hourly SEV2 | `[STATUS UPDATE] SEV1 T0: us-east DB down — eta 20 min for failover` |
| Executive stakeholders| Slack #exec-leadership         | every 1 hour, executive summary only | same title, 1 paragraph + ETA |
| Customers             | status.cromstelit.com + email  | every 2 hours minimum   | Statuspage template |
| Paying Enterprise     | Dedicated CSM call within 1 hr of SEV1 | once per SEV1 + closeout | CSM playbook |
| Regulators (if breach)| Legal → external counsel       | within 72h per GDPR/CCPA | Legal template |
