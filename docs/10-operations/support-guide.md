# Support Team Operations Guide — CromStel IT Group myTenant Invoice

**For:** Tier-1/Tier-2 Support Agents at CromStel IT Group + Certified Support Staff at Customer Orgs
**Last Updated:** 2026-09-20
**Escalation SLA Matrix:** §4

---

## 1. Support Scope & Channels

### 1.1 What We Support

| Tier 1 — First Contact (L1)            | Tier 2 — Technical/Platform (L2)            | Tier 3 — Engineering/DevOps (L3)         |
|----------------------------------------|---------------------------------------------|------------------------------------------|
| Login & password resets                | Billing calculation discrepancies           | Outage response / SEV1/SEV2              |
| Portal navigation, how-to questions    | Integration config (QuickBooks, SSO)        | Bug analysis + hotfix deployment         |
| Feature explainers, documentation      | Org/tenant configuration walk-throughs      | Database-level data repairs              |
| Invoice status lookup                  | Failed payment troubleshooting (non-fraud)  | Performance investigation                |
| Impersonation + repro of user bugs     | CSV imports, data migrations                | Root cause + permanent fix (RCA author)  |
| Raise tickets / bug reports            | Workflow design & best-practice advice      | Feature flag toggles (emergency only)    |

### 1.2 Support Channels

| Channel             | Target Audience          | Hours              | SLA First Response   |
|---------------------|--------------------------|--------------------|----------------------|
| **In-app chat**     | All users (payers + admins) | 24/7            | L1 ≤ 15 min          |
| **Email support@mytenant-invoice.com** | All       | 24/7 (email)       | L1 ≤ 1 hr            |
| **Phone (+1-800-###-####)** | Enterprise only | 24/7 (eng IVR → on-call SEV1) | Enterprise ≤ 2 min |
| **Slack Connect**   | Enterprise named accounts | M-F 8am-8pm ET  | Named CSM ≤ 30 min   |
| **Statuspage**      | All (outages)            | Automated updates  | Incident post every 15 min SEV1 |
| **Community Forum** | Free Tier                | Community Sourced  | N/A                  |

---

## 2. Agent Tooling & Access Levels

### 2.1 Tools Used Per Shift

| Tool                    | Purpose                                         | Access Level by Tier          |
|-------------------------|-------------------------------------------------|-------------------------------|
| Zendesk                 | Ticket system, SLAs, macros, triggers           | L1/L2 full, L3 view-only      |
| Superadmin Console (impersonate) | Reproduce customer environment         | L2+ only, dual-audit trail    |
| Sentry                  | Look up errors by orgId / tenantId / userEmail  | L2+, L1 links to issues       |
| PlanetScale Console (read-only) | Query tenant data with canned reports      | L2 read-only, L3 read-write   |
| Upstash Console         | Redis session lookup, queue depth               | L3 only                       |
| Stripe Dashboard (Connect platform) | Payment details, refund, void         | L2+ with manager approval for $ actions |
| Resend Dashboard        | Resend failed email, view delivery events       | L2+                           |
| 1Password Secrets       | Shared team vault for break-glass only         | L3+ DevOps                    |
| PagerDuty               | On-call routing, incident timelines             | L3 on-call, L2 shadow         |

### 2.2 Impersonation Workflow

For bug reproduction or configuration help for a specific tenant/user:

1. Confirm identity of requesting user (6-digit pin from profile page, or confirmed org domain email match)
2. Log Zendesk ticket ID + customer consent in the required field
3. Superadmin Console → Users → find → **Impersonate**
4. Browser opens isolated window, all actions tagged `impersonated_by=<agent_id>`
5. After session, click red End Impersonation banner; close isolated window
6. Audit log entry retained 7 years; monthly review

---

## 3. Ticket Triage Workflow

### 3.1 Classification — Priority Matrix

Use this matrix to set ticket priority; NEVER ask customer to "tell me priority."

| Impact \ Urgency  | Low (How-to, general Q) | Medium (Annoying bug, workaround exists) | High (Feature broken, no workaround) | Critical (Revenue, data, security) |
|-------------------|-------------------------|------------------------------------------|--------------------------------------|-------------------------------------|
| **Single user**   | P4 / 3 business days    | P3 / 1 business day                      | P2 / 4 hrs                           | P1 / 1 hr → SRE page                |
| **1 tenant**      | P4 / 2 business days    | P3 / same business day                   | P2 / 2 hrs                           | P1 / 30 min → page                  |
| **Entire org**    | P3 / 1 business day     | P2 / 4 hrs                               | P2 / 1 hr                            | P1 / SEV2 → page L2 lead            |
| **Multi-org / Platform** | P3 / same day    | P2 / 2 hrs                               | P1 / SEV2 → 30 min                   | P1 / SEV1 → immediate SRE page      |

### 3.2 Tags (Mandatory)

Every ticket gets tagged with **at least** one from each category:

| Category      | Required Tag Values                                                                 |
|---------------|-------------------------------------------------------------------------------------|
| **Module**    | `authentication`, `billing`, `invoicing`, `payments`, `tenants`, `users-rbac`, `email-notif`, `pdf`, `integrations`, `maintenance-module`, `api`, `ui-bug`, `perf`, `other` |
| **Severity**  | `sev-low`, `sev-med`, `sev-high`, `sev-critical`                                    |
| **Tenant**    | `free`, `standard`, `enterprise` (tier, for SLA priority weighting)                  |
| **Source**    | `chat`, `email`, `phone`, `in-app`, `slack-connect`, `proactive-alert`              |

### 3.3 Zendesk Macro Library (L1 Cheat Codes)

| Macro Name                         | Use When                                      | Actions Triggered                                              |
|------------------------------------|-----------------------------------------------|----------------------------------------------------------------|
| `Auth · Password Reset`            | User can't login                               | Resets + sends templated email with reset link                 |
| `Invoice · Regenerate PDF`         | Customer says PDF missing/corrupt             | Runs job queue `pdf-generate` for invoiceId                    |
| `Email · Re-send invoice`          | User claims invoice email never received      | Resends via Resend; pulls latest from `email_events` table     |
| `Stuck Job · Retry failed webhook` | Payment posted on Stripe but invoice unpaid   | Replays Stripe webhook from our events table                   |
| `Import · Bad CSV template`        | CSV upload fails validation                   | Sends correct CSV template + column guide PDF                  |
| `Escalate L2 · Billing Discrepancy`| Amount/line item wrong                        | Assigns to L2-billing queue, attaches auto-generated org P&L snapshot |
| `Escalate L3 · Platform Bug`       | Reproducible bug, no workaround               | Creates GitHub issue (via ZD→GH integration) with repro steps  |

---

## 4. Escalation Matrix

### 4.1 L1 → L2 Escalation

L1 escalates to L2 IMMEDIATELY if:
- Customer requested L2 (named enterprise support)
- > 2 replies back and forth without resolution
- Ticket is tagged `sev-high` or `sev-critical`
- Requires access to L2-only tools (Sentry traces, DB queries, Stripe)
- Requires impersonation to reproduce

**Escalation handoff MUST contain:**
- Zendesk link + customer identity verified
- Steps to reproduce (numbered)
- Expected vs actual result
- Evidence: screenshot, HAR file (if front-end), correlationId from logs
- What L1 already tried

### 4.2 L2 → L3 Escalation (Engineering On-Call)

L2 escalates to L3/PagerDuty ONLY if:
- Sev = `sev-critical` → page immediately
- Sev = `sev-high` AND no workaround exists AND L2 has spent 2 hours on it
- Confirmed platform-level bug: reproducible on multiple orgs
- Data integrity issue: numbers do not add up; ledger desync; wrong amount charged
- Security issue: suspected unauthorized access, PII leak, fraud indicator → use Security Incident procedure (§7)

**L2 → L3 handoff MUST contain (link to pre-filled bug report):**
- Sentry URL / eventID (if error)
- PlanetScale query link (reproduces wrong data)
- Stripe charge/payment intent ID (if payment)
- TenantId, InvoiceId, UserId (use correct UUIDs, not emails)
- JSON payloads for API reproduction (curl command from customer HAR)

### 4.3 Response / Resolution SLAs (Contractual)

| Plan Tier      | First Response (P1) | First Response (P2) | Resolution P1 | Resolution P2 | Resolution P3 |
|----------------|---------------------|---------------------|---------------|---------------|---------------|
| **Free**       | N/A (community)     | N/A (community)     | N/A           | N/A           | Best effort   |
| **Standard**   | 1 business hour     | 4 business hours    | 24 hrs        | 5 business days | 10 days     |
| **Enterprise** | 15 min / 24x7       | 1 hr / 24x7         | 6 hrs         | 24 hrs        | 3 business days |
| **Enterprise+** (named) | 5 min       | 30 min              | 2 hrs         | 12 hrs        | 1 business day |

---

## 5. Payment & Billing Support Playbooks

### 5.1 Playbook: "I was double-charged" (Suspected Duplicate Payment)

1. **Verify:** Go to Stripe Dashboard → Customers → search by email → check for duplicate `payment_intent` with same `metadata.invoiceId` and timestamp < 300s apart.
2. **If true duplicate:**
   - Create refund for the duplicate amount via Stripe Dashboard (no Stripe fee on refund)
   - Void the extra payment in our system (runs ledger reversal)
   - Email customer receipt of refund + apology template `PAYMENTS · Refund Complete — Duplicate`
   - Log event in fraud monitor; if pattern, escalate to L3 for idempotency-key bug.
3. **If same amount but separate invoices:** Show customer both invoices with line items; explain.

### 5.2 Playbook: "Invoice Amount Is Wrong"

1. Pull tariff debug snapshot via Zendesk macro.
2. Verify line items:
   - Fixed charge: matches tariff?
   - Metered (water/electric): meter start/end reads correct? Correct unit rate?
   - Percentage tax: correct jurisdiction? Is tax-exempt flag set when it shouldn't be?
3. If genuine error:
   - **Credit Note** for overcharged amount (ledger correct; no refund triggered unless customer requests)
   - **Adjust Invoice** (Admin → Invoices → Adjust → L2 approval required for > $500)
   - **Recalculate** job run for future affected invoices
   - Create GitHub issue for root cause (tariff formula bug, tax table mismatch, etc.)
4. If customer is confused: Walk them through tariff line-by-line using tariff tooltips. Share PDF breakdown.

### 5.3 Playbook: "I never received invoice email"

1. Open Superadmin Console → Email Events → Search customer email for last 7 days.
2. Status code meanings:
   - `Delivered` → customer's mail server accepted; tell user to check Spam / Promotions / All Mail. Ask them to whitelist `@mytenant-invoice.com`.
   - `Bounced (hard)` → email invalid; confirm spelling; fix in user profile; re-send.
   - `Bounced (soft, mailbox full)` → inform customer their mailbox is full; re-send later.
   - `Complained` → customer hit Spam button! Only re-send if customer explicitly opts back in (compliance); open compliance ticket.
   - `Failed (provider error)` → Resend button (auto retries also scheduled: 1min, 5min, 15min, 1hr).
3. If ongoing issue, escalate to L2 to review Resend domain reputation + SenderScore.

---

## 6. Common Bug Workarounds (L1 Cheat Sheet)

| Symptom                                    | L1 Workaround (until fixed)                                                                      |
|--------------------------------------------|--------------------------------------------------------------------------------------------------|
| PDF download hangs on invoice              | Use **Regenerate PDF** macro; if fails, use "Email invoice to self" alternative in client portal |
| Dashboard shows wrong "total due"          | Click tenant → Actions → Recalculate Balances (macro)                                           |
| Autopay didn't trigger                     | Check if payment method expired; trigger **Charge Invoice Now** button (manual 1x)              |
| Stripe "Your card was declined" generic    | Advise user to try another card or ACH; if multiple fail → likely Stripe Radar fraud → escalate |
| Invite email to new user not received      | Resend invite macro; if second fail, create temporary magic sign-in link and send via chat/phone |
| CSV unit import says "Row 42: bad tariff"  | Use Tariff column name EXACTLY as shown in Tariff Library tab (case sensitive); trim whitespace |
| Bank (ACH) taking > 5 business days        | Normal for first-time ACH (Stripe ACH = 4-7 business days); if longer, escalate to L2-Stripe    |

---

## 7. Security Incident Response (SIRT Trigger)

**DO NOT discuss over public channels. Use Encrypted Slack #incident-security ONLY.**

Trigger L3+ SIRT page if ANY of the following are reported:
- Customer claims their account was accessed by a stranger (review audit log logins by geo)
- Suspicious payment activity on their org's behalf (multiple payouts to unknown bank)
- Agent accidentally saw another tenant's data while logged in (tenant isolation breach — highest priority)
- Suspected XSS/CSRF: "Invoice comment field rendered HTML/Script when I saved it"
- Suspected SQLi: "I typed `'` in search and got a 500 error"

SIRT First 10 Minutes (L1 + L2):
1. Open incident in PagerDuty: "Security Incident — <description>"
2. L3 on-call pages Security lead + CTO
3. If account compromise suspected: **FORCIBLY RESET** user/org sessions via Superadmin Emergency: Force-Logout All Sessions + reset password on file
4. Do NOT delete evidence (screenshots, emails, chat logs). Preserve in PagerDuty incident timeline.
5. L2 runs user-impersonation audit: check for actions by that user in last 72h.
6. Notify privacy@cromstelit.com for GDPR/CCPA assessment within 24h.
7. Monthly SIRT reports reviewed by the Security Committee.

---

## 8. Reporting & Shift Handoff

### 8.1 End-of-Shift Handoff Template (Required)

Posted in Slack #support-handoff every shift change:

```
EOD Shift Handover — 2026-09-20 US-Evening → APAC
───────────────────────────────────────────────────────────────
✅ CLOSED today (17):
   - #5421 Acme password reset — done
   - #5422 Wrong PDF — regenerated, customer satisfied

🔥 OPEN, high-priority, MUST be picked up next shift:
   - P1 #5430 / Org: Apex / Enterprise — 5 tenants not invoicing on schedule
     Repro: cron job 09-20 00:10 had deadlock; manual re-run fixed 3/5, 2 left
     L2: Maria started; Next steps: run scripts/retry-2-tenants.sql
     Correlation ID: ci_2a8ff3a7b0

📌 Monitoring status:
   - Stripe webhook elevated 4xx: 3% (Sentry: mytenant-invoice@PROD)
   - Otherwise: nominal.

📚 Remaining P3 backlog: 42 tickets (OK per SLA targets this week).
───────────────────────────────────────────────────────────────
```

### 8.2 Weekly Support Metrics Review (Mon 10am ET)

Report generated automatically by Zendesk Explore + Looker Studio Dashboard:
- CSAT (Customer Satisfaction Score): target ≥ 92%
- First-contact resolution: target ≥ 60%
- Ticket volume per category: identify which module needs engineering investment
- Backlog aging (P3 > 10d flagged for triage)
