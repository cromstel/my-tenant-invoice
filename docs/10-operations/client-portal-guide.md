# Tenant Client Portal Guide — Payers & Tenants

**For:** End users (tenants, renters, homeowners association members, commercial tenants) who receive invoices and make payments through the client payment portal
**Last Updated:** 2026-09-20
**Level:** End-user friendly (no technical jargon)

---

## 1. Welcome to Your Portal

The client portal lets you:
- **View** your current and past invoices (rent, utilities, HOA dues, etc.)
- **Pay** securely by Credit/Debit Card, Apple Pay / Google Pay, or ACH bank transfer
- **Set up autopay** so you never miss a due date
- **Download** PDF invoices / receipts for your records
- **Send messages** to your property manager or landlord
- **Update** your contact info, mailing address, and payment methods
- **View** scheduled maintenance tickets + request new service

**Portal URL:** Custom link from your property manager, e.g., `https://acme.mytenant-invoice.com/login` or `https://billing.acmeprop.com/login`

---

## 2. First Login: Activate Your Account

### 2.1 You Receive an Invitation Email

When your property manager adds you as a Payer, you get an email:

```
From:    Acme Property Management <no-reply@mytenant-invoice.com>
Subject: Welcome! Activate your tenant portal — Acme HQ Tower, Unit 14B
Body:
  Hello Jake,
  Your landlord has set up your tenant portal.
  Your next invoice for $1,850.00 will be due 10/01/2026.

  [ Activate Your Account → ]      (valid for 7 days)
```

Click the button, set a password, log in.

### 2.2 Password Recovery

"Forgot Password" → enter your email → receive reset link (valid 1 hour).
**If the email doesn't arrive:** check Spam / Promotions tab, then click "Resend" on the reset page. If still missing, contact your property manager.

### 2.3 Two-Factor Authentication (Recommended)

After first login, prompt appears: "Add extra security". Choose:
- **Authenticator app** (Google Authenticator, 1Password, Authy) — scan QR code, enter 6-digit code
- **SMS text** to your phone number on file
- **Security key** (YubiKey) if you have one

From then on, login = password + code. You can mark your laptop/browser as "Trusted" for 30 days.

---

## 3. Portal Dashboard Overview

After login:

```
┌──────────────────────────────────────────────────────────────────┐
│  🔔 3         👤 Jake Smith — Unit 14B       💬 2    ⚙️ Profile  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─ AMOUNT DUE ──────────────┐  ┌─ NEXT UPCOMING ─────────────┐  │
│  │    $1,850.00              │  │  Rent — Oct 2026             │  │
│  │    Due Oct 1, 2026        │  │  Due in 11 days              │  │
│  │    [Pay Now →]            │  │  $1,850.00                    │  │
│  └───────────────────────────┘  └──────────────────────────────┘  │
│                                                                  │
│  ┌─ QUICK ACTIONS ────────────────────────────────────────────┐ │
│  │  💳 Pay Invoice    📄 View Invoices    🔁 Setup Autopay     │ │
│  │  🔧 Request Maintenance    💬 Message Manager               │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─ RECENT ACTIVITY ──────────────────────────────────────────┐ │
│  │  Sep 20  ✓ Payment received — Sept Rent — $1,850.00        │ │
│  │  Sep 18  📄 New invoice: Utilities (Aug) — $142.37         │ │
│  │  Sep 05  🛠 Maintenance request #482 marked complete       │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## 4. Paying an Invoice

### 4.1 One-Time Payment

1. Dashboard → **Pay Now** OR **Invoices → click PAY on the open invoice**
2. Review invoice line items (breakdown: Rent, Water, Sewer, Trash, Late Fees if applicable)
3. Choose payment method:
   - **Credit/Debit Card** → enter card, billing ZIP. 3D Secure / SCA prompt auto-shown if your bank requires it.
   - **Bank Transfer (ACH)** → select bank via Plaid secure link (login to your bank — we never see your password). Or enter routing/account numbers manually (micro-deposit verification, 1-2 business days).
   - **Apple Pay / Google Pay** → 1-tap if your browser supports it.
4. Click **Pay $1,850.00** → processing spinner (~10 seconds) → success screen.
5. Receipt: auto-emailed to you AND available in **Invoices → Paid → View Receipt** (PDF).

### 4.2 AutoPay (Never Miss a Due Date)

1. Dashboard → **Setup Autopay**
2. Choose default payment method (card or bank)
3. Options:
   - **Pay full amount due on due date automatically** (recommended — 98% of payers choose this)
   - **Pay minimum?** N/A (no partial; full amount due required)
   - **Notify me 3 days before pulling funds?** YES (default) — email preview amount + date
4. Save. You can edit/cancel any time up to 2 business days before the scheduled pull.

### 4.3 Partial Payment / Payment Plan

If your property manager allows it, you see **"Setup Payment Plan"** option on overdue invoices:
1. Click → choose number of installments (2, 3, 4 installments options set by manager)
2. Choose dates for each installment
3. Choose payment method
4. Confirm → schedule created. Email reminders before each debit.

---

## 5. Invoices & Records

### 5.1 View / Filter / Search

**Invoices tab:**
- Filters: `All / Open / Paid / Overdue / Draft`
- Date range picker: `This Year / Last Year / Custom`
- Search: by invoice number, amount (e.g., `>500`), description ("water")
- Columns: `# | Date | Due | Line Items | Total | Status | Actions`

### 5.2 Download for Taxes / Records

Click checkbox next to invoices (or "Select all 2026") → **Bulk Download** → ZIP of PDFs (up to 500 at a time).
Single invoice: click **⋯ → Download PDF** / **Download Receipt**.

### 5.3 Dispute an Invoice Line Item

If a charge looks wrong:
1. Open the invoice
2. Click line-item **⋯ → Dispute**
3. Fill form:
   - Which line(s)?
   - Reason: [Amount wrong ▾] (or Usage, Wrong category, Duplicate charge)
   - Comment / explanation
   - Attach photo/screenshot (optional)
4. Submit → Property manager notified; you get a message back in 1-2 business days.
5. Status tracked in Dispute timeline at bottom of invoice.

---

## 6. Messages to Property Manager

**Messages tab:** Threaded per topic (invoices / maintenance / general).

- New message: **+ Compose** → pick topic, attach file (PDF/photo < 25 MB)
- Replies arrive by email notification AND in-app badge 🔔
- Response SLA: Your property manager posts this on their portal (e.g., "within 1 business day")
- Enterprise tenants: Phone call button appears if enabled.

---

## 7. Maintenance & Service Requests

**Maintenance tab:**

- **Create Request:**
  1. Category: [Plumbing ▾] / Electrical / Appliance / HVAC / Pest / Other
  2. Title: "Kitchen sink leaks when hot water runs"
  3. Description: Free text
  4. Priority: Standard (24-48h) / Urgent (4h) / Emergency (now — call 911 first if safety!)
  5. Attach photos (up to 10, < 10 MB each)
  6. Access permissions: "Okay to enter unit in my absence?" Y/N / enter dog name / gate code
  7. Submit

- Track status: `Submitted → Assigned → In Progress → Parts On Order → Completed → Reviewed`
- After completion: Rate the service (1-5 stars + optional comment)

---

## 8. Profile & Settings

Click avatar (top-right) → **Profile**:

| Tab             | What to Update                                                                  |
|-----------------|---------------------------------------------------------------------------------|
| **Personal Info** | Legal name, phone(s), emergency contact, preferred language (EN/ES/FR)         |
| **Unit / Address** | Mailing address, unit number, move-in date. Move-out date if you know it       |
| **Security**    | Change password, add/remove 2FA, view active login sessions, log out others    |
| **Payment Methods** | Add card or bank account, remove old ones, mark default for autopay            |
| **Notifications** | Email / SMS toggles for: invoice created, paid, overdue, reminder, maint. reply, manager message |
| **Documents**   | Upload files for your manager: ID, insurance, pet registration (auto-requests appear here) |
| **Privacy**     | Request download of all data the landlord holds on you (1-click GDPR/CCPA)     |

---

## 9. Common Questions

**Q: Can I pay with cash or check?**
A: Depends on your property manager's policy. If allowed, you'll see a "Record Cash/Check Payment" button in the portal — your manager must then confirm receipt to mark it paid.

**Q: A payment failed. What now?**
A: You see banner: "Payment failed — X reason (insufficient funds / expired card / etc.)". Fix payment method and retry. If still failing, message your manager via Messages tab.

**Q: Can I split payment between two roommates?**
A: Your property manager controls this. If enabled, you see "Split Payment" option → add roommate emails → they get their own portal login link with their share.

**Q: I moved out. How do I get my security deposit back?**
A: File in Maintenance tab → Category "Move-out / Deposit Return". Your property manager will upload final walk-through form + refund schedule per local law.

**Q: Is my payment information safe?**
A: YES. We never store card or bank numbers on our servers. All payment processing is done by Stripe (PCI Level 1 certified, the highest standard). Data in transit uses TLS 1.3 encryption.

---

## 10. Help & Support

Click the floating (?) chat bubble bottom-right:
1. **AI Help Assistant** (24/7) — answers payment questions, how to use portal
2. **Help Center** links to specific guides
3. **Contact Property Manager** — opens Messages tab (default support channel)
4. **Report Bug** — send to CromStel IT anonymously (we never share your identity or data with your manager without consent unless tied to a manager-reported ticket)

**Billing Dispute Escalation:** If property manager doesn't resolve dispute in 7 days → go to profile → Privacy & Support → **Escalate to Platform** → CromStel IT compliance reviews (mediation, not a debt collector).

---

## 11. Mobile App (Optional)

If your property manager enabled it, links appear:
- **App Store / Google Play** → "myTenant Resident" app (white-labeled with your property's brand)
- Same features, plus push notifications + Touch/Face ID login
- Works offline: drafts maintenance requests and submits when network returns.
