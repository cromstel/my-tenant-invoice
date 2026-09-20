# Naming Conventions

> Consistent, predictable names reduce cognitive load. Apply these across code, DB, config, CI.

---

## 1. General

- Use **American English** (color, center, behavior).
- Avoid abbreviations unless they are industry-wide: `id`, `url`, `html`, `api`, `db`, `ctx`, `req`, `res`, `env`, `config`, `err`, `args`.
- Never truncate: `customer` not `cust`, `organization` not `org` (except ID types).
- Boolean names start with `is`, `has`, `can`, `should`, `was`, `will`:

```ts
// ✅ Good
const isPaid = invoice.status === "PAID";
const hasOpenBalance = customer.balanceCents > 0;
const canDeleteInvoice = role === "OWNER" && invoice.status === "DRAFT";
const shouldSendReminder = !invoice.isReminderSent && daysUntilDue <= 3;

// ❌ Bad
const paid = true;          // ambiguous
const paymentExists = 123; // not a bool
const del = true;          // abbreviation
```

---

## 2. TypeScript / JavaScript

| Kind                  | Convention                                | Examples                                             |
|-----------------------|-------------------------------------------|------------------------------------------------------|
| File / folder         | kebab-case                                | `invoice-generator.ts`, `tenant-isolation.spec.ts`   |
| Component (React)     | PascalCase, matches filename             | `<InvoiceStatusBadge />` → `invoice-status-badge.tsx`|
| Function              | camelCase, verb first                     | `generateInvoicePdf`, `validateInvoiceSchema`        |
| Variable              | camelCase                                 | `totalAmountCents`, `customerEmail`                  |
| Constant / enum value | UPPER_SNAKE_CASE                          | `QUEUE_NAME`, `MAX_LINES_PER_INVOICE`                |
| Interface / Type      | PascalCase, no `I` prefix                 | `InvoiceReadRepo`, `TaxableLine`, `OrganizationId`   |
| Class                 | PascalCase, noun                          | `SequentialNumberingService`, `VatTaxEngine`         |
| Generic type param    | Single-letter T, U, V or descriptive      | `TRepo`, `TEvent`                                    |
| Error classes         | Suffix `Error`                            | `TenantMismatchError`, `InvoiceLockedError`          |
| React hook            | Prefix `use`                              | `useCurrentRole`, `useInvoiceTotals`                 |
| Handler / listener    | Suffix `Handler`, `Listener`              | `paymentSucceededWebhookHandler`                     |
| Test file             | Suffix `.spec.ts` / `.test.ts`            | `tariff-calculator.spec.ts`                          |
| Barrel file           | `index.ts`                                | re-exports only, no logic                            |

### 2.1 Money & Currency

Always encode money as **integer cents / minor units**. Suffix variable names with `Cents` (or the minor unit when not USD):

```ts
// ✅
const lineTotalCents = 12500;         // $125.00
const vatAmountCents  = 1875;
const grandTotalZar   = 1437500;      // ZAR cents (R14,375.00)

// ❌ Never use float for money
const lineTotal = 125.0; // IEEE 754 rounding risk
```

When formatting, keep it together:

```ts
export function formatCurrency(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency,
  }).format(cents / 100);
}
```

### 2.2 Date / Time

Use suffixes to clarify the shape:

- `At` for ISO-8601 timestamps: `createdAt`, `paidAt`, `webhookReceivedAt`.
- `Date` for day-level: `issueDate`, `dueDate`.
- `Ms` for epoch milliseconds, `Sec` for epoch seconds.
- Store DB values as `Date` (drizzle `timestamp`) for UTC.

```ts
interface Invoice {
  id: InvoiceId;
  createdAt: Date;
  issueDate: Date;
  dueDate: Date;
  paidAt: Date | null;
  lockVersionSec: number;
}
```

### 2.3 IDs

```ts
// Entity + Id
OrganizationId, InvoiceId, PaymentId, LineItemId

// Foreign key columns (snake_case in SQL, camelCase in TS via drizzle mapper)
organization_id → organizationId
invoice_id      → invoiceId
customer_id     → customerId
```

---

## 3. Database (MySQL 8)

| Kind                | Convention                         | Examples                                      |
|---------------------|------------------------------------|-----------------------------------------------|
| Table names         | snake_case, plural                 | `invoices`, `invoice_line_items`, `payments`  |
| Columns             | snake_case                         | `created_at`, `due_date`, `total_amount_cents`|
| Primary key         | `id` (always, UUID v7 / CUID2)     | `id VARCHAR(36) PRIMARY KEY`                  |
| Foreign keys        | `<entity>_id`                      | `organization_id`, `customer_id`              |
| Timestamps          | `created_at`, `updated_at`, `deleted_at` | always nullable except `created_at` |
| Status columns      | `<entity>_status` or just `status` | `invoice_status`, `payment_status`            |
| Boolean columns     | `is_<adj>`                         | `is_paid`, `is_overdue`, `is_reminder_sent`   |
| Indexes             | `idx_<table>_<cols>`               | `idx_invoices_org_due_date`                   |
| Unique constraints  | `uk_<table>_<cols>`                | `uk_invoices_org_number UNIQUE (org_id, number)` |
| Row-level tenant key| `organization_id` everywhere       | 1st column in every non-lookup table          |
| Soft deletes        | `deleted_at DATETIME NULL`         | never `is_deleted BOOL`                        |

### 3.1 Example Drizzle Table

```ts
// lib/db/schema/invoices.ts
import {
  mysqlTable, varchar, timestamp, int, decimal, index, uniqueIndex,
} from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import type { OrganizationId, CustomerId, InvoiceId } from "@/lib/types/brands";

export const invoices = mysqlTable(
  "invoices",
  {
    id:              varchar("id", { length: 36 }).primaryKey().$type<InvoiceId>(),
    organizationId:  varchar("organization_id", { length: 36 }).notNull().$type<OrganizationId>(),
    customerId:      varchar("customer_id", { length: 36 }).notNull().$type<CustomerId>(),
    number:          varchar("number", { length: 32 }).notNull(),
    status:          varchar("status", { length: 16 }).notNull().default("DRAFT"),
    currency:        varchar("currency", { length: 3 }).notNull().default("USD"),
    taxRate:         decimal("tax_rate", { precision: 5, scale: 4 }).notNull().default(0),
    subtotalCents:   int("subtotal_cents").notNull(),
    taxCents:        int("tax_cents").notNull(),
    totalCents:      int("total_cents").notNull(),
    issueDate:       timestamp("issue_date", { mode: "date" }).notNull(),
    dueDate:         timestamp("due_date",   { mode: "date" }).notNull(),
    paidAt:          timestamp("paid_at").null(),
    createdAt:       timestamp("created_at").notNull().default(sql`NOW()`),
    updatedAt:       timestamp("updated_at").notNull().default(sql`NOW()`).onUpdateNow(),
    deletedAt:       timestamp("deleted_at").null(),
  },
  (t) => ({
    orgIdx:      index("idx_invoices_org").on(t.organizationId),
    orgStatus:   index("idx_invoices_org_status").on(t.organizationId, t.status),
    orgDueDate:  index("idx_invoices_org_due").on(t.organizationId, t.dueDate),
    ukOrgNumber: uniqueIndex("uk_invoices_org_number").on(t.organizationId, t.number),
  })
);
```

---

## 4. Filesystem

```
components/<domain>/<noun>-<role>.tsx
  invoice-status-badge.tsx
  customer-avatar.tsx
  tenant-select-dropdown.tsx

lib/<domain>/<noun-or-verb>.ts
  billing/tariff-calculator.ts
  billing/invoice-generator.ts
  payments/stripe-provider.ts
  auth/session.ts

app/(group)/<route>/_components/<local>.tsx
  (platform)/invoices/_components/line-editor.tsx

tests/<tier>/<subject>.spec.ts
  unit/billing/tariff-calculator.spec.ts
  integration/invoice-lifecycle.spec.ts
  e2e/tenant-invoice-portal.spec.ts
```

---

## 5. API (REST / tRPC)

| Verb      | Purpose                                   | Example tRPC route                 |
|-----------|-------------------------------------------|------------------------------------|
| `list`    | Paginated collection, filters             | `invoice.list`                    |
| `get`     | Single entity by ID                       | `invoice.get`                     |
| `create`  | New entity (input → created)              | `invoice.create`                  |
| `update`  | Full or partial update                    | `invoice.update`                  |
| `delete`  | Soft-delete / void                        | `invoice.delete`                  |
| `<verb>`  | Domain action on entity                   | `invoice.send`, `invoice.void`, `invoice.markPaid` |

### 5.1 DTO Prefixes

```ts
type CreateInvoiceInput  = { /* ... */ };
type UpdateInvoiceInput  = { /* ... */ };
type InvoiceListItemDto  = { /* flattened for tables */ };
type InvoiceDetailDto    = { /* with relations */ };
```

---

## 6. Environment Variables

```env
# <SERVICE>_<ATTRIBUTE>
NEXT_PUBLIC_STRIPE_PK=
STRIPE_SK=
STRIPE_WEBHOOK_SECRET=

DATABASE_URL=
REDIS_URL=

# Feature flags: FF_<FEATURE_NAME>
FF_NEW_DASHBOARD=true
FF_BULK_INVOICE_SEND=true
```

---

## 7. CSS / Tailwind Classes

- Prefer Tailwind utilities. Any `className` longer than ~12 classes → extract into a component.
- Custom one-off classes live in `globals.css` with `.mx-` prefix for product-specific utilities:

```css
/* globals.css */
@layer components {
  .mx-kpi-card {
    @apply rounded-xl border bg-card p-5 shadow-sm;
  }
}
```
