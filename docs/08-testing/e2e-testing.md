# End-to-End Testing

> Playwright + seeded DB + Mailpit + Stripe test mode. Full tenant workflow walkthrough.

---

## 1. Playwright Config

```ts
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: [
    ["html", { open: "never", outputFolder: "./playwright-report" }],
    ["junit", { outputFile: "./playwright-report/results.xml" }],
    ["list"],
  ],
  outputDir: "./playwright-report/artifacts",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: process.env.CI ? true : false,
  },
  webServer: process.env.CI ? undefined : {
    // Local runs: auto-start next dev build
    command: "pnpm next start -p 3001",
    url: BASE_URL,
    reuseExistingServer: true,
    cwd: path.resolve(__dirname),
  },
  projects: [
    {
      name: "setup",
      testMatch: "**/*.setup.ts",
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 14"] },
      dependencies: ["setup"],
    },
    {
      name: "tablet",
      use: { viewport: { width: 768, height: 1024 } },
      dependencies: ["setup"],
    },
  ],
});
```

---

## 2. Global Setup — Seed + Storage State

```ts
// tests/e2e/auth.setup.ts
import { test as setup } from "@playwright/test";
import path from "node:path";

const authFile = path.resolve(__dirname, "storage-state/owner.json");

setup("authenticate as owner@acme.test", async ({ page, request }) => {
  // Reset DB to known fixture
  await request.post("/api/_testing/reset", { data: { fixture: "default" } });

  await page.goto("/login");
  await page.getByLabel("Email").fill("owner@acme.test");
  await page.getByLabel("Password").fill("Testpass1!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/dashboard", { waitUntil: "networkidle" });

  await page.context().storageState({ path: authFile });
});
```

```ts
// tests/e2e/fixtures.ts
import { test as base } from "@playwright/test";
import path from "node:path";

export const test = base.extend<{}>({
  storageState: ({}, use) => use(path.resolve(__dirname, "storage-state/owner.json")),
});
export { expect } from "@playwright/test";
```

---

## 3. Example: Full Tenant Workflow

> Register org → create customer → create invoice → open portal → pay via Stripe test card → verify PAID in dashboard.

```ts
// tests/e2e/tenant-full-workflow.spec.ts
import { test, expect } from "./fixtures";
import { createId } from "@paralleldrive/cuid2";

test.describe.serial("full tenant billing workflow", () => {
  const orgSlug = "org-" + createId().slice(0, 10);
  const ownerEmail = `owner-e2e-${orgSlug}@example.com`;
  const customerEmail = `customer-${orgSlug}@example.com`;

  test("1. register a new organization and land on dashboard", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Full name").fill("E2E Owner");
    await page.getByLabel("Work email").fill(ownerEmail);
    await page.getByLabel("Password", { exact: true }).fill("Testpass1!");
    await page.getByLabel("Confirm password").fill("Testpass1!");
    await page.getByLabel("Organization name").fill("E2E " + orgSlug);
    await page.getByLabel("Organization slug").fill(orgSlug);
    await page.getByLabel("Country").selectOption({ label: "South Africa" });
    await page.getByLabel("Base currency").selectOption("ZAR");

    await page.getByRole("button", { name: "Create organization" }).click();

    await page.waitForURL(/\/verify/);
    // Dev mode: any 6 digits verify
    const codeInputs = page.getByRole("spinbutton");
    for (let i = 0; i < 6; i++) await codeInputs.nth(i).fill(String(i + 1));
    await page.waitForURL("/dashboard", { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  test("2. create a new customer", async ({ page }) => {
    await page.goto("/customers/new");
    await page.getByLabel("Customer name").fill("North Beach Investments");
    await page.getByLabel("Email").fill(customerEmail);
    await page.getByLabel("Phone", { exact: true }).fill("+27210000000");
    await page.getByLabel("Street address").fill("1 North Beach Rd");
    await page.getByLabel("City").fill("Durban");
    await page.getByLabel("Postal code").fill("4001");

    await page.getByRole("button", { name: "Save customer" }).click();
    await page.waitForURL(/\/customers\/[^/]+$/);
    await expect(page.getByText("North Beach Investments")).toBeVisible();
  });

  test("3. create and send a draft invoice", async ({ page }) => {
    await page.goto("/invoices/new");
    await page.getByLabel("Customer").click();
    await page.getByRole("option", { name: "North Beach Investments" }).click();

    // Issue + due dates
    await page.getByLabel("Issue date").fill("2026-05-01");
    await page.getByLabel("Due date").fill("2026-06-01");

    // First line
    await page.getByRole("textbox", { name: "Description 1" }).fill("Office rental — May 2026");
    await page.getByRole("spinbutton", { name: "Qty 1" }).fill("1");
    await page.getByRole("spinbutton", { name: "Rate 1" }).fill("12000");

    // Add second line
    await page.getByRole("button", { name: "+ Add line item" }).click();
    await page.getByRole("textbox", { name: "Description 2" }).fill("Parking bay 14");
    await page.getByRole("spinbutton", { name: "Qty 2" }).fill("1");
    await page.getByRole("spinbutton", { name: "Rate 2" }).fill("600");

    // Assert summary updates (15% VAT)
    await expect(page.getByTestId("invoice-subtotal")).toContainText("R12,600.00");
    await expect(page.getByTestId("invoice-total")).toContainText("R14,490.00");

    await page.getByRole("button", { name: "Create & send invoice" }).click();
    await page.waitForURL(/\/invoices\/[^/]+$/);
    await expect(page.getByTestId("invoice-status")).toHaveText(/Sent|Viewed/);
  });

  test("4. customer portal: view invoice and pay with Stripe test card", async ({ browser, request }) => {
    // 4a. Fetch portal link via internal testing API
    const { portalLink } = await (await request.get(
      "/api/_testing/latest-portal-link?email=" + encodeURIComponent(customerEmail)
    )).json();

    const ctx = await browser.newContext({ storageState: undefined });
    const portal = await ctx.newPage();
    await portal.goto(portalLink);
    await expect(portal.getByText("R14,490.00")).toBeVisible();

    await portal.getByRole("button", { name: /Pay R14,490/ }).click();
    // Stripe Elements embedded form
    await portal.frameLocator("iframe[name^='__privateStripeFrame']").getByPlaceholder("1234 1234 1234 1234").fill("4242 4242 4242 4242");
    await portal.frameLocator("iframe[name^='__privateStripeFrame']").getByPlaceholder("MM / YY").fill("1234");
    await portal.frameLocator("iframe[name^='__privateStripeFrame']").getByPlaceholder("CVC").fill("123");
    await portal.getByRole("button", { name: "Pay" }).click();
    await expect(portal.getByText("Payment successful")).toBeVisible({ timeout: 20_000 });
    await ctx.close();
  });

  test("5. verify dashboard shows invoice as PAID", async ({ page }) => {
    await page.goto("/dashboard");
    const paidTile = page.getByTestId("kpi-paid-count");
    // Wait for webhook propagation
    await expect.poll(() => paidTile.textContent(), { timeout: 20_000 }).toMatch(/^1$/);
    await page.goto("/invoices");
    await expect(page.getByRole("row").filter({ hasText: "North Beach Investments" })).toContainText("Paid");
  });
});
```

---

## 4. Example: Password Reset via Mailpit

```ts
// tests/e2e/password-reset.spec.ts
import { test, expect } from "@playwright/test";

test("forgot password flow sends reset link via Mailpit", async ({ page, request }) => {
  // Clear Mailpit mailbox
  await request.delete("http://127.0.0.1:8025/api/v1/messages");

  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill("owner@acme.test");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(/check your inbox/)).toBeVisible();

  // Poll Mailpit for the email
  const msgs = await expect.poll(async () => {
    const res = await request.get("http://127.0.0.1:8025/api/v1/search?query=Reset%20password");
    const json = await res.json();
    return json.messages ?? [];
  }, { timeout: 15_000 }).toHaveLength(1);

  const msg = msgs[0];
  const body = await (await request.get(`http://127.0.0.1:8025/api/v1/message/${msg.ID}`)).json();
  const match = body.HTML.toString().match(/href="([^"]*\/reset-password[^"]+)"/);
  expect(match).toBeTruthy();

  await page.goto(match![1]);
  await page.getByLabel("New password").fill("NewTestpass2!");
  await page.getByLabel("Confirm new password").fill("NewTestpass2!");
  await page.getByRole("button", { name: "Reset password" }).click();
  await page.waitForURL("/login");
  // Sign in with new password
  await page.getByLabel("Email").fill("owner@acme.test");
  await page.getByLabel("Password").fill("NewTestpass2!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/dashboard");
});
```

---

## 5. Running

```bash
# local (requires running next start on 3001)
pnpm test:e2e
pnpm test:e2e tenant-full-workflow
pnpm test:e2e --ui                 # playwright inspector

# CI: matrix shard 1..6
pnpm playwright test --shard=1/6
```
