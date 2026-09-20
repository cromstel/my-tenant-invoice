# Integration Testing

> Vitest + MySQL / Redis testcontainers. Exercises service + repo layer with a real database.

---

## 1. Dependencies

```jsonc
// package.json (devDependencies)
{
  "@testcontainers/mysql": "^10.13",
  "@testcontainers/redis": "^10.13",
  "mysql2": "^3.11",
  "ioredis": "^5.4"
}
```

## 2. Workspace & Config

```ts
// vitest.integration.config.ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "./") } },
  test: {
    name: "integration",
    globals: true,
    environment: "node",
    setupFiles: ["./tests/integration/setup.ts"],
    include: ["tests/integration/**/*.spec.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
```

```ts
// tests/integration/setup.ts
import { beforeAll, afterAll, beforeEach } from "vitest";
import {
  MySqlContainer, StartedMySqlContainer,
} from "@testcontainers/mysql";
import {
  RedisContainer, StartedRedisContainer,
} from "@testcontainers/redis";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";
import Redis from "ioredis";
import { db } from "@/lib/db";
import { setGlobalDb, setGlobalRedis } from "./_test-harness";

let mysqlContainer: StartedMySqlContainer;
let redisContainer: StartedRedisContainer;
let mysqlConn: mysql.Connection;
let redisClient: Redis;

beforeAll(async () => {
  [mysqlContainer, redisContainer] = await Promise.all([
    new MySqlContainer("mysql:8.0")
      .withDatabase("mytenant_test")
      .withUsername("root")
      .withUserPassword("test")
      .withExposedPorts(3306)
      .withTmpFs({ "/var/lib/mysql": "rw" })
      .start(),
    new RedisContainer("redis:7.2-alpine").start(),
  ]);

  process.env.DATABASE_URL = mysqlContainer.getConnectionUri() + "/mytenant_test";
  process.env.REDIS_URL    = redisContainer.getConnectionUrl();

  mysqlConn = await mysql.createConnection(process.env.DATABASE_URL);
  const testDb = drizzle(mysqlConn);
  await migrate(testDb, { migrationsFolder: "./drizzle" });

  redisClient = new Redis(process.env.REDIS_URL);
  setGlobalDb(testDb);
  setGlobalRedis(redisClient);
}, 120_000);

beforeEach(async () => {
  // Truncate all tables in a deterministic order (child → parent to avoid FK errors)
  const tables = [
    "audit_log", "payments", "invoice_line_items", "invoices",
    "tariff_assignments", "tariffs", "customers",
    "memberships", "users", "organizations",
  ];
  for (const table of tables) {
    await mysqlConn.query(`DELETE FROM \`${table}\``);
  }
  await redisClient.flushall();
});

afterAll(async () => {
  await Promise.all([
    mysqlConn?.end().catch(() => {}),
    redisClient?.quit().catch(() => {}),
    mysqlContainer?.stop().catch(() => {}),
    redisContainer?.stop().catch(() => {}),
  ]);
});
```

---

## 3. Example: Invoice Lifecycle Spec

```ts
// tests/integration/invoice-lifecycle.spec.ts
import { describe, it, expect } from "vitest";
import { createId } from "@paralleldrive/cuid2";
import { DrizzleOrganizationRepo } from "@/lib/db/repos/organization-repo";
import { DrizzleCustomerRepo } from "@/lib/db/repos/customer-repo";
import { DrizzleInvoiceRepo } from "@/lib/db/repos/invoice-repo";
import { InvoiceService } from "@/lib/billing/invoice-service";
import { SequentialNumberingService } from "@/lib/billing/numbering";
import { NoopTaxEngine } from "@/lib/billing/tax/noop";
import type { OrganizationId, CustomerId } from "@/lib/types/brands";
import { getTestDb } from "./_test-harness";
import { InvoiceStatus } from "@/lib/db/schema";

describe("Invoice lifecycle end-to-end (DB)", () => {
  function makeServices(orgId: OrganizationId) {
    const db = getTestDb();
    return {
      invoices:  new DrizzleInvoiceRepo(db, orgId),
      customers: new DrizzleCustomerRepo(db, orgId),
      service:   new InvoiceService({
        invoiceRepo: new DrizzleInvoiceRepo(db, orgId),
        customerRepo: new DrizzleCustomerRepo(db, orgId),
        numbering: new SequentialNumberingService(db),
        tax: new NoopTaxEngine(),
      }),
    };
  }

  async function seedOrg() {
    const db = getTestDb();
    const orgId = createId() as OrganizationId;
    const orgs = new DrizzleOrganizationRepo(db);
    await orgs.create({
      id: orgId,
      name: "Test Org Ltd",
      slug: "test-org-" + orgId.slice(0,6),
      currency: "USD",
      taxMode: "NONE",
    });
    return orgId;
  }

  async function seedCustomer(orgId: OrganizationId): Promise<CustomerId> {
    const { customers } = makeServices(orgId);
    const cid = createId() as CustomerId;
    await customers.create({
      id: cid, name: "North Beach Mall", email: "ar@northbeach.example",
    });
    return cid;
  }

  it("create → send → markPaid → status flows correctly, numbering unique", async () => {
    const orgId = await seedOrg();
    const customerId = await seedCustomer(orgId);
    const { invoices, service } = makeServices(orgId);

    const inv1 = await service.createDraft({
      customerId,
      issueDate: new Date("2026-04-01"),
      dueDate:   new Date("2026-05-01"),
      lines: [
        { description: "Rent April 2026", quantity: 1, unitPriceCents: 120000 },
        { description: "Parking bay 12",  quantity: 1, unitPriceCents: 6000  },
      ],
    });
    expect(inv1.status).toBe(InvoiceStatus.DRAFT);
    expect(inv1.number).toMatch(/^INV-\d{6}-0001$/);
    expect(inv1.subtotalCents).toBe(126000);

    const inv2 = await service.createDraft({
      customerId, issueDate: new Date("2026-04-01"),
      dueDate: new Date("2026-05-01"),
      lines: [{ description: "Cleaning", quantity: 1, unitPriceCents: 4000 }],
    });
    expect(inv2.number).toMatch(/-0002$/);

    await service.send(inv1.id);
    const afterSend = await invoices.findById(inv1.id);
    expect(afterSend?.status).toBe(InvoiceStatus.SENT);

    await service.recordPayment(inv1.id, {
      amountCents: inv1.totalCents, provider: "MANUAL", reference: "EFT #123",
    });
    const afterPay = await invoices.findById(inv1.id);
    expect(afterPay?.status).toBe(InvoiceStatus.PAID);
    expect(afterPay?.paidAt).toBeInstanceOf(Date);
  });

  it("numbering does not collide under concurrent inserts", async () => {
    const orgId = await seedOrg();
    const customerId = await seedCustomer(orgId);
    const { service } = makeServices(orgId);

    const results = await Promise.allSettled(
      Array.from({ length: 10 }).map((_, i) =>
        service.createDraft({
          customerId,
          issueDate: new Date("2026-04-01"),
          dueDate: new Date("2026-05-01"),
          lines: [{ description: `Line ${i}`, quantity: 1, unitPriceCents: 100 }],
        })
      )
    );
    const fulfilled = results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
      .map((r) => r.value.number);

    // All or nothing: no two invoices share a number
    const unique = new Set(fulfilled);
    expect(unique.size).toBe(fulfilled.length);
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
  });
});
```

---

## 4. Example: Stripe Webhook Idempotency

```ts
// tests/integration/stripe-webhook.spec.ts
import { describe, it, expect, beforeEach } from "vitest";
import { StripeWebhookHandler } from "@/lib/payments/stripe/webhook-handler";
import { DrizzleInvoiceRepo } from "@/lib/db/repos/invoice-repo";
import { DrizzlePaymentRepo } from "@/lib/db/repos/payment-repo";
import { getTestDb } from "./_test-harness";
import * as seed from "./_fixtures/org-customer-invoice";

describe("Stripe payment_intent.succeeded webhook", () => {
  let handler: StripeWebhookHandler;
  let invoiceId: string;
  let intentId: string;

  beforeEach(async () => {
    const seeded = await seed.onePaidInvoiceFixture();
    invoiceId = seeded.invoice.id;
    intentId = "pi_intent_" + Math.random().toString(36).slice(2, 10);
    const db = getTestDb();
    const orgId = seeded.org.id;
    handler = new StripeWebhookHandler({
      invoices: new DrizzleInvoiceRepo(db, orgId),
      payments: new DrizzlePaymentRepo(db, orgId),
      signingSecret: "whsec_test_secret",
    });
  });

  it("marks invoice PAID exactly once when same event delivered 3 times", async () => {
    const event = {
      id: "evt_dup001",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: intentId,
          amount: 126000,
          currency: "usd",
          metadata: { invoiceId },
        },
      },
    };

    const [a, b, c] = await Promise.all([
      handler.handleEvent(event),
      handler.handleEvent(event),
      handler.handleEvent(event),
    ]);
    expect(a.status).toBe("applied");
    expect(b.status).toBe("duplicate");
    expect(c.status).toBe("duplicate");

    const db = getTestDb();
    const payments = await db.query.payments.findMany({ where: (p, { eq }) => eq(p.invoiceId, invoiceId as any) });
    expect(payments).toHaveLength(1);
  });
});
```

---

## 5. Running

```bash
pnpm test:int                                 # all integration
pnpm test:int invoice-lifecycle               # filtered
```
