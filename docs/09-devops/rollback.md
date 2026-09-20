# Rollback Playbook — Safe Code, Config, Data Reversals

**Document Owner:** CromStel IT Group — DevOps + SRE
**Last Updated:** 2026-09-20

---

## 1. Rollback Decision Tree

```
                  INCIDENT DETECTED
                        │
            ┌───────────▼───────────┐
            │  Is customer-facing? │
            └───┬───────────────┬───┘
               YES              NO
                │                │
         ┌──────▼──────┐   ┌─────▼──────────┐
         │ Severity?   │   │  SEV3 / SEV4   │
         └──┬──────┬───┘   │  Fix forward, │
          SEV1   SEV2      │  no rollback   │
            │       │      └────────────────┘
            ▼       ▼
  ┌──────────────────────────┐
  │  AUTOMATIC ROLLBACK?     │
  │  (Playwright smoke tests │
  │   failed post-deploy)    │
  └───────┬────────────┬─────┘
         YES           NO
          │             │
          │    ┌────────▼───────────┐
          │    │ Did deploy change: │
          │    │  1. DB schema?     │──► §5 Schema + Code Coordinated Rollback
          │    │  2. Env vars?      │──► §4 Config Rollback
          │    │  3. Features only? │──► §2 Code Rollback (Vercel Promote)
          │    └────────────────────┘
          │
  ┌───────▼───────────────────────────────────────────┐
  │ STEP 0: Announce in #prod-incidents + opsgenie    │
  │         "Executing rollback to deploy <id> — <reason>" │
  │ STEP 1: Execute rollback type per above           │
  │ STEP 2: Validate golden dashboard green           │
  │ STEP 3: Communicate all-clear + open retro ticket │
  └───────────────────────────────────────────────────┘
```

---

## 2. Rollback Type 1: Code-Only (No Schema / Env Changes) — < 30 seconds

**Trigger:** Bad deploy caused logic regression or frontend bug, no DB/env changes.

### 2.1 Automatic Rollback (On Post-Deploy Smoke Test Failure)

Handled in `.github/workflows/ci.yml` `deploy-production` job:

```yaml
      - name: Run post-deploy smoke tests
        id: smoke
        continue-on-error: true
        run:  npx playwright test tests/smoke --project=chromium --reporter=line
        env: { PLAYWRIGHT_TEST_BASE_URL: ${{ steps.deploy.outputs.url }} }

      - name: Rollback if smoke fails
        if:   steps.smoke.outcome == 'failure'
        run:  |
          echo "SMOKE FAILED → AUTOMATIC ROLLBACK"
          # 1. Fetch last-known-good production deployment URL
          LKG=$(vercel ls mytenant-invoice --prod --token $VERCEL_TOKEN --json | \
                jq -r '.deployments | map(select(.state=="READY" and .target=="production")) | .[1].url')
          # 2. Promote it (Vercel does atomic swap — 0 downtime)
          vercel promote $LKG --prod --token $VERCEL_TOKEN --yes
          # 3. Send page + Slack
          curl -H "Content-Type: application/json" -d '{"text":"🚨 AUTOMATIC ROLLBACK on '${GITHUB_SHA}'"}' $SLACK_WEBHOOK_URL
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_PROD_TOKEN }}
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_INCIDENTS_WEBHOOK }}
```

### 2.2 Manual Rollback via Vercel Dashboard

Click-through steps for on-call SRE:

1. Navigate: Vercel → mytenant-invoice → **Deployments** tab
2. Click the **second** deployment from the top (the one BEFORE the buggy one) — confirmed by timestamp / git sha / release tag
3. Click **⋯ (More)** → **Promote to Production**
4. Confirm dialog: "This will instantly swap production traffic with no downtime."
5. Confirm on your browser (hard refresh `⌘⇧R`) → old UI/logic present
6. Announce in Slack #prod-incidents: `✅ Rollback complete. Production now on <sha-old>. Root-cause investigation ongoing.`

### 2.3 Manual Rollback via Vercel CLI

```bash
# 1. Install CLI + authenticate
npm i -g vercel@latest && vercel login --token $VERCEL_PROD_TOKEN

# 2. List recent production deployments (most recent first)
vercel ls mytenant-invoice --prod --json | jq '.deployments[] | {uid, name, url, created, gitRef, state}'
#  [
#    {"uid":"dpl_1a", "name":"mytenant-invoice", "url":"mytenant-invoice-abc.vercel.app", "gitRef":"v1.4.2", "state":"READY"}, ← BAD (current)
#    {"uid":"dpl_2b", "name":"mytenant-invoice", "url":"mytenant-invoice-xyz.vercel.app", "gitRef":"v1.4.1", "state":"READY"}  ← LKG (rollback to this)
#  ]

# 3. Promote LKG atomically (< 10 s)
vercel promote dpl_2b --prod --token $VERCEL_PROD_TOKEN --yes

# 4. Validate
curl -sI https://app.mytenant-invoice.com/api/health | head -n1
# Expected: HTTP/2 200

# 5. Optional: send Sentry deploy marker (tags the rollback in issues)
sentry-cli releases set-status v1.4.2 aborted
sentry-cli releases --org cromstel-it-group --project mytenant-invoice new v1.4.2-rolledback
```

### 2.4 Rollback Completion Criteria (before announcing)

- [ ] API health endpoint returns `status=ok`, `version=<LKG-sha>`
- [ ] Top 5 revenue routes p50 < 500 ms AND error rate < 0.5% for 3 consecutive minutes
- [ ] Sentry new-issue-rate back to baseline (not elevated)
- [ ] BullMQ queue depth trending down (no poison message stuck)
- [ ] Spot check 3 orgs via support impersonation → dashboard loads, invoice list renders

---

## 3. Rollback Type 2: Feature Flag Reversal (Fastest Partial Rollback) — < 10 seconds

Before triggering a full rollback, check: **"Can this bug be isolated to a single feature flag?"**
If yes, flip the flag instead (fewer side effects, preserves other changes).

```json
// NEXT_PUBLIC_FLAGS override via Vercel env redeploy — no build needed
{
  "multiCurrency": true,
  "autoPay": false,          // ← caused bug, disabled
  "lateFeesV2": false
}
```

Deployment:
```bash
# Redeploy existing code with env var change (seconds)
vercel env rm NEXT_PUBLIC_FLAGS production --yes
vercel env add NEXT_PUBLIC_FLAGS production '{"multiCurrency":true,"autoPay":false,"lateFeesV2":false}'
vercel redeploy --prod --token $VERCEL_PROD_TOKEN --yes
```

---

## 4. Rollback Type 3: Environment Variables / Secrets Rollback — < 1 min

### 4.1 Config Rollback to Specific Snapshot

Vercel (since 2024.06) supports environment snapshots per deployment.
Restore env from the LKG deployment:

```bash
# 1. Download LKG env snapshot
vercel env pull .env.lkg --environment=production --git-branch=main --token=$VERCEL_PROD_TOKEN
#    ^^ Actually use: fetch env tied to SPECIFIC prior deployment ID:
curl -sH "Authorization: Bearer $VERCEL_PROD_TOKEN" \
  "https://api.vercel.com/v6/deployments/dpl_2b/env" | jq > env-lkg.json

# 2. Replace current prod env with LKG values
#    Loop through keys — safer to do this by env var name individually
for key in DATABASE_URL AUTH_SECRET STRIPE_SECRET_KEY NEXT_PUBLIC_FLAGS; do
  OLDVAL=$(jq -r --arg k "$key" '.[] | select(.key==$k) | .value' env-lkg.json)
  vercel env rm $key production --yes
  echo "$OLDVAL" | vercel env add $key production
done

# 3. Redeploy — uses LKG code + LKG env
vercel promote dpl_2b --prod --yes --token $VERCEL_PROD_TOKEN
```

### 4.2 Secret Emergency Rotation + Rollback

If rollback is being done BECAUSE a secret leaked (not a bad deploy), see `disaster-recovery.md §5 Secret Rotation Runbook` — it is a coordinated dual-write, NOT a pure rollback.

---

## 5. Rollback Type 4: Coordinated DB Schema + Code Rollback

**Most dangerous scenario.** Happens when a migration:
- Applied successfully in `deploy-production` job (`prisma migrate deploy` passed)
- But is causing severe latency or data errors
- AND data has already been written in new schema format

Rollback steps **in order** — do NOT skip step 0!

### 5.1 Step 0: Assess Migration Safety

| Migration Property | Safe to rollback (schema-only, no data loss)           | Unsafe (data movement) → open SEV1 + do §5.3 instead |
|--------------------|----------------------------------------------------------|------------------------------------------------------|
| `CREATE TABLE`     | ✅ Yes (drop table, no harm)                             | —                                                    |
| `CREATE INDEX CONCURRENTLY` | ✅ Yes (just drop index; takes 2-20 min)          | —                                                    |
| `ADD COLUMN NULL`   | ✅ Yes (drop column, new rows NULL)                      | —                                                    |
| `ADD COLUMN NOT NULL DEFAULT …` | ⚠️ CAUTION — data written has new default | If rollback, new rows retain default permanently (acceptable usually) |
| `DROP COLUMN`       | ❌ No (requires PITR restore)                            | §5.3 Point-in-time restore                           |
| `RENAME COLUMN`     | ❌ No (old code references old column, fails queries)    | Fix forward or §5.3                                  |
| `ALTER TYPE` (enum) | ⚠️ CAUTION — enums can only ADD values in MySQL safely   | Fix forward only                                     |
| `DATA MIGRATION` (UPDATEs, batch) | ❌ No — data mutated, rollback script required | §5.3 PITR + replay                                   |

### 5.2 Safe Schema Rollback Procedure

```bash
# 1. FREEZE WRITES to prevent data using new schema
#    Set read-only via flag or account-level (short outage < 2 min):
vercel env add READ_ONLY_MODE production 'true' && vercel redeploy --prod --yes

# 2. PlanetScale — revert schema diff (if Deploy Request model was used)
#    Find the latest closed Deploy Request → use 1-click "Revert schema" (within 30-min window).
pscale deploy-request revert mytenant_invoice 42 --org cromstel-it

#    If outside 30-min window or manual migration, apply manual DOWN migration:
npx prisma migrate resolve --rolled-back "20260920120000_add_tax_codes"
#    (This runs the DOWN() in the migration file — which you wrote!)

# 3. PROMOTE old code (the version BEFORE migration PR merged):
vercel promote dpl_LKG --prod --yes --token $VERCEL_PROD_TOKEN

# 4. UNFREEZE:
vercel env rm READ_ONLY_MODE production --yes
vercel redeploy --prod --yes

# 5. VERIFY (same as Type 1 §2.4) + monitor 30 min
```

### 5.3 Unsafe Migration (Data Loss Possible) — Full PITR + Code Restore

See `disaster-recovery.md §3.2 Runbook R-2` for detailed steps. High-level flow:

1. **Stop world:** Read-only mode on app → `READ_ONLY_MODE=true`
2. **Capture boundary:** Note UTC timestamp of freeze (to the second) → `2026-09-20 15:22:10 UTC`
3. **PITR:** Restore PlanetScale PITR snapshot to just-before migration at `2026-09-20 14:59:59 UTC` (before migration ran) → new branch `rollback-tax-codes`
4. **Promote branch:** Make `rollback-tax-codes` the production writable branch
5. **Repair lost writes:** Any writes between 14:59:59 and 15:22:10 are in a separate in-memory/queue journal. Replay them via `scripts/replay-writes-between --from … --to …` (validates each record doesn't already exist by ID uniqueness).
6. **Promote LKG code:** Same as §2.
7. **Finance verification:** Reconcile Stripe ledger vs DB ledger for the gap window.
8. **Unfreeze:** Disable read-only mode.

---

## 6. Rollback Type 5: Stale Cache / Bad Data Layer Rollback

Sometimes code is fine, but Redis cache is poisoned (e.g., corrupted tariff cache after bad import), causing widespread logic errors.

### 6.1 Targeted Cache Invalidation

```bash
# Connect to prod Redis via Upstash CLI or redis-cli:
redis-cli -u $REDIS_URL

# Purge tariff cache (targeted):
redis-cli EVAL "return redis.call('del', unpack(redis.call('keys', ARGV[1])))" 0 'tariff:*'

# Purge dashboard stats cache (targeted):
redis-cli EVAL "return redis.call('del', unpack(redis.call('keys', ARGV[1])))" 0 'dash_stats:*'
```

### 6.2 "Nuclear" Redis Reset (Rare)

ONLY if Redis is fully corrupted and every operation is producing bad data. You will lose:
- All sessions (users logged out → 1 hour of friction, acceptable during SEV1)
- Queued jobs (reconstructed from MySQL journal)

```bash
# FLUSHALL ASYNC is fast and non-blocking (Redis 7+):
redis-cli -u $REDIS_URL FLUSHALL ASYNC

# Immediately after, replay queue jobs:
npx tsx scripts/rebuild-queue-from-mysql-journal.ts all --start "-2 hours"
```

---

## 7. Rollback Post-Mortem Requirements

Every rollback requires:

1. **Immediate:** Slack thread in #prod-incidents with:
   - `Rollback trigger: (smoke test / SRE / engineer)`
   - `Deploy rolled FROM tag: v1.4.2 sha: abc123`
   - `Deploy rolled TO tag: v1.4.1 sha: xyz789`
   - `Duration: X min (detected at T0, traffic on LKG at T1)`
   - `Customer impact: N orgs, N% failed actions, N$ failed charges`
   - `Next step: Root cause ETA — T+60 min`

2. **Within 48 hours:** Blameless retro doc → `docs/postmortems/YYYY-MM-DD-rollback-<tag>.md`
   - 5 Whys
   - Timeline (UTC) with contributing factors
   - What monitoring should have caught it earlier
   - Corrective actions (issues created, assigned, due dates)
   - How to prevent same rollback type recurring (e.g., add another smoke test, shift-left the migration test)

3. **Within 7 days:** Rollback drill — engineering team reruns the rollback in staging to prove the runbook is still accurate, all steps work, duration meets SLA.

---

## 8. Rollback SLA & On-Call Expectations

| Rollback Type         | Decision Required By   | Execution Duration Target  | Who Performs                |
|-----------------------|------------------------|----------------------------|-----------------------------|
| Code-only (Vercel promote) | SRE on-call, 5 min from detection | ≤ 30 s           | Any on-call engineer        |
| Feature flag toggle   | SRE + PM agreement, verbal OK | ≤ 10 s               | SRE, or PM self-service via LaunchDarkly |
| Config rollback       | SRE on-call            | ≤ 1 min                    | SRE                         |
| Safe schema + code    | SRE + Platform approval | ≤ 5 min (w/ freeze window) | SRE + Platform team         |
| Unsafe / PITR         | SEV1 declared, CTO paged | ≤ 60 min total RTO       | SRE + DB Admin + CTO sign-off |
