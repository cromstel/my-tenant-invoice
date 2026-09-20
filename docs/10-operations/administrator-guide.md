# Platform Super Administrator Guide

**For:** CromStel IT Group — Platform Operations, SREs, Platform Superadmins
**Last Updated:** 2026-09-20
**System:** myTenant Invoice SaaS — Multi-Tenant Platform Administration

---

## 1. Superadmin Role Definition

The Platform Superadmin (role: `platform_superadmin`) is the highest-access role in the myTenant Invoice system. Platform Superadmins operate **across organizations and tenants**, with the ability to manage the entire platform. Number of superadmins is limited (≤ 5 people, per security policy) and all actions are logged in the platform-level audit log.

**Principle of Least Privilege:** Use the minimum-scope role possible for the task. If an action can be done by an org admin, NEVER do it as a superadmin.

---

## 2. Accessing the Superadmin Console

1. Navigate to `https://app.mytenant-invoice.com/login` → authenticate with SSO (Okta, required for superadmins — no password logins).
2. Click your profile avatar (top-right) → **Switch Console → Platform Superadmin Console**.
   - This option only appears if your user has `role=platform_superadmin` on the root org (id: `org_CROMSTEL_PLATFORM`).
3. First-time access: You MUST enable MFA via TOTP (Google Authenticator / 1Password) before any action is permitted. Prompt appears automatically.

**Session controls for superadmins:**
- Max session length: 4 hours (auto-logout)
- IP allow-listed: Only CromStel IT office VPN / corporate network ranges
- Admin re-auth required: Every 30 minutes for destructive actions (delete org, revoke role, edit billing)
- All superadmin sessions logged in `audit_logs` with `actor_platform=true`

---

## 3. Core Superadmin Tasks

### 3.1 Organization (Customer) Lifecycle

#### 3.1.1 Create a New Paying Organization

Click **Organizations → New Organization**:

| Field                    | Example Value                         | Notes                                                                  |
|--------------------------|---------------------------------------|------------------------------------------------------------------------|
| Display Name             | "Acme Property Management LLC"        | Official business name; shown on invoices                              |
| Legal Name               | "Acme Property Management LLC, DE"    | Matches Stripe Connect legal entity                                    |
| Admin Email              | "owner@acme-prop.com"                 | Invitation sent to this address; they set password                     |
| Admin Full Name          | "Jane Doe"                            | Admin's human name (for the welcome email)                             |
| Country                  | "United States"                       | Tied to Stripe tax location + tax behavior                             |
| Plan Tier                | `Enterprise` (or `Standard`/`Free`)   | Determines feature flags + billing credits                             |
| Custom Subdomain         | `acme` → `acme.mytenant-invoice.com`  | Optional, customer-branded                                             |
| Custom Domain            | `billing.acmeprop.com`                | Requires customer to add CNAME → vercel + verify in 10 minutes        |
| Trial Ends At            | +14 days from today                   | Default for Enterprise; leave empty to bill immediately               |
| Billing Provider         | Stripe (Connect onboarding link)      | Send via invite; Stripe account linked to org                          |

**After-save automation triggers automatically:**
1. Welcome email to Admin Email with magic sign-in link (valid 7 days)
2. Stripe Connect onboarding URL generated; embedded in first-run wizard
3. Default tenant "HQ" created with seed data roles + base tariff
4. 3x default user roles copied into org: Org Admin, Property Manager, Accountant
5. Slack notification to #new-customers: "New org: Acme Property Management (Enterprise) — Jane Doe owner@acme-prop.com"

#### 3.1.2 View & Modify Existing Organization

**Organizations → {Name} → Overview tab** shows:
- Org KPI: Active tenants, invoices this month, ARR, last login, Stripe Connect status
- Feature flags (override per org):
  ```
  MULTI_CURRENCY           ON/OFF  toggle
  CUSTOM_BRANDING          ON/OFF  toggle (Standard+ only)
  ADVANCED_REPORTING       ON/OFF  toggle (Enterprise only)
  API_ACCESS               ON/OFF  toggle (Standard+ only)
  SSO_SAML                 ON/OFF  toggle (Enterprise only)
  ```
- Usage caps (hard limits):
  - Max tenants: 50 / 500 / unlimited by tier
  - Max users per org: 25 / 250 / unlimited
  - API rate limit: 300 / 3000 / unlimited req/min

**Edit Organization fields:** Legal Name / Country changes required **stored as support ticket**, not direct-edit (tax + compliance risk). Click "Request Update" to create ticket for Finance review.

#### 3.1.3 Suspend / Un-suspend / Terminate Organization

Suspend (temporary, non-payment or TOS violation):
1. Organizations → {Name} → ⚠️ Actions → Suspend
2. Select reason: `Non-payment` / `TOS Violation` / `Security Incident` / `Customer Request`
3. Enter ticket/incident reference: `INC-1042 / FIN-221`
4. Effect: Org admins see "Account Suspended" page; all tenant logins disabled; all async jobs (invoices, reminders) paused but NOT deleted; Stripe subscriptions paused.

Un-suspend: Actions → Un-suspend. Resumes all paused jobs from where they left off (invoices scheduled for during suspension are run retroactively with backdate — configurable).

Terminate (irreversible, 30-day grace period):
1. **Mandatory 2-eyes approval:** Requires a second superadmin to click "Approve Termination" (dual-control).
2. Click Actions → Terminate.
3. Timeline:
   - Day 0: Org disabled. All data frozen.
   - Day 1-29: Customer can request export (all data as CSV+PDF bundle).
   - Day 30: Hard delete (sanitized, per GDPR/CCPA). Logs retained 7 years for compliance.
   - You can reverse within first 29 days → Actions → Restore Termination Pending.

### 3.2 Tenant-Level Actions (Rare)

Usually done by org admins. Only use when org admin is unreachable:
- **Tenant → Reset** (wipe data, keep tenant shell): support ticket # required
- **Tenant → Merge tenant B into tenant A** (complex, one-off script, runbook in `tools/merge-tenants.md`)
- **Tenant → Export package**: Same export as org admin, run by support on customer's behalf

### 3.3 Platform-Level User Impersonation (Support Use Case)

1. Users → Find user → **⋯ → Impersonate**
2. Legal acceptance prompt appears: "I confirm I am impersonating to resolve a support ticket #______ and have customer consent where required." Logged in audit.
3. Browser opens in a new incognito-style window with their view. Any actions taken tagged with `impersonated_by=<your id>` in audit logs.
4. **End Impersonation** button (top-right red banner) → returns to superadmin console.

---

## 4. Billing & Platform Finance Administration

### 4.1 Review Customer Invoices to CromStel IT Group (Platform Billing)

**Billing → Customer Invoices:**
- CromStel IT's platform charges to customer orgs (SaaS subscription fees, overage, per-use)
- Auto-generated on the 1st of each month
- Payment status syncs with Stripe (Connect payouts)
- Actions:
  - Credit Note: Issue partial/full credit with reason (goodwill / SLA credit / refund)
  - Write Off: Mark uncollectable (bad debt) — Finance approval required
  - Resend: Send via email again

### 4.2 Tariff Catalog Management

**Platform Catalog → Tariffs** (template tariffs that org admins can import into their own tenants):
- Maintain 30+ standard tariff templates (US water/sewer/trash, UK council tax, EU VAT, SG GST, etc.)
- Edit template tariff → change propagates to tenants that have "Auto-update platform catalog" ON (opt-in)
- New tariff version: always semver, changelog required. Customers with old version see "Update available" banner.

### 4.3 Tax Region Updates

Monthly, before 1st of month rollover:
1. **Billing → Tax Regions → Sync with Avalara API** (tax tables)
2. Preview affected orgs (by country/state).
3. Apply. Logged as superadmin action. Email summary to finance@cromstelit.com of all changes.

---

## 5. Platform Configuration & Feature Rollout

### 5.1 Global Feature Flags

**Settings → Feature Flags:**

| Flag                | Default | Description                                    | Rollout Strategy                          |
|---------------------|---------|------------------------------------------------|-------------------------------------------|
| `GLOBAL_LATE_FEES_V2` | OFF   | New late-fee calculation engine with compounding | 5% → 25% → 50% → 100% over 2 weeks per cohort of orgs |
| `PAY_APPLE_PAY`     | OFF     | Apple Pay wallet support on payment page       | Regional: US → EU → rest of world        |
| `MFA_ENFORCED_ALL`  | OFF     | Require MFA for every user on every org        | Enterprise pilot → required for all 2026Q4 |
| `NEW_ONBOARDING_FLOW` | OFF   | Refreshed 4-step onboarding flow               | A/B test 50/50 on new orgs → rollout     |

Rollout pattern for each new flag:
1. `OFF` globally → turn `ON` for 1 test org (internal CromStel dogfood org)
2. Verify 48h in staging + production dogfood
3. Turn ON for 5% orgs (random cohort) — monitor Sentry + errors for 24h
4. 25%, 50%, 100% each 24 hours, halt if any elevated error signal

### 5.2 System-Wide Announcements (Banners)

**Settings → Announcements:**
- Create maintenance banner: "Scheduled maintenance Sat Sept 28, 02:00–04:00 UTC — 5 min downtime expected"
- Types: `Info` (blue), `Warning` (orange), `Maintenance` (purple), `Incident` (red)
- Targeting: All users → only superadmins → specific org list
- Expires at: auto-hide after timestamp

---

## 6. Security, Access Control, & Audit

### 6.1 Audit Log Review (Daily/Weekly)

**Audit → Platform Logs**
Filters: `actor_platform = true` OR `action IN (login_failed, org_delete, user_role_change, payment_refund, tariff_change, export_data)`
Review cadence:
- Daily (Security T1): Last 24h of superadmin actions, logins from new IPs, failed MFA attempts
- Weekly (Security T2): Audit of privilege escalations, bulk exports, org terminations
- Monthly (external): SOC 2 auditor review log sample

Sample query filter to detect risky actions:
```
action=(suspend_org OR terminate_org OR user_impersonate OR role_grant AND role=platform_superadmin)
```

**Retain logs: 7 years immutable (WORM S3 bucket + PlanetScale PITR)** — compliant with SOX/SOC 2.

### 6.2 Role Assignment & Revocation

**Roles → Assign Role** — You CANNOT grant `platform_superadmin` to yourself; another superadmin MUST grant to you (dual-control).

Granting workflow:
1. Open ticket for access request → approved by CTO or VP Engineering
2. Ticket linked during role grant (required field)
3. Default expiration for temporary access: 7 days (auto-revoke; optional permanent for permanent team members)
4. Slack DM to user: "You've been granted Platform Superadmin access until <date>."

Revocation:
- Immediate for offboarding, or expiration
- Session invalidated within 60s on revoke (all JWTs re-checked against roles table)

### 6.3 SAML / SSO Configuration (Customer-Level Platform Feature)

**Settings → SSO Integrations:**
- Add new Okta / Azure AD / Google Workspace SAML app → upload metadata XML
- Attribute mapping: email, first/last name, department, external ID
- **Test login button:** Attempt SSO as dummy user — capture SAML response for debugging
- After activation: user passwords disabled for that org; all login flow goes through IdP

---

## 7. Jobs & Platform Maintenance Tasks

### 7.1 Platform Cron Jobs Status

**Jobs → Scheduled Jobs:** Overview of platform-wide crons (distinct from per-org/tenant crons):

| Job Name                      | Schedule     | Last Result | Action if Failed                          |
|-------------------------------|--------------|-------------|-------------------------------------------|
| `cron-platform-invoice`       | 1st 00:10 UTC| Success     | Run manually, verify invoice batch totals against finance report |
| `cron-platform-payouts`       | Daily 06:00  | Success     | Engage Finance; do NOT run twice (duplicate risk) |
| `cron-usage-metering`         | Hourly :05   | Success     | Check Upstash Redis counters; retry window 6h |
| `cron-vat-tax-update`         | 1st of month 03:00 | Success | Engage Tax team if Avalara API error      |
| `cron-db-optimize-tables`     | Sun 02:00 UTC | Success   | PlanetScale auto-vacuum; only intervene if logs show > 1h |

### 7.2 Manual Job Runs (Fixups)

**Jobs → Run Manual Job** dropdown:
- `Backfill invoices for org {orgId} during {month}` — use if invoice cron partially failed for 1 org
- `Re-send failed webhooks` — replays from `webhook_events` table where `retry_count = max and failed`
- `Recalculate balances for tenant {tenantId}` — fixes ledger desync
- **WARNING: all manual jobs show confirmation dialog with projected # rows affected + require 2nd superadmin approval if ≥ 1000 rows**

---

## 8. Emergency Platform-Wide Controls (Break-Glass, SEV1)

Located at **Settings → Emergency Controls**. Each action requires superadmin password re-prompt + incident ticket #.

| Control                          | Effect                                                                  | When To Use                                              |
|----------------------------------|-------------------------------------------------------------------------|----------------------------------------------------------|
| **Platform Read-Only Mode**      | Disables all writes site-wide; users can view only. In-progress writes fail-safe (retried after toggle-off). | SEV1 DB corruption; bad migration; DB restore in progress |
| **Disable All Logins Except Superadmins** | Blocks all non-superadmin auth. Shows "Scheduled Maintenance" page. | Active security incident; user credential leak; zero-day under remediation |
| **Suspend All Payment Processing**   | Payment pages show "Temporarily unavailable"; Stripe webhooks held. Auto-resumes in 24h. | Stripe API issue; suspected fraudulent batch; billing calculation bug found |
| **Force Logout All Sessions**    | All users logged out. MFA re-challenge on next login.                  | Confirmed session compromise (cookie/XSS); Auth secret rotation in progress |
