# Tenant Isolation Testing

> Explicit cross-tenant BOLA (Broken Object Level Authorization) probes. Critical for multi-tenant SaaS.

---

## 1. Guiding Principle

> Every API endpoint returning a row scoped by `organization_id` must be tested against:
> 1. Two orgs with resources of the same shape but different IDs.
> 2. User authenticated to org A attempting to read/write org B.
> 3. Tampering of `organization_id` in the request body.
> 4. URL path tampering with `invoiceId`, `customerId` of another org.

Failures are treated as **security-critical P0 issues**, not bugs.

---

## 2. Fixture Setup

```ts
// tests/fixtures/two-orgs.ts
import { createId } from "@paralleldrive/cuid2";
import { db } from "@/lib/db";
import { hash } from "@node-rs/bcrypt";
import type { OrganizationId, InvoiceId, CustomerId, UserId } from "@/lib/types/brands";

export interface TwoOrgFixture {
  orgA: { id: OrganizationId; slug: string };
  orgB: { id: OrganizationId; slug: string };
  userA: { id: UserId; email: string; token: string };
  userB: { id: UserId; email: string; token: string };
  invoiceA: { id: InvoiceId; number: string };
  invoiceB: { id: InvoiceId; number: string };
  customerA: { id: CustomerId; name: string };
  customerB: { id: CustomerId; name: string };
}

export async function seedTwoOrgs(): Promise<TwoOrgFixture> {
  const pwd = await hash("SecurePass_1!", 12);
  const orgAId = createId() as OrganizationId;
  const orgBId = createId() as OrganizationId;

  await db.insert(organizations).values([
    { id: orgAId, name: "Org A Ltd",    slug: "org-a-" + orgAId.slice(0,6), currency: "USD" },
    { id: orgBId, name: "Org B (Pty)",  slug: "org-b-" + orgBId.slice(0,6), currency: "USD" },
  ]);

  const userAId = createId() as UserId;
  const userBId = createId() as UserId;
  await db.insert(users).values([
    { id: userAId, email: "admin@orga.test", name: "A Admin", passwordHash: pwd, emailVerified: true },
    { id: userBId, email: "admin@orgb.test", name: "B Admin", passwordHash: pwd, emailVerified: true },
  ]);
  await db.insert(memberships).values([
    { userId: userAId, organizationId: orgAId, role: "ADMIN" },
    { userId: userBId, organizationId: orgBId, role: "ADMIN" },
  ]);

  const custAId = createId() as CustomerId;
  const custBId = createId() as CustomerId;
  await db.insert(customers).values([
    { id: custAId, organizationId: orgAId, name: "Customer of A", email: "a@example.com" },
    { id: custBId, organizationId: orgBId, name: "Customer of B", email: "b@example.com" },
  ]);

  const invAId = createId() as InvoiceId;
  const invBId = createId() as InvoiceId;
  await db.insert(invoices).values([
    {
      id: invAId, organizationId: orgAId, customerId: custAId,
      number: "INV-AAAAAA-0001", status: "PAID", totalCents: 100_000,
      issueDate: new Date("2026-01-01"), dueDate: new Date("2026-02-01"),
      subtotalCents: 100_000, taxCents: 0, currency: "USD",
    },
    {
      id: invBId, organizationId: orgBId, customerId: custBId,
      number: "INV-BBBBBB-0001", status: "DRAFT", totalCents: 200_000,
      issueDate: new Date("2026-01-01"), dueDate: new Date("2026-02-01"),
      subtotalCents: 200_000, taxCents: 0, currency: "USD",
    },
  ]);

  return {
    orgA: { id: orgAId, slug: "org-a" },
    orgB: { id: orgBId, slug: "org-b" },
    userA: { id: userAId, email: "admin@orga.test", token: await mintSession(userAId, orgAId) },
    userB: { id: userBId, email: "admin@orgb.test", token: await mintSession(userBId, orgBId) },
    invoiceA:  { id: invAId, number: "INV-AAAAAA-0001" },
    invoiceB:  { id: invBId, number: "INV-BBBBBB-0001" },
    customerA: { id: custAId, name: "Customer of A" },
    customerB: { id: custBId, name: "Customer of B" },
  };
}
```

---

## 3. Cross-Tenant API Tests (tRPC / HTTP)

### 3.1 Invoice Detail (GET) — Core BOLA

```ts
// tests/integration/tenant-isolation/invoice.spec.ts
import { describe, it, expect, beforeAll } from "vitest";
import type { TestHarness } from "../_test-harness";
import { seedTwoOrgs } from "../../fixtures/two-orgs";
import { getTestDb } from "../_test-harness";
import { DrizzleInvoiceRepo } from "@/lib/db/repos/invoice-repo";
import { TenantMismatchError } from "@/lib/errors";

describe("TENANT ISOLATION — invoices", () => {
  let f: Awaited<ReturnType<typeof seedTwoOrgs>>;

  beforeAll(async () => { f = await seedTwoOrgs(); });

  describe("DrizzleInvoiceRepo.findById", () => {
    it("RETURNS invoice when caller org owns it", () => {
      const repo = new DrizzleInvoiceRepo(getTestDb(), f.orgA.id);
      return expect(repo.findById(f.invoiceA.id)).resolves.toMatchObject({
        id: f.invoiceA.id, number: f.invoiceA.number,
      });
    });

    it("THROWS TenantMismatchError (→ user sees 404) when caller org does NOT own invoice", async () => {
      const repo = new DrizzleInvoiceRepo(getTestDb(), f.orgA.id);
      // Org A user asking for org B's invoice
      await expect(repo.findById(f.invoiceB.id)).rejects.toBeInstanceOf(TenantMismatchError);
    });
  });

  describe("tRPC invoice.get", () => {
    it("returns 403/404 for cross-tenant id", async () => {
      const caller = makeCaller({ userId: f.userA.id, orgId: f.orgA.id });
      const res = await caller.invoice.get({ id: f.invoiceB.id })
        .catch((e: any) => e);
      expect(res?.code ?? res?.data?.code).toMatch(/FORBIDDEN|NOT_FOUND|TENANT_MISMATCH/);
    });

    it("MUST NOT return invoice number of another org in response error body", async () => {
      const caller = makeCaller({ userId: f.userA.id, orgId: f.orgA.id });
      try {
        await caller.invoice.get({ id: f.invoiceB.id });
      } catch (e: any) {
        const msg = (e.message ?? "") + " " + JSON.stringify(e);
        // The key tell: NEVER leak invoice number, customer name, or org slug in error bodies
        expect(msg).not.toContain(f.invoiceB.number);
        expect(msg).not.toContain("Org B");
        expect(msg).not.toContain(f.customerB.name);
      }
    });
  });
});
```

### 3.2 Invoice Update (PUT) — Tampering orgId in Body

```ts
// tests/integration/tenant-isolation/invoice-write.spec.ts
import { describe, it, expect, beforeAll } from "vitest";
import { seedTwoOrgs } from "../../fixtures/two-orgs";
import { DrizzleInvoiceRepo } from "@/lib/db/repos/invoice-repo";
import { InvoiceService } from "@/lib/billing/invoice-service";
import { getTestDb } from "../_test-harness";

describe("TENANT ISOLATION — invoice writes ignore client-supplied organization_id", () => {
  let f: Awaited<ReturnType<typeof seedTwoOrgs>>;
  beforeAll(async () => { f = await seedTwoOrgs(); });

  it("createDraft with payload.organizationId = orgB still writes invoice under orgA", async () => {
    const db = getTestDb();
    const orgAService = new InvoiceService({
      invoiceRepo: new DrizzleInvoiceRepo(db, f.orgA.id),
      customerRepo: null as any,
      numbering: null as any,
      tax: null as any,
    });
    // Simulate a tampered client payload
    const payload = {
      customerId: f.customerA.id,
      issueDate: new Date(), dueDate: new Date(),
      lines: [{ description: "X", quantity: 1, unitPriceCents: 99 }],
      // Attacker injects org B id hoping to hide the invoice on org A ledger:
      organizationId: f.orgB.id,
    } as any;
    const created = await orgAService.createDraft(payload);
    // Re-read raw row
    const row = await db.query.invoices.findFirst({ where: (i, { eq }) => eq(i.id, created.id as any) });
    expect(row?.organizationId).toBe(f.orgA.id);
    expect(row?.organizationId).not.toBe(f.orgB.id);
  });

  it("void invoice from other org → Forbidden, invoiceB still DRAFT", async () => {
    const db = getTestDb();
    const orgAService = new InvoiceService({
      invoiceRepo: new DrizzleInvoiceRepo(db, f.orgA.id),
      customerRepo: null as any, numbering: null as any, tax: null as any,
    });
    const res = await orgAService.void(f.invoiceB.id, "fraud attempt").catch((e: any) => e);
    expect(res && (res.code || res.name)).toBeTruthy();
    const still = await db.query.invoices.findFirst({ where: (i, { eq }) => eq(i.id, f.invoiceB.id as any) });
    expect(still?.status).toBe("DRAFT");
  });
});
```

### 3.3 Customer List Pagination Tamper

```ts
it("listCustomers does not return other-org rows when cursorId is forged", async () => {
  const callerA = makeCaller({ userId: f.userA.id, orgId: f.orgA.id });
  const page = await callerA.customer.list({
    limit: 10,
    // Point cursor at a customer belonging to org B
    cursor: f.customerB.id,
  });
  expect(page.items.map((c: any) => c.id)).not.toContain(f.customerB.id);
  for (const c of page.items) expect(c.organizationId).toBe(f.orgA.id);
});
```

---

## 4. Portal (Public) Tenant Isolation

Customer portal URL is `/p/{slug}/invoices/{id}`. The slug must belong to the org that owns the invoice.

```ts
// tests/integration/tenant-isolation/portal.spec.ts
import { describe, it, expect, beforeAll } from "vitest";
import { seedTwoOrgs } from "../../fixtures/two-orgs";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { customers, invoices } from "@/lib/db/schema";

describe("TENANT ISOLATION — customer portal slug scoping", () => {
  let f: Awaited<ReturnType<typeof seedTwoOrgs>>;
  beforeAll(async () => {
    f = await seedTwoOrgs();
    // Publish portal slugs for each org
    await db.update(organizations).set({ portalSlug: "org-a-portal" })
      .where(eq(organizations.id, f.orgA.id));
    await db.update(organizations).set({ portalSlug: "org-b-portal" })
      .where(eq(organizations.id, f.orgB.id));
  });

  it("GET /p/{wrong-slug}/invoices/{invoiceId} returns 404, not 403", async () => {
    // Using org B's valid invoice id but org A portal slug → 404 to avoid existence oracle
    const statuses = await Promise.all([
      fetchPortal("org-a-portal", f.invoiceB.id).then(r => r.status),
      fetchPortal("org-b-portal", f.invoiceA.id).then(r => r.status),
    ]);
    expect(statuses).toEqual([404, 404]);
  });

  it("returns 200 only when slug + invoice match", async () => {
    const r = await fetchPortal("org-a-portal", f.invoiceA.id);
    expect(r.status).toBe(200);
    const body = await r.text();
    expect(body).toContain(f.invoiceA.number);
    expect(body).not.toContain(f.invoiceB.number);
  });
});
```

---

## 5. Export & Report Endpoints

CSV / XLSX reports are a classic isolation gap:

```ts
it("report.csv export contains ONLY rows from caller org", async () => {
  const csv = await callerA.reports.revenueCsv({ year: 2026 });
  const rows = csv.split("\n").slice(1);
  expect(rows.join(",")).not.toContain("Org B");
  expect(rows.join(",")).not.toContain(f.invoiceB.number);
  // Every org id in CSV must equal caller's org
  const orgIds = rows.map(r => r.split(",")[0]);
  for (const id of orgIds) if (id) expect(id).toBe(f.orgA.id);
});
```

---

## 6. Continuous Coverage

Every new route added must have a matching cross-tenant probe added to `tests/integration/tenant-isolation/`. A repo-level check blocks PRs when a route is detected to be missing from the probe list:

```bash
pnpm test:int tenant-isolation --coverage
# Coverage threshold: 100% of routes touched by isolation suite
```
