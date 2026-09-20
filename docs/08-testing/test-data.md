# Test Data & Fixtures

> Deterministic seeding · large-sample dataset for perf · factories + snapshot builders.

---

## 1. Tiered Dataset Sizes

| Dataset             | Scale                                                                   | Used In                              |
|---------------------|-------------------------------------------------------------------------|--------------------------------------|
| **Minimal**         | 2 orgs, 4 users, 6 customers, 20 invoices, 3 tariffs                  | Unit + default integration seed     |
| **Default**         | 10 orgs, 40 users, 200 customers, 3,000 invoices, 30 tariffs, 6,000 payments | E2E, manual QA               |
| **Large**           | 500 orgs, 2,000 users, 10k customers, 500k invoices, 1.2M payments    | Nightly perf + tenant isolation     |
| **Enterprise**      | 2 orgs, 50 users, 10k customers, 1M invoices in one org               | DB query benchmarks (§4 above)       |

---

## 2. Minimal Seed

```ts
// scripts/seed/minimal.ts
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { createId } from "@paralleldrive/cuid2";
import { hash } from "@node-rs/bcrypt";
import {
  organizations, users, memberships, customers, tariffs, tariffAssignments,
  invoices, invoiceLineItems, payments,
} from "@/lib/db/schema";
import type { OrganizationId, InvoiceId } from "@/lib/types/brands";

export async function seedMinimal() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);
  const db = drizzle(conn);
  const pwd = await hash("Testpass1!", 12);

  const orgA: OrganizationId = createId() as any;
  const orgB: OrganizationId = createId() as any;
  await db.insert(organizations).values([
    { id: orgA, name: "Acme Property Group",  slug: "acme-property-group",
      currency: "USD", taxMode: "NONE", portalSlug: "acme-portal" },
    { id: orgB, name: "CromStel Commercial",  slug: "cromstel-commercial",
      currency: "ZAR", taxMode: "VAT",  taxRate: 0.15, portalSlug: "cromstel-portal" },
  ]);

  const usersData = [
    { email: "owner@acme.test",    name: "Kai Owen",   org: orgA, role: "OWNER"   },
    { email: "admin@acme.test",    name: "Ami Admin",   org: orgA, role: "ADMIN"   },
    { email: "member@acme.test",   name: "Piet Member", org: orgA, role: "MEMBER"  },
    { email: "billing@cromstel.test", name: "Busi Ntuli", org: orgB, role: "BILLING" },
  ];
  for (const u of usersData) {
    const userId = createId();
    await db.insert(users).values({ id: userId, email: u.email, name: u.name, passwordHash: pwd, emailVerified: true });
    await db.insert(memberships).values({ userId, organizationId: u.org, role: u.role });
  }

  // 3 customers per org, 2 tariffs, 10 invoices with 2-3 line items each, 3 payments per org
  // ... (see full script in repo)

  console.log("✅ minimal seed complete");
  await conn.end();
}
```

---

## 3. Deterministic Factories

```ts
// tests/_factories/index.ts
import { createId } from "@paralleldrive/cuid2";
import * as schema from "@/lib/db/schema";
import type { OrganizationId, CustomerId, InvoiceId } from "@/lib/types/brands";

export function buildOrganization(overrides: Partial<typeof schema.organizations.$inferInsert> = {}) {
  const id = createId() as OrganizationId;
  return {
    id,
    name: "Org " + id.slice(0, 6),
    slug: "org-" + id.slice(0, 8),
    currency: "USD",
    taxMode: "NONE",
    taxRate: 0,
    ...overrides,
  } satisfies typeof schema.organizations.$inferInsert;
}

export function buildCustomer(
  organizationId: OrganizationId,
  overrides: Partial<typeof schema.customers.$inferInsert> = {}
) {
  const id = createId() as CustomerId;
  return {
    id,
    organizationId,
    name: "Customer " + id.slice(0, 6),
    email: `customer-${id.slice(0, 8)}@example.com`,
    phone: null,
    address: null,
    ...overrides,
  } satisfies typeof schema.customers.$inferInsert;
}

export function buildInvoice(
  org: OrganizationId,
  customer: CustomerId,
  overrides: Partial<typeof schema.invoices.$inferInsert> = {}
) {
  const id = createId() as InvoiceId;
  return {
    id, organizationId: org, customerId: customer,
    number: "INV-" + Math.floor(100000 + Math.random() * 899999) + "-0001",
    status: "DRAFT", currency: "USD", taxRate: 0,
    subtotalCents: 10000, taxCents: 0, totalCents: 10000,
    issueDate: new Date("2026-04-01"), dueDate: new Date("2026-05-01"),
    ...overrides,
  } satisfies typeof schema.invoices.$inferInsert;
}
```

Factory usage:

```ts
const org = buildOrganization({ name: "Acme" });
const customers = Array.from({ length: 5 }, () => buildCustomer(org.id));
await db.insert(organizations).values(org);
await db.insert(customers).values(customers);
```

---

## 4. Deterministic Random (Faker Seeded)

```ts
// tests/_factories/faker.ts
import { Faker, en, en_ZA } from "@faker-js/faker";

export const faker = new Faker({ locale: [en_ZA, en] });
faker.seed(42); // deterministic per CI run. Change only if fixture schema changes.

export function buildRealisticName() {
  return faker.person.fullName();
}
export function buildRealisticStreet() {
  return `${faker.location.buildingNumber()} ${faker.location.street()}`;
}
export function buildSouthAfricanPhone() {
  return "+27" + faker.helpers.fromRegExp("[0-9]{9}");
}
```

---

## 5. Large Dataset Generator

Used exclusively by nightly perf + tenant isolation runs.

```ts
// scripts/seed/large.ts
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { faker } from "../../tests/_factories/faker";
import { createId } from "@paralleldrive/cuid2";
import {
  organizations, users, memberships, customers, tariffs, invoices,
  invoiceLineItems, payments,
} from "@/lib/db/schema";

const ORGS = 500;
const CUSTOMERS_PER_ORG = 20;
const INVOICES_PER_CUSTOMER = 50;
const PAYMENTS_PER_ORG = 2400;

async function main() {
  faker.seed(20260401);
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);
  const db = drizzle(conn);

  console.log(`🌱 seeding ${ORGS} orgs…`);
  for (let o = 0; o < ORGS; o++) {
    const orgId = createId() as any;
    await db.insert(organizations).values({
      id: orgId,
      name: faker.company.name() + " " + orgId.slice(0, 4),
      slug: "org-" + orgId.slice(0, 10),
      currency: faker.helpers.arrayElement(["USD", "ZAR", "EUR", "GBP"]),
      taxMode: faker.helpers.arrayElement(["NONE", "VAT", "SALES"]),
    });

    const custIds: string[] = [];
    for (let c = 0; c < CUSTOMERS_PER_ORG; c++) {
      const cid = createId();
      custIds.push(cid);
      await db.insert(customers).values({
        id: cid, organizationId: orgId,
        name: faker.company.name(), email: `cust-${cid.slice(0,8)}@example.com`,
      });
    }

    const invoiceInserts: any[] = [];
    const lineInserts: any[] = [];
    for (const cid of custIds) {
      for (let i = 0; i < INVOICES_PER_CUSTOMER; i++) {
        const invId = createId();
        const month = i % 12 + 1;
        const status = faker.helpers.arrayElement([
          "DRAFT", "SENT", "VIEWED", "PAID", "PAID", "PAID", "OVERDUE", "CANCELLED",
        ]);
        const subtotal = 5000 + Math.floor(Math.random() * 95000);
        invoiceInserts.push({
          id: invId, organizationId: orgId, customerId: cid,
          number: `INV-${o + 1}-${String(c + 1).padStart(4, "0")}-${String(i + 1).padStart(4, "0")}`,
          status, currency: "USD", taxRate: 0.15,
          subtotalCents: subtotal,
          taxCents: Math.round(subtotal * 0.15),
          totalCents: subtotal + Math.round(subtotal * 0.15),
          issueDate: new Date(2025, month - 1, 1),
          dueDate:   new Date(2025, month, 0),
          paidAt:    status === "PAID" ? new Date(2025, month - 1, 15) : null,
        });
        lineInserts.push(
          { id: createId(), invoiceId: invId, description: "Rent", quantity: 1, unitPriceCents: Math.round(subtotal * 0.8) },
          { id: createId(), invoiceId: invId, description: "Levy", quantity: 1, unitPriceCents: Math.round(subtotal * 0.2) },
        );
      }
    }
    if (invoiceInserts.length) {
      await db.insert(invoices).values(invoiceInserts);
      await db.insert(invoiceLineItems).values(lineInserts);
    }

    const payInserts: any[] = [];
    for (let p = 0; p < PAYMENTS_PER_ORG; p++) {
      payInserts.push({
        id: "pi_" + createId(),
        organizationId: orgId,
        invoiceId: faker.helpers.arrayElement(invoiceInserts).id,
        status: "SUCCEEDED",
        amountCents: 1000 + Math.floor(Math.random() * 150000),
        currency: "USD",
        provider: faker.helpers.arrayElement(["STRIPE", "MANUAL", "EFT"]),
        paidAt: faker.date.past({ years: 1 }),
      });
    }
    if (payInserts.length) await db.insert(payments).values(payInserts);
    if ((o + 1) % 25 === 0) console.log(`  … ${o + 1}/${ORGS}`);
  }
  console.log("✅ large seed complete");
  await conn.end();
}
main().catch(e => { console.error(e); process.exit(1); });
```

Running:

```bash
NODE_OPTIONS="--max-old-space-size=8192" \
DATABASE_URL=mysql://root:devpassword@127.0.0.1:3306/mytenant_invoice_large \
pnpm tsx scripts/seed/large.ts
```

---

## 6. Portal Fixture — Fake Payment Cards

For Playwright E2E, always use Stripe public test cards:

| Scenario                | Card Number       | Exp  | CVC | Zip (US) | Outcome                                |
|-------------------------|-------------------|------|-----|----------|----------------------------------------|
| Success                 | 4242 4242 4242 4242 | 12/34 | any | any    | Immediately succeeds                   |
| SCA 3DS required        | 4000 0027 6000 3184 | 12/34 | any | any    | Completes challenge successfully       |
| Declined (insufficient) | 4000 0000 0000 9995 | 12/34 | any | any    | `card_declined: insufficient_funds`    |
| Requires auth (3DS fail)| 4000 0082 6000 3178 | 12/34 | any | any    | 3DS challenge fails → declined         |
| Dispute after success   | 4000 0000 0000 0259 | 12/34 | any | any    | Success → later dispute                |

---

## 7. Sensitive-Data Policy for Fixtures

- **Never** commit real names, emails, street addresses, phone numbers, IBANs, credit cards, IDs.
- Emails use `@example.com` / `@example.test` domains exclusively.
- Phones use reserved country code `+999` or obviously-fictional formats (e.g. `+27210000000`).
- South African VAT / company numbers: use invalid test ranges as per SARS test harness docs.
- Fixture `passwordHash` uses a single shared password `Testpass1!` with a static salt to speed up seeding.

```ts
// DO NOT use real PII even in "test" fixtures
// ✅ Good
const email = `test+${id}@example.test`;
// ❌ Bad
const email = `john.smith@gmail.com`;
```
