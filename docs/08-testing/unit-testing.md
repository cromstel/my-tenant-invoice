# Unit Testing

> Vitest · Testing Library · tariff calculator deep-dive examples. Pure logic, no I/O.

---

## 1. Vitest Config

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./") },
  },
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/unit/setup.ts"],
    include: ["tests/unit/**/*.spec.ts", "tests/unit/**/*.spec.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      include: ["lib/**", "components/**"],
      exclude: ["lib/**/*.d.ts", "components/ui/**", "**/*.stories.*"],
    },
    poolOptions: {
      threads: { singleThread: false, minThreads: 1, maxThreads: 4 },
    },
  },
});
```

Setup file:

```ts
// tests/unit/setup.ts
import { beforeEach, vi } from "vitest";
import * as flags from "@/lib/feature-flags/evaluator";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();

  vi.spyOn(flags, "isFlagEnabled").mockImplementation((k) => {
    switch (k) {
      case "BULK_INVOICE_SEND": return true;
      default: return false;
    }
  });
});
```

---

## 2. Structure & Naming

```
tests/unit/
├─ billing/
│  ├─ tariff-calculator.spec.ts
│  ├─ invoice-numbering.spec.ts
│  └─ prorate.spec.ts
├─ payments/
│  ├─ signature-validator.spec.ts
│  └─ money.spec.ts
├─ auth/
│  ├─ password.spec.ts
│  └─ rbac.spec.ts
├─ components/
│  └─ line-item-editor.spec.tsx
└─ setup.ts
```

### 2.1 Test Anatomy — AAA

```ts
describe("TariffCalculator", () => {
  describe("computeMonthly", () => {
    it("applies fixed tariff + per-unit rate for 120 units", () => {
      // Arrange
      const tariff: Tariff = { baseCents: 50000, unitRateCents: 120, taxRate: 0.15 };
      const usage = 120;
      const calc = new TariffCalculator();

      // Act
      const result = calc.computeMonthly(tariff, usage);

      // Assert
      expect(result.subtotalCents).toBe(50000 + 120 * 120);           // 64400
      expect(result.taxCents).toBe(Math.round(64400 * 0.15));          // 9660
      expect(result.totalCents).toBe(64400 + 9660);                    // 74060
    });
  });
});
```

---

## 3. Tariff Calculator — Full Spec Matrix

Real production example (excerpt of test matrix).

```ts
// tests/unit/billing/tariff-calculator.spec.ts
import { describe, it, expect } from "vitest";
import { TariffCalculator } from "@/lib/billing/tariff-calculator";
import type { Tariff, BillingCycle, ProratingMode } from "@/lib/billing/types";

function mkTariff(overrides: Partial<Tariff> = {}): Tariff {
  return {
    id: "tariff_1" as any,
    name: "Standard Office",
    cycle: "MONTHLY" as BillingCycle,
    baseCents: 60000,
    includedUnits: 0,
    unitRateCents: 0,
    tiers: null,
    discount: { type: "FIXED", valueCents: 0 },
    taxRate: 0.15,
    prorating: "ACTUAL_DAYS" as ProratingMode,
    ...overrides,
  };
}

describe("TariffCalculator.computeMonthly", () => {
  const calc = new TariffCalculator();

  it("returns zero subtotal when base + unit rate are zero", () => {
    const t = mkTariff({ baseCents: 0, unitRateCents: 0 });
    const r = calc.computeMonthly(t, 0);
    expect(r.subtotalCents).toBe(0);
    expect(r.taxCents).toBe(0);
    expect(r.totalCents).toBe(0);
  });

  it("adds unit rate only above included units", () => {
    const t = mkTariff({ includedUnits: 100, unitRateCents: 150 });
    // 60000 base + (150 - 100) * 150 = 60000 + 7500 = 67500
    const r = calc.computeMonthly(t, 150);
    expect(r.subtotalCents).toBe(67500);
  });

  it("does not go negative when usage < included units", () => {
    const t = mkTariff({ includedUnits: 500, unitRateCents: 200 });
    const r = calc.computeMonthly(t, 50);
    expect(r.subtotalCents).toBe(60000);
  });

  describe("tiered pricing", () => {
    it("applies progressive tiers correctly", () => {
      const t = mkTariff({
        baseCents: 0,
        tiers: [
          { upTo: 100,  unitRateCents: 100 },  // first 100 @ R1.00
          { upTo: 300,  unitRateCents: 90  },  // next 200  @ R0.90
          { upTo: null, unitRateCents: 70  },  // above     @ R0.70
        ],
      });
      const r = calc.computeMonthly(t, 500);
      // 100*100 + 200*90 + 200*70 = 10000 + 18000 + 14000 = 42000
      expect(r.subtotalCents).toBe(42000);
    });
  });

  describe("discounts", () => {
    it("applies fixed discount before tax", () => {
      const t = mkTariff({ baseCents: 100000, discount: { type: "FIXED", valueCents: 15000 } });
      const r = calc.computeMonthly(t, 0);
      expect(r.subtotalCents).toBe(85000);
      expect(r.taxCents).toBe(Math.round(85000 * 0.15));
    });

    it("caps percentage discount at 100%", () => {
      const t = mkTariff({ baseCents: 50000, discount: { type: "PERCENT", valuePct: 1.2 } });
      const r = calc.computeMonthly(t, 0);
      expect(r.subtotalCents).toBe(0);
    });

    it("never results in negative subtotal", () => {
      const t = mkTariff({ baseCents: 10000, discount: { type: "FIXED", valueCents: 20000 } });
      const r = calc.computeMonthly(t, 0);
      expect(r.subtotalCents).toBe(0);
    });
  });

  describe("tax", () => {
    it("rounds tax half-up to nearest cent", () => {
      const t = mkTariff({ baseCents: 100, taxRate: 0.15 });
      // 100 * 0.15 = 15 exactly
      expect(calc.computeMonthly(t, 0).taxCents).toBe(15);
    });
  });
});

describe("TariffCalculator.computeProrated", () => {
  const calc = new TariffCalculator();

  it("prorates ACTUAL_DAYS correctly for 15 of 30 days", () => {
    const t = mkTariff({ baseCents: 30000, prorating: "ACTUAL_DAYS" });
    const start = new Date("2026-04-16"); // 15 days left in April 2026 (30 day month)
    const cycleStart = new Date("2026-04-01");
    const cycleEnd = new Date("2026-04-30");
    const r = calc.computeProrated(t, 0, { start, cycleStart, cycleEnd });
    // 30000 * 15/30 = 15000
    expect(r.subtotalCents).toBe(15000);
  });

  it("treats 30-day month uniformly when prorating = THIRTY_DAYS", () => {
    const t = mkTariff({ baseCents: 30000, prorating: "THIRTY_DAYS" });
    // Feb 14 move-in: should be 17/30 regardless of 28-day month
    const start = new Date("2026-02-14");
    const cycleStart = new Date("2026-02-01");
    const cycleEnd = new Date("2026-02-28");
    const r = calc.computeProrated(t, 0, { start, cycleStart, cycleEnd });
    // floor(30000 * 17 / 30) = 17000
    expect(r.subtotalCents).toBe(17000);
  });
});
```

---

## 4. Mocking Boundaries

Only mock I/O-bound collaborators. Never mock the unit under test or its pure helpers.

```ts
// ❌ mocking calc methods inside calc spec
vi.spyOn(calc, "roundHalfUp").mockReturnValue(0);

// ✅ mock external provider calls
const provider = vi.mocked(StripeProvider);
provider.createPaymentIntent.mockResolvedValue({
  id: "pi_test_123", clientSecret: "pi_xxx_secret_yyy",
});
```

Date mocking:

```ts
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-01T08:00:00Z"));
});
afterEach(() => vi.useRealTimers());
```

---

## 5. Testing Components

```tsx
// tests/unit/components/line-item-editor.spec.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { InvoiceLineEditor } from "@/components/invoice/invoice-line-editor";

function TestHarness() {
  const form = useForm({ defaultValues: {
    lines: [{ id: "1", description: "Rent", quantity: 1, unitPriceCents: 50000 }],
  }});
  return <InvoiceLineEditor form={form as any} />;
}

describe("<InvoiceLineEditor />", () => {
  beforeEach(() => render(<TestHarness />));

  it("renders seed line item values", () => {
    expect(screen.getByDisplayValue("Rent")).toBeTruthy();
    expect(screen.getByDisplayValue("50000")).toBeTruthy();
  });

  it("adds a new empty line on +Add click", () => {
    fireEvent.click(screen.getByText(/Add line item/));
    const descs = screen.getAllByPlaceholderText("Description");
    expect(descs).toHaveLength(2);
  });
});
```

---

## 6. Running Unit Tests

```bash
pnpm test:unit                         # all
pnpm test:unit tariff                  # filter by filename
pnpm test:unit -t "tiered pricing"     # filter by test name
pnpm test:unit --run --coverage        # with coverage report (./coverage/)
```
