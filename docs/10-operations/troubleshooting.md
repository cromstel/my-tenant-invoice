# Troubleshooting Guide — myTenant Invoice SaaS

**For:** Support Agents, SREs, On-Call Engineers, Organization Administrators
**Last Updated:** 2026-09-20
**Classification:** Internal & Customer-Approved excerpts

---

## 1. Troubleshooting Methodology

Use the **OSCAR** method for every issue before escalating:

1. **O**bserve: Reproduce the issue, collect screenshots/correlation IDs, exact timestamp.
2. **S**cope: 1 user? 1 tenant? Entire org? Multi-org? Global?
3. **C**heck dependencies: Status pages → Stripe, Vercel, PlanetScale, Upstash, Resend
4. **A**nalyze: Sentry, PlanetScale Insights, Vercel Logs, BullMQ job state
5. **R**esolve/RR (Root cause + Retrospective if SEV)

**Before each fix, answer: "What is the smallest, lowest-risk change that fixes this?"**

---

## 2. Authentication & Login Issues

### 2.1 "Invalid email or password" on login

| Check Step | Where                                                                            | Fix If Failed                                                     |
|------------|----------------------------------------------------------------------------------|-------------------------------------------------------------------|
| Email registered? | Superadmin → Users → search email                                           | Send invite / password reset                                      |
| Typo in email? | Check case sensitivity (`Jane.Smith@` vs `jane.smith@` — we lowercase on save) | User retries with correct email                                   |
| Org suspended? | Superadmin → Orgs → {org} → Status                                       | If suspended: un-suspend (non-payment) or contact billing         |
| Password hash present? | MySQL `users.password_hash IS NOT NULL WHERE email = ?`                  | Run `SET password_hash = NULL`, send password reset               |
| MFA challenge stuck? | Open DevTools → Application → Cookies → delete `next-auth.session-token` → retry | Re-enroll MFA via "Lost device?" flow                             |
| SSO SAML user cannot login | IdP logs → check SAML Response `InResponseTo`, `NameID`, signature | Re-upload IdP metadata, verify SAML signing cert not expired      |

### 2.2 "Session has expired" — constant logouts

**Causes:**
1. Upstash Redis connection flapping → sessions evicted
2. `AUTH_SECRET` rotated during deploy without dual-sign-off window
3. Browser cookie limit exceeded (extensions blocking 3rd-party cookies; we use 1st-party only)
4. Reverse proxy / WAF stripping `SameSite` attribute

**Fix check sequence:**
```
Vercel Logs → search "INVALID_SESSION_COOKIE"
   ↓ (if spike after deploy)
Check env: Did AUTH_SECRET change recently?
   → Add AUTH_SECRET_LEGACY back, dual-sign for 30 days (see DR §5)
   ↓ (else)
Upstash Metrics → Redis connection errors? Evictions > 0?
   → If evictions: scale Upstash tier. Immediate: flush least-used tariff cache.
   ↓ (else)
Vercel Headers → Check Set-Cookie in login response → SameSite=Lax; Secure; HttpOnly?
```

### 2.3 OAuth (Google / Microsoft) Callback 500

Check Vercel Logs for the callback route:
- `Invalid state` → CSRF cookie blocked by browser privacy setting. Advise user turn off "block third party cookies" or use password flow.
- `Mismatched redirect_uri` → Callback URL not registered in Google Cloud Console/Azure AD. Add exact URL from error.
- `Tenant restricted` → Azure AD has tenant restrictions. User must use their correct org AAD.

---

## 3. Invoice, Billing & Payment Issues

### 3.1 Invoice Not Generated On Expected Date

**Checklist:**

1. **Job ran at all?**
   ```
   Superadmin → Jobs → cron-invoice-generation-monthly
   Status on 2026-10-01 00:10 UTC?
   No  → Job missed (Vercel cron backlog). Retry manually.
   Yes → Continue.
   ```
2. **Tenant targeted?** Open the job's `input.json` for the run:
   - Does the tenantId appear in eligible array? `NO` → Check tenant `invoice_cycle.start_day` matches today?
   - Eligible but SKIPPED → Look for `skip_reason` in output. Most common:
     - "Tenant has no active tariffs or units" → Add units, assign tariffs.
     - "Previous month still unpaid & dunning_stopped = true" → Org settings → Enable "Send subsequent invoice even with prior unpaid".
3. **Generated but in `DRAFT`?** Check `invoice.status` = `DRAFT` (auto-approve flag off). Turn on auto-approve or bulk-approve.
4. **Generated but email failed?** Run Email Events → status for invoiceId. Re-send.

### 3.2 Wrong Amount / Wrong Line Items

**Debug formula:**
```
Invoice Total = Σ(unit tariffs on cycle date) + Σ(metered usage reads) + Σ(one-time charges/adjustments)
              - Σ(discounts)
              × (1 + tax% per line tax_code)
              + late_fees_from_previous
```

Common causes:
- **Metered (water/electric)** wrong reads
  - Fix: Superadmin → Meters → edit reading; or upload corrected CSV; regenerate invoice (with "Regenerate metered lines" checked).
- **Tax applied to non-taxable line**
  - Fix: Tariff Library → tariff row → uncheck "Taxable" or assign correct tax code; next invoice auto-fixed; current requires adjustment.
- **Wrong currency symbol**
  - Fix: Organization → Settings → Currency. WARNING: do NOT change currency after first invoice without L3 engineering (currency conversion FX needs historic rate snapshot).
- **Late fees double-counted**
  - Fix: Tariff rule `late_fee.apply_only_once_per_invoice=true` was disabled. Turn on; then issue credit for duplicate.

### 3.3 "Payment Failed" on Pay Button

| Customer-seeable error           | Root Cause (Most Likely)                | Fix                                                            |
|----------------------------------|-----------------------------------------|----------------------------------------------------------------|
| Card Declined — Generic          | Stripe Radar blocked as fraud           | Ask customer to retry or use different card; if card is good, L2 can whitelist customer by ID in Stripe Radar |
| Card Declined — Do Not Honor     | Customer bank declined (call bank)      | Tell customer: "Call number on back of card"                   |
| 3DS/SCA — popup stuck white      | Popup blocked by browser                | Disable ad-blockers / Brave Shields; use Chrome                |
| ACH — Instant Payout "Account Invalid" | Wrong Routing number (use Plaid link, not manual) | Re-run Plaid Link in safe mode |
| ACH — "Authorization failed"     | Insufficient balance                    | Try again in 48h; ACH debit retries 2 times auto               |
| "Webhook failed to record"       | Payment went through on Stripe but invoice still shows "UNPAID" | Zendesk Macro: Retry webhook. Runs replay from `stripe_events` table. NEVER click "Charge invoice" if customer already paid (duplicate risk). |

### 3.4 Double Charge (Duplicate Payment)

See Support Guide §5.1 — refund + ledger correction step-by-step.
Root cause engineering investigation: always check for missing idempotency key (header `Idempotency-Key` not re-used on front-end retry).

---

## 4. Email & PDF Delivery Issues

### 4.1 Email Not Delivered

**Flow to check:**
```
App → Resend API → (Resend SMTP relay: MX records → customer's mailbox)
```

1. **Superadmin Console → Email Events:** Search by recipient email + date range.
   - `Status: Delivered` → It's in their mailbox (spam/promotions usually). Whitelist instructions.
   - `Status: Bounced`
     - Hard bounce (no such address): **Stop sending.** Remove from list + tell user to fix email.
     - Soft bounce (mailbox full, domain temp error): Retry auto scheduled 3 times.
   - `Status: Complaint` → User marked spam. LEGAL: CANNOT resend unless explicit opt-in. Add to suppress list.
   - `Status: Failed` → Resend API error 5xx. Auto retry in 1/5/15 min. Exhausted → manual re-send button.
2. Check DMARC/SPF/DKIM for custom domain: `MXToolbox SuperTool`.
   - If DKIM "none": Resend domain not verified. Re-add DNS records.

### 4.2 PDF Generation: White Screen / Blank PDF

**Causes + Fixes:**

| Symptom                                  | Fix                                                                     |
|------------------------------------------|-------------------------------------------------------------------------|
| PDF always times out at 15s              | BullMQ pdf worker memory at 4096 MB; temporarily increase or reduce invoice # of pages by excluding paid invoices older than 12 months from bundle |
| Generated but corrupted (zero bytes)     | Retry via Macro. If happens frequently, check `@react-pdf/renderer` version + font issue (CJK? add Noto Sans CJK font to PDF assets folder) |
| Logo / brand image not showing           | Logo URL must be HTTPS + reachable public URL (no Vercel password protection) |
| Currency / date wrong locale             | Tenant → Settings → Locale set correctly; or override PDF locale per tenant |
| Decimal comma (EU) but dot displayed     | `LOCALE=de-DE` env var missing for that tenant in multi-tenant config  |

---

## 5. Performance (Slow) Issues

### 5.1 Slow Dashboard Loads (> 5 s)

```
Check order:
  1. CDN / Edge: Vercel Analytics → check response class (static? dynamic? SSR?)
  2. SSR render: Sentry transaction dashboard → find slow component
  3. DB queries: PlanetScale Insights → slow query digest for dashboard endpoint
  4. Redis cache hit ratio: Upstash → cache hit rate ≥ 85%?
```

Most common fixes:
- **Slow query:** Missing index on `invoices(tenantId, due_date, status)`. Add covering index (Prisma `@@index` + Deploy Request).
- **N+1:** Page loads 1 tenant, then 50 invoices × 3 line-item lookups. Fix with Prisma `include: { line_items: true }`.
- **Missed cache:** Tariff cache invalidated on every tariff edit (even unrelated) → change invalidation to per-tenant-specific key, not global.
- **Vercel cold start:** Too many dependencies → split route bundle; add idle concurrency for hot routes.

### 5.2 429 Too Many Requests (Rate Limited)

Check for "who's rate-limited":
1. **Per-tenant API limit (default 300 req/min)**
   - Org admin: Tenant → Settings → Rate Limits → bump (Standard/Enterprise only)
   - If legit traffic pattern: Add exponential backoff client-side (axios-retry)
2. **Per-IP login brute force (Upstash)**
   - Customer's VPN/office IP all hit the same limit → Add office IPs to allowlist in Superadmin Rate Limit rules
3. **Vercel Function concurrency limits**
   - Sustained 429 on API → Request Vercel Enterprise concurrency increase; enable Vercel Edge caching where possible

### 5.3 Intermittent 500 Errors (Transient)

Pattern analysis:
- Only during deploys (2 min window)? → Ignore; Vercel zero-downtime but in-flight requests on old code can 500 during env flip.
- Only on Tuesday 02:00–02:15 UTC? → Matches PlanetScale maintenance window — PlanetScale status page confirms.
- Random across all tenants?
  1. Check Upstash connection error rate (transient network).
  2. Check PlanetScale row-lock-timeout errors (deadlocks). Use optimistic locking or shorter transactions.

---

## 6. Data Import / CSV Issues

### 6.1 Units CSV Import Fails Validation

Download the error CSV (after import → download button). Each row shows column + error:
- **"Tariff 'Water-2026' not found"** → Typo; copy exact name from Tariff Library exactly (case/spaces sensitive).
- **"Invalid email: Jake@Acme"** → Missing TLD; use `jake@acme.com`
- **"Unit number duplicates"** → Same unit_number twice in CSV; deduplicate.
- **"Move-in date invalid: 2026-13-01"** → Month out of range; use ISO 8601 YYYY-MM-DD.
- **Blank rows:** Ensure no empty rows at end (Excel often adds them); delete last empty rows + save.

### 6.2 Import Succeeds but Missing 1 Row

The import auto-skips duplicate IDs (update-in-place logic). To see which were skipped:
Superadmin → Imports → {importId} → Diff Report tab. Shows skipped (updated-in-place) vs created vs failed counts.

---

## 7. Integration Failures

### 7.1 QuickBooks / Xero Sync Error

1. **OAuth expired:** Disconnect → reconnect OAuth flow (user must re-authorize). We auto-refresh short-lived tokens; but if >180 days unused, must manual reconnect.
2. **Chart of Accounts mismatch:** QB account "Rent Income" deleted. Fix in QB then retry sync.
3. **Invoice amount out of balance (QB error):** We post AR = sum(line items + tax). If tax was recalculated in QB differently (QB has own tax engine), use Superadmin toggle "Use QB tax calculation instead of platform".

### 7.2 Stripe Webhook Missed Events

Verify 4 things:
```
1. Stripe Dashboard → Webhooks → our endpoint → "Last success" status green?
2. Our env var STRIPE_WEBHOOK_SECRET matches exactly (whsec_...) what Stripe shows?
   Note: Each test/live endpoint has DIFFERENT secret.
3. Our /api/webhooks/stripe responds 200 within 3s?
   If > 3s: Stripe retries with exponential backoff → we receive duplicates, we deduplicate by event idempotency key.
4. In Sentry: errors tagged with context: "stripe-webhook"? Fix underlying bug first, then replay events via Macro.
```

---

## 8. Infrastructure / Dependency Failures

### 8.1 3rd-Party Service Down Diagnosis

**ALWAYS CHECK STATUSPAGES BEFORE DIVING INTO CODE:**

| Service    | Statuspage URL                        | Native integration alert into our incident channel? |
|------------|---------------------------------------|-----------------------------------------------------|
| Vercel     | vercel-status.com                     | Yes, Datadog integration                            |
| PlanetScale| status.planetscale.com                | Yes, Opsgenie heartbeat                             |
| Upstash    | status.upstash.com                    | Yes, direct Opsgenie                                |
| Stripe     | status.stripe.com                     | Yes, public RSS → #integrations Slack               |
| Resend     | status.resend.com                     | Yes                                                 |
| Sentry     | status.sentry.io                      | Yes                                                 |
| Cloudflare | www.cloudflarestatus.com              | Yes (if custom domain CF proxy)                     |

If status page says "Partial outage / Degraded":
- Don't debug. Set customer expectations: "Vendor <name> is currently experiencing service disruption — we are monitoring and will apply failovers as possible."
- Apply graceful degradation toggles if applicable (e.g., Redis down → fail open; SMTP fallback; etc.)

### 8.2 Vercel Deploy Hangs / Build Fails

Common causes + fixes:
- **Typecheck OOM:** `NODE_OPTIONS='--max-old-space-size=8192'` already set in workflow; If still OOM, split `tsconfig` project references.
- **Prisma client missing:** `npx prisma generate` not in install scripts. Fix: `vercel-build` hook in package.json → `"prisma generate && next build"`.
- **Env var undefined at build time:** Build-time env var missing in Vercel project. Remember: `NEXT_PUBLIC_*` vars are inlined at BUILD time; non `NEXT_PUBLIC_*` are runtime-only.
- **ESLint fails build:** ESLint config `reportUnusedDisableDirectives=true` can fail when deps upgrade. Fix directives or disable rule per-file.

### 8.3 Redis Memory Usage Spike

```
redis-cli -u $REDIS_URL --bigkeys        # find largest keys (tariff cache keys 1-5 GB?)
redis-cli -u $REDIS_URL memory stats     # check fragmentation ratio > 1.5?
```

Most likely culprits:
1. Dashboard stats cached forever (no TTL). Fix: scan + bulk set TTL.
2. BullMQ `completed`/`failed` jobs never purged. Fix: set `removeOnComplete: {count: 1000}` in queue options; run daily cleanup.
3. Stale sessions (user closed laptop, never explicitly logout). Fix: `sessions(userId, expiresAt)` compound index + daily purge of `expiresAt < now - 7d`.

---

## 9. When to Escalate Immediately (Do Not Troubleshoot Alone)

Escalate directly to L3/SRE on-call IF:
- Platform-wide outage confirmed (multiple orgs, login/payments down)
- **Tenant isolation breach visible:** Any user sees data they shouldn't (any org, any role)
- Financial impact ≥ $5,000 USD (actual or probable)
- Security indicators: XSS popups, unexpected admin actions, password reset spam flood
- You've run through entire Troubleshooting Guide above and still no root cause after 1h (P1) / 4h (P2)
