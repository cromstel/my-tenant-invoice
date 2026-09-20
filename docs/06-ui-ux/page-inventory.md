# Page Inventory

> Full route map for myTenant Invoice — Marketing, Auth, Platform (Dashboard), and Customer Portal.

---

## 1. Marketing Pages — `app/(marketing)/`

| Route           | File                        | Page Title                           | Layout                | Purpose                                                                 |
|-----------------|-----------------------------|--------------------------------------|-----------------------|-------------------------------------------------------------------------|
| `/`             | `page.tsx`                  | "Automate tenant invoicing & rent collection" | MarketingLayout     | Hero, features grid, social proof, pricing teaser, CTA                |
| `/features`     | `features/page.tsx`         | "Features built for property managers" | MarketingLayout   | Grouped feature cards (Billing, Payments, Reports, API)                |
| `/pricing`      | `pricing/page.tsx`          | "Simple, transparent pricing"        | MarketingLayout       | 3 tiers (Starter, Growth, Enterprise) + toggle monthly/annual + FAQs   |
| `/about`        | `about/page.tsx`            | "About CromStel IT Group"            | MarketingLayout       | Company story, team, values, contact                                   |
| `/contact`      | `contact/page.tsx`          | "Talk to sales"                      | MarketingLayout       | Contact form + business details + social                                |
| `/legal/terms`  | `legal/terms/page.tsx`      | "Terms of Service"                   | MarketingLayout       | Terms                                                                   |
| `/legal/privacy`| `legal/privacy/page.tsx`    | "Privacy Policy"                     | MarketingLayout       | GDPR/PIPEDA/CCPA notice                                                |

### Marketing Hero Skeleton

```tsx
// app/(marketing)/page.tsx
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function HomePage() {
  return (
    <section className="relative overflow-hidden">
      <div className="container pb-24 pt-20 lg:pt-32">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
            New: Auto-charge for recurring tariffs
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Automate tenant invoicing & <span className="text-primary">rent collection</span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            myTenant Invoice helps property managers create, send, and reconcile invoices
            in seconds. PCI-compliant payments, multi-tenant reporting, and full audit logs.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/register">Start 14-day free trial</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/contact">Book a demo</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
```

---

## 2. Auth Pages — `app/(auth)/`

| Route              | File                              | Layout       | Purpose                                                    |
|--------------------|-----------------------------------|--------------|------------------------------------------------------------|
| `/login`           | `login/page.tsx`                  | AuthLayout   | Email + password + remember + MFA prompt                   |
| `/register`        | `register/page.tsx`               | AuthLayout   | Step 1: org + owner info; Step 2: billing (optional)       |
| `/forgot-password` | `forgot-password/page.tsx`        | AuthLayout   | Email → reset link                                         |
| `/reset-password`  | `reset-password/page.tsx`         | AuthLayout   | Token + new password                                       |
| `/verify`          | `verify/page.tsx`                 | AuthLayout   | Email verification OTP or magic-link confirmation          |
| `/invite/[token]`  | `invite/[token]/page.tsx`         | AuthLayout   | Team-member acceptance flow                                |

### Auth Layout

```tsx
// app/(auth)/layout.tsx
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden relative flex-col justify-between border-r bg-muted/40 p-10 lg:flex">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <span className="text-primary">myTenant</span>
          <span>Invoice</span>
        </Link>
        <blockquote className="space-y-4 max-w-md">
          <p className="text-lg leading-relaxed text-foreground/90">
            "myTenant Invoice cut our monthly close process from 4 days to 3 hours.
            The per-tenant reporting alone paid for itself in the first month."
          </p>
          <footer className="text-sm text-muted-foreground">
            — Priya S., Head of Finance, CromStel Commercial
          </footer>
        </blockquote>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} CromStel IT Group</p>
      </div>
      <div className="flex flex-col justify-center px-4 py-12 sm:px-6 lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
```

---

## 3. Platform / Dashboard Pages — `app/(platform)/`

### 3.1 Core Workflows

| Route              | File                                    | Auth + Role        | Purpose                                                                |
|--------------------|-----------------------------------------|--------------------|------------------------------------------------------------------------|
| `/dashboard`       | `dashboard/page.tsx`                    | Any authenticated  | KPI cards (MRR, overdue, collected), recent invoices, chart of revenue |
| `/invoices`        | `invoices/page.tsx`                     | Any authenticated  | Data table: filter/search/sort, bulk actions, mass-SEND                |
| `/invoices/new`    | `invoices/new/page.tsx`                 | ≥ BILLING          | 2-step form (customer & metadata → line items)                         |
| `/invoices/[id]`   | `invoices/[id]/page.tsx`                | Any authenticated  | Detail view: PDF preview, timeline, payments, actions (Send/Remind/Void) |
| `/customers`       | `customers/page.tsx`                    | Any authenticated  | Customer list + search + quick-create drawer                           |
| `/customers/[id]`  | `customers/[id]/page.tsx`               | Any authenticated  | Customer profile, portal link, invoices history, outstanding balance   |
| `/tariffs`         | `tariffs/page.tsx`                      | ≥ BILLING          | Recurring tariff plan list, attach to tenant/unit                      |
| `/payments`        | `payments/page.tsx`                     | Any authenticated  | Transactions register, filters, reconciliation view                    |
| `/reports`         | `reports/page.tsx`                      | ≥ ADMIN            | Revenue by tenant, aging A/R, cash flow, export to CSV/XLSX            |

### 3.2 Admin Only

| Route                     | File                                           | Role           | Purpose                                          |
|---------------------------|------------------------------------------------|----------------|--------------------------------------------------|
| `/tenants`                | `tenants/page.tsx`                             | OWNER          | Multi-tenant org list, status, plan, last login  |
| `/tenants/new`            | `tenants/new/page.tsx`                         | OWNER          | Provision new org + onboarding wizard            |
| `/tenants/[slug]`         | `tenants/[slug]/page.tsx`                      | OWNER          | Tenant detail: usage, impersonate, plan change   |
| `/users`                  | `users/page.tsx`                               | OWNER / ADMIN  | Team members, invite, roles, last active         |
| `/users/[id]`             | `/users/[id]/page.tsx`                         | OWNER / ADMIN  | Permission + role editing, audit of actions      |

### 3.3 Settings Cluster

| Route                       | File                                          | Purpose                                                   |
|-----------------------------|-----------------------------------------------|-----------------------------------------------------------|
| `/settings`                 | `settings/page.tsx`                           | Redirect → `/settings/organization`                       |
| `/settings/organization`    | `settings/organization/page.tsx`              | Branding (logo, name, portal slug), address, tax number   |
| `/settings/billing`        | `settings/billing/page.tsx`                   | Payment gateway (Stripe/PayGate), bank details, invoices  |
| `/settings/invoice-template` | `settings/invoice-template/page.tsx`       | PDF template editor: terms, notes, numbering scheme       |
| `/settings/team`           | `settings/team/page.tsx`                      | Invite members, assign roles (aliases /users)             |
| `/settings/notifications`  | `settings/notifications/page.tsx`             | Email/SMS toggles for reminders, overdue, paid            |
| `/settings/security`       | `settings/security/page.tsx`                  | 2FA (TOTP), SSO (SAML), sessions, API keys                |

### 3.4 Dashboard Page Example

```tsx
// app/(platform)/dashboard/page.tsx
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { RevenueOverviewChart } from "./_components/revenue-chart";
import { RecentInvoicesTable } from "./_components/recent-invoices";
import { DollarSign, AlertTriangle, FileCheck, Users } from "lucide-react";
import { formatCurrency } from "@/lib/format";

export default async function DashboardPage() {
  const { organizationId } = await requireSession();

  const [mrr, overdue, paidCount, activeCustomers] = await Promise.all([
    db.kpi.computeMonthlyRecurringRevenue(organizationId),
    db.kpi.computeOverdueBalance(organizationId),
    db.invoice.countByStatus(organizationId, "PAID"),
    db.customer.countActive(organizationId),
  ]);

  const kpis = [
    { label: "Monthly Revenue", value: formatCurrency(mrr), icon: DollarSign, accent: "text-success" },
    { label: "Outstanding Overdue", value: formatCurrency(overdue), icon: AlertTriangle, accent: "text-destructive" },
    { label: "Invoices Paid (MTD)", value: paidCount.toLocaleString(), icon: FileCheck, accent: "text-info" },
    { label: "Active Customers", value: activeCustomers.toLocaleString(), icon: Users, accent: "text-primary" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Overview of billing activity across your organization.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(({ label, value, icon: Icon, accent }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className={`h-4 w-4 ${accent}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Revenue — last 12 months</CardTitle></CardHeader>
          <CardContent><RevenueOverviewChart /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recent Invoices</CardTitle></CardHeader>
          <CardContent><RecentInvoicesTable /></CardContent>
        </Card>
      </div>
    </div>
  );
}
```

---

## 4. Customer Portal Pages — `app/(portal)/[slug]/`

Fully unbranded, per-customer. Each customer has a unique `slug`.

| Route                            | File                                           | Auth                            | Purpose                                                              |
|----------------------------------|------------------------------------------------|---------------------------------|----------------------------------------------------------------------|
| `/p/[slug]`                      | `page.tsx`                                     | Public (if enabled) + password  | Landing: open invoices, recent payments                              |
| `/p/[slug]/invoices`             | `invoices/page.tsx`                            | Portal session                  | List of invoices, filter by status/date, download PDF                |
| `/p/[slug]/invoices/[id]`        | `invoices/[id]/page.tsx`                       | Portal session                  | View invoice, pay online via Stripe/PayGate, print                   |
| `/p/[slug]/payments`             | `payments/page.tsx`                            | Portal session                  | Payment history + receipts                                           |
| `/p/[slug]/contact`              | `contact/page.tsx`                             | Portal session                  | Secure message form → org inbox                                      |
| `/p/[slug]/login`                | `login/page.tsx`                               | Public                          | Password or magic-link auth for the portal                           |

### Portal Invoice Detail

```tsx
// app/(portal)/[slug]/invoices/[id]/page.tsx
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Download, CreditCard } from "lucide-react";
import { InvoiceStatusBadge } from "@/components/invoice/invoice-status-badge";

interface PageProps { params: { slug: string; id: string } }

export default async function PortalInvoicePage({ params }: PageProps) {
  const invoice = await db.invoice.findByPortal(params.slug, params.id);
  if (!invoice) notFound();

  const total = invoice.lineItems.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const tax = total * (invoice.taxRate ?? 0);

  return (
    <div className="container py-10 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Invoice {invoice.number}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{invoice.customerName}</h1>
        </div>
        <InvoiceStatusBadge status={invoice.status} />
      </div>

      <div className="mt-10 grid grid-cols-2 gap-6 text-sm">
        <div>
          <p className="text-muted-foreground">From</p>
          <p className="mt-1 font-medium">{invoice.organization.name}</p>
          <p className="whitespace-pre-line text-muted-foreground">{invoice.organization.address}</p>
        </div>
        <div className="text-right">
          <p className="text-muted-foreground">Issued</p>
          <p className="font-medium">{formatDate(invoice.issueDate)}</p>
          <p className="mt-3 text-muted-foreground">Due</p>
          <p className="font-medium">{formatDate(invoice.dueDate)}</p>
        </div>
      </div>

      <table className="mt-10 w-full text-left text-sm">
        <thead className="border-b text-muted-foreground">
          <tr><th className="py-3 pr-4">Description</th><th>Qty</th><th>Rate</th><th className="text-right">Amount</th></tr>
        </thead>
        <tbody>
          {invoice.lineItems.map((l, i) => (
            <tr key={i} className="border-b last:border-0">
              <td className="py-3 pr-4">{l.description}</td>
              <td>{l.quantity}</td>
              <td>{formatCurrency(l.unitPrice)}</td>
              <td className="text-right font-medium">{formatCurrency(l.quantity * l.unitPrice)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="text-right">
          <tr><td colSpan={3} className="pt-6 text-muted-foreground">Subtotal</td><td>{formatCurrency(total)}</td></tr>
          <tr><td colSpan={3} className="py-1 text-muted-foreground">Tax {(invoice.taxRate ?? 0) * 100}%</td><td>{formatCurrency(tax)}</td></tr>
          <tr><td colSpan={3} className="pt-2 text-base font-semibold">Total</td><td className="text-base font-semibold">{formatCurrency(total + tax)}</td></tr>
        </tfoot>
      </table>

      <div className="mt-10 flex items-center justify-end gap-2">
        <Button variant="outline"><Download className="mr-2 h-4 w-4" /> Download PDF</Button>
        {invoice.status !== "PAID" && (
          <Button><CreditCard className="mr-2 h-4 w-4" /> Pay Now</Button>
        )}
      </div>
    </div>
  );
}
```
