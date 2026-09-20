# Organization Admin Guide — Onboarding, Branding, RBAC

**For:** Organization Administrators (customers of CromStel IT Group using myTenant Invoice)
**Last Updated:** 2026-09-20
**Level:** Business User / IT Admin

---

## 1. Organization (Org) Overview

Your **Organization** represents your company (e.g., "Acme Property Management LLC"). Under it you can have:
- Multiple **Tenants** (e.g., properties: "Acme HQ Tower", "South Residences", "Industrial Park B") — billing is per tenant
- Multiple **Users** assigned to roles within the org and optionally within specific tenants
- Single **Billing Profile** (Stripe Connect) that pays for platform usage + collects tenant payments (optional)

---

## 2. Day 0 — Sign-Up & First-Run Onboarding

### 2.1 Sign-Up Paths

| Path                             | What Happens                                                                 |
|----------------------------------|------------------------------------------------------------------------------|
| CromStel sales-led               | You get an email: "Jane, welcome to myTenant Invoice. Activate your org" — click link, set password |
| Self-serve free tier             | `https://app.mytenant-invoice.com/signup` → fill form → verify email → org created (tier: Free, tenants ≤ 1) |

### 2.2 First-Login 4-Step Onboarding Wizard

**Every org admin sees this wizard the first login. Cannot be skipped (but steps can be edited later).**

```
Step 1 / 4: Organization Profile
  [x] Legal business name: _________________
  [x] Tax ID (EIN/VAT/GST): _________________
  [x] Country / Currency: [United States / USD ▾]
  [x] Timezone: [America/New_York ▾]          ← Invoice dates, cron times
  [x] Primary contact email, phone
  [ ] Save and Continue

Step 2 / 4: Create Your First Tenant
  [x] Property/Tenant name: "Acme HQ Tower"
  [x] Type: [Residential ▼]      (Residential / Commercial / Mixed / Industrial / HOA)
  [x] Address: 123 Main St, NYC, NY 10001
  [x] Number of units: 250       ← For reports
  [ ] Save and Continue

Step 3 / 4: Connect Payments — Stripe Connect Onboarding
  [Embedded Stripe Connect UI]
  → Business details (legal entity, tax info, owners >25% stake)
  → Bank account / debit card (payout destination)
  → Payout schedule: daily / weekly / monthly automatic
  Takes 2-3 minutes for US-based; up to 10 minutes international.
  Alternative: "I'll do this later" → invoices marked "Unpaid" until connected.

Step 4 / 4: Brand your portal
  [Upload logo]                 ← 500x500 PNG recommended, transparent bg
  [Primary brand color:] ▒▒▒▒   ← #22c55e (matches logo sample button)
  [Support email / phone / URL]
  [Custom domain]: "billing.acme-prop.com" ← optional; or use subdomain acme.mytenant-invoice.com
  [ ] Complete Setup → Redirected to dashboard
```

After onboarding:
- An automated "Welcome email" with quick-start links is sent to you and any invited co-admins
- Your Stripe account status is checked; if approved, the "Accept Live Payments" banner disappears
- The first Tenant's seed data populates (roles, default tariff categories, sample invoice for the first unit)

---

## 3. Branding & Customizing the Client Experience

### 3.1 Brand Assets

**Settings → Organization → Branding:**

| Setting                         | Where Appears                                                    | Spec                                       |
|---------------------------------|------------------------------------------------------------------|--------------------------------------------|
| Logo (Primary)                  | Login page, dashboard header, PDF invoices, email headers, client portal | 256×256 px, PNG/JPG, < 200 KB         |
| Logo (Inverse for dark bg)      | Same as above, but on dark email backgrounds                     | Same specs, different image if needed      |
| Favicon                         | Browser tab on all pages                                         | 32×32 ICO or PNG                           |
| Primary Color (Brand HEX)       | Buttons, headers, links in app + email + PDF                     | #RRGGBB; WCAG AA contrast enforced auto    |
| Accent Color                    | Highlights, badges                                               | Auto-derived or manual override            |
| Email Header Image              | Above invoice email copy                                         | 600×200 px, < 150 KB JPG                   |
| PDF Letterhead Header/Footer    | Printed PDF invoices                                             | 1-page layout; upload as PNG or HTML       |

### 3.2 Custom Domain

**Settings → Organization → Custom Domain:**
1. Enter domain: `billing.acme-prop.com` → Generate
2. System gives 2 DNS records to add at your DNS host (Cloudflare/GoDaddy/etc.):
   ```
   CNAME  billing.acme-prop.com    →   cname.vercel-dns.com
   TXT    _vercel.billing          →   vc-verify=xxxxTokenxxxx
   ```
3. Click "Verify DNS" (polls every minute). Usually < 5 minutes.
4. When verified, provision SSL (Let's Encrypt, auto-renewed) → done.
5. Old URLs redirect (301) to custom domain for login + tenant pages.

---

## 4. Role-Based Access Control (RBAC)

### 4.1 Default Roles (Shipped with Every Org)

| Role Name              | Permissions Scope                                                                                                | Typical Person        |
|------------------------|------------------------------------------------------------------------------------------------------------------|-----------------------|
| **Org Admin**          | Everything within this org: invite users, manage tenants, branding, billing, payouts, exports, delete records.  | Business Owner, IT    |
| **Property Manager**   | Manage 1 or more assigned tenants: create units, assign tariffs, send reminders, view reports (no payout/bank). | On-site PM            |
| **Accountant**         | Reconcile payments, export GL entries, view all financials; NO unit/tariff edits; NO user invites.              | CPA / Bookkeeper      |
| **Viewer (Read-Only)** | View dashboards, invoices, reports. No write access to anything.                                                | Auditor, Investor     |
| **Support Agent**      | Reset tenant-user passwords, respond to messages, view tickets. No financial access.                            | Customer support rep  |

### 4.2 Creating a Custom Role

**Team → Roles → New Role:**
1. Name + description (e.g., "Billing Specialist APAC")
2. Select permissions from tree (granular):
   ```
   Tenant Management
     ▢ Create tenant
     ▢ Edit tenant profile
     ▢ Delete tenant
   Invoice Management
     ▢ View invoices (all tenants / assigned)
     ▢ Create invoice
     ▢ Edit draft invoice
     ▢ Void paid invoice (🔒 dangerous — requires Org Admin sign-off when used)
     ▢ Download invoice PDF
   Financial
     ▢ View payout reports
     ▢ Initiate refund (🔒 requires Org Admin sign-off)
   Users & Team
     ▢ Invite user
     ▢ Assign role
   ```
3. Scope to specific tenants (e.g., "APAC Properties only") or leave as "All tenants"
4. Save → now visible when inviting users

### 4.3 Inviting & Onboarding Users

**Team → Invite User:**

1. Enter email(s), comma-separated: `jake@acme-prop.com, raj@acme-prop.com`
2. Assign role: `Property Manager`
3. Tenant scope: `[South Residences ✓, Industrial Park B ✓]` (unassigned = sees error)
4. Message (optional): "Welcome Jake — you'll manage South Res and Ind Park B."
5. Click "Send Invitations" — each gets email:
   ```
   Subject: Jake, join Acme Property Management on myTenant Invoice
   Body: Jane Doe invited you as Property Manager.
         [Accept Invitation] → set password → MFA prompt (recommended)
   ```
6. **Pending invites** visible in Team tab; resend/cancel buttons; 7-day expiry.

### 4.4 Removing / Offboarding Users

**Team → {User} → ⚙ Actions → Remove:**
- Option 1 (soft): **Disable account** — can re-enable later; audit trail preserved
- Option 2 (hard): **Permanently remove** — anonymize user; all actions attributed to "Deleted User <ID>" (GDPR compliant)
- Before removal: Reassign open tickets + units under management to another user (system prompts)

---

## 5. Tenant Management (Multi-Property / Multi-Business)

### 5.1 Add a New Tenant / Property

**Tenants → Add Tenant:** Same fields as onboarding step 2 (name, type, address, units).
You can also **Duplicate existing tenant**: copies tariff library, roles, and settings (not actual units/invoices/balances).

### 5.2 Tenant Settings

**Tenants → {Tenant} → Settings:**
- **General:** Name, address, contact, working hours, time zone
- **Branding (Enterprise):** Override org-level logo/color just for this tenant (for sub-brands)
- **Payments:** Payment methods accepted (card / ACH / wire / cash / check)
  - Late fees: Flat + % / grace period in days
  - Early payment discount: X% if paid Y days before due
- **Invoice Settings:**
  - Invoice number format: `INV-{YYYY}-{seq:05}` (editable pattern)
  - Default net terms: Net 30, Net 15, Due on Receipt, custom
  - Auto-send: Reminder 3 days before due, reminder on due date, dunning Day +1, +3, +7, +14
- **Notifications:** When to email/SMS tenant-users (invoice created, paid, overdue, new tariff, maintenance bill)
- **Integrations:** Property Management sync (Yardi, Entrata, Buildium CSV import/export), QuickBooks Online GL sync

---

## 6. Billing & Subscription Management

### 6.1 Your Platform Subscription (To CromStel IT)

**Settings → Billing & Plan:**
- Current plan: [Enterprise ▾] with renewal date, usage to date
- Included: 500 tenants, 25 users, $0.005/invoice overage
- Payment method: Card on file with CromStel; auto-charge 1st of month
- Download invoices (your subscription cost)
- Upgrade / Downgrade plan — prorated mid-cycle

### 6.2 Tenant Collection Settings (Payouts From Your Tenants)

**Payouts → Settings:**
- Payout schedule: Daily net (default Enterprise) / Weekly / Monthly net 15
- Minimum payout balance: $10 (smaller held until met)
- Reserve: 5% held for 45 days (for refunds/chargebacks) — adjustable
- Reconciliation: Export CSV for QuickBooks/Xero; direct sync toggle

---

## 7. Integrations

**Settings → Integrations Marketplace:**

| Integration               | Tier Required | Purpose                                                                 |
|---------------------------|---------------|-------------------------------------------------------------------------|
| QuickBooks Online / Xero  | Standard+     | Push invoices to GL, pull chart of accounts                             |
| Stripe Connect            | All           | Default (already enabled post-onboarding)                               |
| Yardi / Entrata CSV       | Enterprise    | Import rent rolls nightly                                               |
| Slack / Teams             | Standard+     | Notify org admins for new payments / overdue / support tickets          |
| Zapier / Make (Integromat)| Enterprise    | 200+ triggers/actions for custom automation                             |
| Google Workspace SSO      | Enterprise    | Domain-wide SAML SSO for your team                                      |
| Okta / Azure AD SSO       | Enterprise    | SAML 2.0; SCIM provisioning/de-provisioning                             |
| SendGrid / Mailgun        | All (opt)     | Custom email SMTP instead of Resend (use your own sending domain)       |

Each integration: Click **Add** → OAuth flow → Configure webhook events → Save. Status page per integration shows: Last sync, Last error, Re-sync button.

---

## 8. Data Export & Privacy (GDPR/CCPA)

**Settings → Privacy & Data:**
- **Full Data Export (Org):** Generates ZIP of all tenants' data (CSVs, PDFs, JSON) → ready in minutes to hours depending on size. Download for 7 days.
- **Per-Tenant Export:** Same but scoped to 1 tenant.
- **User Data Subject Request (DSAR):** Search by email → retrieve all their data; "Erase" (anonymize) option for GDPR delete requests. Logged, CromStel IT superadmin also notified for compliance.
- **Data Retention Policy:** By default, invoices retained 7 years; you can set custom shorter retention (risk: tax/audit liability if shorter than local laws require).

---

## 9. Getting Help As Org Admin

- In-app help (?) widget bottom-right: AI assistant, links to this guide, raise support ticket
- Enterprise Tier Customers: Dedicated CSM + Slack Connect channel + 1-hour SLA
- Standard Tier: Email support (24-hour response M-F 9a-5p local)
- Free Tier: Community forum only; no ticket support
- **Emergency (suspected fraud / data breach):** Click profile → **Emergency Contact** → dial CromStel IT 24/7 hotline + page on-call.
