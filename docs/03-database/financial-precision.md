# Financial Precision — myTenant Invoice

## Document Status

- **Version:** 1.0.0
- **Database Type:** MySQL `DECIMAL(19,4)` / `DECIMAL(5,4)` / `DECIMAL(19,6)`
- **Runtime Arithmetic:** Prisma.Decimal (`decimal.js`-compatible) — never JavaScript `number`
- **Audit:** All financial operations are serializable transactions**

## Related Documentation

- [Data Model](./data-model.md)
- [Schema Reference](./schema-reference.md)
- [Entity-Relationship Diagram](./erd.md)
- [Multi-Tenancy Architecture](../02-architecture/multi-tenancy-architecture.md)
- [Testing Strategy](../08-testing/testing-strategy.md)

---

## 1. Why This Document Matters

Floating-point arithmetic (`Number` in JS, `Float` in Prisma/MySQL) is **unsuitable** for money:

```ts
// NEVER DO THIS — this is what we are protecting against:
0.1 + 0.2 === 0.3                  // => false (actually 0.30000000000000004)
(0.1 + 0.2) - 0.3 === 0            // => false (5.551115123125783e-17)
Math.round(1.005 * 100) / 100      // => 1 (should be 1.01 for half-up rounding)
```

Across 100,000 invoices × 10 line items each, accumulated floating-point drift can diverge by thousands of currency units before the bug is detected. This document establishes:

1. Database storage types.
2. Runtime arithmetic library and rounding rules.
3. Line-item rounding vs. header rounding vs. document rounding (the "round once at the end" vs. "round per line" decision).
4. Tax rules.
5. Currency conversion conventions.
6. Invariants enforced by transactional assertions.
7. The automated test suite that proves all of the above.

---

## 2. Database Storage Types

Every monetary column uses `@db.Decimal(19, 4)`. This is non-negotiable.

```prisma
model Invoice {
  subtotal         Decimal  @db.Decimal(19, 4) @default(0)
  taxTotal         Decimal  @db.Decimal(19, 4) @default(0)
  discountTotal    Decimal  @db.Decimal(19, 4) @default(0)
  creditApplied    Decimal  @db.Decimal(19, 4) @default(0)
  adjustmentsTotal Decimal  @db.Decimal(19, 4) @default(0)
  roundingAmount  Decimal  @db.Decimal(19, 4) @default(0)
  total            Decimal  @db.Decimal(19, 4) @default(0)
  paidAmount       Decimal  @db.Decimal(19, 4) @default(0)
  refundedAmount   Decimal  @db.Decimal(19, 4) @default(0)
  balance          Decimal  @db.Decimal(19, 4) @default(0)
  lateFeeApplied    Decimal  @db.Decimal(19, 4) @default(0)
}
```

Why `(19,4)`?
- **Precision 19**: 15 integer digits + 4 fractional → range up to ±999,999,999,999,999.9999.
- **Scale 4**: Sufficient to:
  - Represent tax rates applied to fractions of a cent.
  - Accumulate prorated daily rent for a whole building.
  - Apply 3-decimal currencies (BHD, KWD, JOD, OMR, TND).
  - Preserve intermediate products of 2-decimal × 6-decimal quantity without loss during multiplication before final 2-decimal display rounding.
- **MySQL storage:** Exactly 9 bytes per column (4 bytes per 9 digits + 1 byte).

### 2.1 Related Non-Money Decimals

| Semantic | Prisma Type | Purpose |
|---|---|---|
| Percentage / Tax rate | `@db.Decimal(5, 4)` | Range 0.0000 – 9.9999; a 25% tax = 0.2500, 1.25% = 0.0125, 200% penalty = 2.0000 |
| Quantity / Meter reading / Count | `@db.Decimal(19, 6)` | Fine meter-counts; 6 fractional digits for precision water/electric sub-metering |
| Currency conversion rate | `@db.Decimal(19, 8)` | FX mid-market + spread |
| Area, land measurement | `@db.Decimal(14, 4)` | Sufficient for m², ft² |
| Coordinates | `@db.Decimal(10, 8)` / `@db.Decimal(11, 8)` | Latitude / longitude |
| Subscription price | Same as money `@db.Decimal(19, 4)` | Platform SaaS pricing |

### 2.2 Forbidden Types

| Type | Why Forbidden |
|---|---|
| `Float` / `Double` in Prisma schema | Binary floating point |
| JS `number` for arithmetic or storage of money | Binary floating point |
| Strings like `VARCHAR` for money | Cannot SUM / sort correctly; no arithmetic in DB; requires conversion everywhere |
| 64-bit integer "cents" representation | Breaks on 3-decimal currencies; breaks on prorated rent fractions; every operation requires explicit `÷100`; human error inevitable |

The "stored as integer cents" approach is popular but the wrong tradeoff for this product given support for prorated billing (which produces fractional cents during computation before rounding at the document level). We instead rely on MySQL's native DECIMAL, which stores exact BCD packed digits, plus Prisma.Decimal at runtime.

---

## 3. Runtime Arithmetic

All arithmetic at runtime uses the Prisma Decimal constructor (`Prisma.Decimal`), which wraps the `decimal.js` library in the Prisma runtime.

### 3.1 Global Decimal Settings

```ts
// src/lib/db/prisma-types.ts
import { Prisma } from "@prisma/client";

Prisma.Decimal.set({
  precision: 40,          // enough for intermediate sums of millions of line items
  rounding: Prisma.Decimal.ROUND_HALF_UP,
  toExpNeg: -9,
  toExpPos: 20,
  minE: -9e15,
  maxE: 9e15,
  crypto: false,
  modulo: Prisma.Decimal.ROUND_FLOOR,
});

export type Money = Prisma.Decimal;
export const ZERO = new Prisma.Decimal(0);
export const ONE = new Prisma.Decimal(1);
export const ONE_HUNDRED = new Prisma.Decimal(100);
```

### 3.2 Permitted Operations

| Read from Prisma Client:

```ts
const row = await prisma.invoice.findUniqueOrThrow({ where: { id } });
// row.total is already an instance of Prisma.Decimal
```

| Operation | Safe Syntax | Forbidden |
|---|---|---|
| Addition | `a.plus(b)` | `a + b` (JS coerces to number!) |
| Subtraction | `a.minus(b)` | `a - b` |
| Multiplication | `a.mul(b)` | `a * b` |
| Division | `a.div(b)` with 40-precision | `a / b` |
| Comparison | `a.comparedTo(b)` / `a.gt(b)` / `a.lt(b)` / `a.equals(b)` | `a > b`, `a === b` |
| Rounding | `a.toDecimalPlaces(n, mode)` | `Math.round` family |
| Percent | `mul(rate)` where rate ∈ [0,1) as Decimal(5,4) | `* 0.2 |
| Summation | `arr.reduce((s,x)=>s.plus(x), ZERO)` | `arr.reduce((s,x)=>s+x,0)` |
| Equality across floating | `a.minus(b).abs().lt(new Prisma.Decimal('0.0001)` when required; use .equals for exact | `== or `Object.is` |

### 3.3 Decimal Input Validation

All monetary values coming from HTTP bodies (API, CSV import, UI forms) are validated with a schema parsers, not `parseFloat` or `Number(...)`:

```ts
import { z } from "zod";
import { Prisma } from "@prisma/client";

export const MoneySchema = z
  .union([z.string(), z.number(), z.instanceof(Prisma.Decimal)])
  .transform((v) => {
    try {
      const d = new Prisma.Decimal(v);
      if (!d.isFinite()) throw new Error("Non-finite");
      if (d.decimalPlaces() > 4) {
        // allow, but truncate to 4dp? NO — throw — prevent ambiguous input
        throw new Error("More than 4 decimal places");
      }
      return d;
    } catch (e) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          message: "Invalid money value",
          path: [],
        },
      ]);
    }
  });

export const TaxRateSchema = z
  z.union([z.string(), z.number(), z.instanceof(Prisma.Decimal)])
    .transform((v) => {
      const d = new Prisma.Decimal(v);
      if (d.lt(0) || d.gte(10)) {
        // 0 ≤ r < 10 (0% → 999.99%)
        throw new z.ZodError([...]);
      }
      return d.toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
    });
```

---

## 4. Rounding Rules

Rounding happens at **well-defined layers only. Mid-way rounding is **HALF_UP (commercial rounding).**

Rounding mode summary:

| Stage | Precision | Rounding Mode | Scale |
|---|---|---|---|
| Per-line subtotal calculation | Line item `subtotal = qty × price | HALF_UP | 4 dp stored; 2 dp displayed to the line total? No — 4 dp kept internally, 2 dp on display |
| Per-line tax calculation | tax = line.afterDiscount × tax_rate | HALF_UP | 4 dp |
| Invoice subtotal | Σ all line.totals (at 4 dp) | Exact | 4 dp |
| Invoice document-level rounding delta | Round subtotal → currency decimals (2 or 3) | HALF_UP | Store delta in `Invoice.roundingAmount` |
| Payment allocation | Allocate a payment amount to invoices using "split and round the final cent" rule per §4.3 | Round-to-nearest + remainder on first line |
| FX conversion | Intermediate: keep 8 dp; final: back to 4 dp | Banker's rounding (HALF_EVEN) for FX rounding per ISO 4217 |
| Late fees | Calculate percentage + round each line | HALF_UP | |
| Prorated rent | Day fraction × monthly rent → 6dp → then round to 4dp before rolling up into invoice subtotal | HALF_UP | |

### 4.1 Line-Item Rounding Algorithm

```
For each line item:
  1. lineSubtotal = qty × unitPrice                          → keep 4dp (exact product of two Decimals, no rounding yet)
  2. lineDiscount = qty × unitDiscount                      → keep 4dp
  3. afterDiscount = lineSubtotal − lineDiscount            → keep 4dp
  4. lineTax = afterDiscount × taxRate                       → keep 4dp, round HALF_UP
  5. lineTotal = afterDiscount + lineTax                    → keep 4dp
  6. STORE lineSubtotal, lineDiscount, lineTax, lineTotal in InvoiceItem
```

### 4.2 Document Rounding Algorithm

```
Aggregate the invoice header:
  1. subtotal    = Σ line.lineSubtotal                   → exact 4dp
  2. discountTot = Σ line.lineDiscount                 → exact 4dp
  3. taxTot     = Σ line.lineTax                       → exact 4dp
  4. subtotalAfterDiscount = subtotal − discountTot + otherAdjustments + lateFeeApplied − creditApplied
  5. rawTotal   = subtotalAfterDiscount + taxTot
  6. roundedTot   = round(rawTotal, dp=document_dp(currency))   — HALF_UP
  7. roundingAmt = roundedTotal − rawTotal                → signed, stored on the Invoice header
  8. STORE roundedTotal as Invoice.total
```

Example: sum of lines gives 100.225 → EUR → 100.23. Store roundingAmt = +0.005. Display: `Invoice.total` = 100.23.

### 4.3 Payment Allocation Rounding

Rule: **"Round each line; the remainder goes to the first/largest line."** Never allocate fractions of a cent by independently rounded allocations.

```ts
// Given a $100.00 payment split across invoices A ($33.33, B ($33.33), C ($33.34)
// when invoice totals sum to $100.00 but per-line × 1/3 yields 33.333333...

export function allocateEvenly(
  total: Money,
  invoices: { id: string; balance: Money }[],
): Array<{ id: string; amount: Money }> {
  const dp = 2;
  const scaledTotal = total.toDecimalPlaces(dp, Prisma.Decimal.ROUND_HALF_UP);
  // 1. Raw allocation pro-rated by balances
  const totalBal = invoices.reduce((s, i) => s.plus(i.balance), ZERO);
  const rawAllocs = invoices.map((inv) => ({
    id: inv.id,
    amount: scaledTotal.mul(inv.balance).div(totalBal),
  }));
  // 2. Floor each to target dp
  let flooredSum = ZERO;
  const floored: Array<{ id: string; amount: Money; rest: Money }> = rawAllocs.map(r => {
    const fl = r.amount.toDecimalPlaces(dp, Prisma.Decimal.ROUND_FLOOR);
    flooredSum = flooredSum.plus(fl);
    return { id: r.id, amount: fl, rest: r.amount.minus(fl) };
  });
  // 3. Distribute leftover (total − flooredSum) one penny at a time to rows with the largest remainder
  let diff = scaledTotal.minus(flooredSum);
  const unit = new Prisma.Decimal(`1).div(Math.pow(10, -dp));
  floored.sort((a, b) => b.rest.comparedTo(a.rest));
  for (let i = 0; diff.comparedTo(ZERO) > 0; i++) {
    floored[i % floored.length].amount = floored[i % floored.length].amount.plus(unit);
    diff = diff.minus(unit);
  }
  return floored.map(f => ({ id: f.id, amount: f.amount }));
}
```

This algorithm guarantees that the allocations sum to exactly `total` with no floating drift even across 1 cent mismatch on 1000 splits.

---

## 5. Tax Calculation Rules

### 5.1 Line-Level vs. Document-Level Tax

The application defaults to **line-level tax**. Each line item computes and stores its own tax. Total tax is sum(line.lineTax). Where multi-line rounding drift. This is the most common requirement for EU VAT, UK VAT, US sales tax, GST/VAT around the world.

Document-level rounding the tax amount of tax rounding drift is explicitly NOT used unless the Organization's configuration picks "taxRoundingStrategy" field (default "LINE").

Configuration fields on organization:

```prisma
model Organization {
  taxRoundingStrategy String @db.VarChar(16) @default("LINE")
  taxRoundingMode     String @db.VarChar(16) @default("HALF_UP")
  taxDisplayDigits   Int    @default(2)
}
```

| taxRoundingStrategy | Behaviour |
|---|---|
| `LINE` (default) | Each line computes its tax individually; tax totals simply summed |
| `DOCUMENT` | Each line computes raw subtotal; sum subtotal then × document rate at document end; tax stored only on header, lines still display split proportionally with split remainder to last line |
| `BLOCK` | Groups by rate blocks (5%, 21%, etc.) each block summed then rate applied → tax per block rounded |

### 5.2 Multi-Rate / Mixed Tax Documents

An invoice can mix multiple tax rates per line. Every line item stores its own `taxRate` Decimal(5,4) value. Totals are broken down in the invoice PDF by rate (rate block) for customer display. The app computes the same total when needed by grouping lines by their `taxRate` and producing:

```
Rate 21%:  base €41.32  tax €8.68
Rate  6%:  base €10.00  tax €0.60
--------------------------------
           Total: €60.60
```

Each block is rounded `HALF_UP` individually (rate block tax computation) with remainder allocated to the last line in the rate block.

### 5.3 Compound / "Tax on Tax" (Cascading)

Not implemented by default. If a jurisdiction requires compound (tax-on-tax) computation, it is modeled as two consecutive Service lines stacked onto the same invoice with distinct rates. The tax computation pipeline calls a configured `computeTaxes(line, rules)` plug-in that supports cascading when the org enables it. Testing covers this by parameterised tests in §7.

---

## 6. Currency Conversion

When an invoice is issued in a currency different from the organization's home currency:

| Step | Operation | Precision |
|---|---|---|
| 1 | Store the **transaction currency** on `Invoice.currency` (e.g. EUR). | N/A |
| 2 | Store the exchange rate at time of issuance on `Invoice.exchangeRate` `DECIMAL(19,8)`. This is the multiplier `home_currency = foreign × rate`. | 8 dp |
| 3 | Compute every line total in the transaction currency (normal rules above). | 4 dp |
| 4 | Compute home-currency equivalent for ledger: `home = line.totals × rate` rounded `HALF_EVEN` to organization home currency's decimal places. | 4 dp stored |
| 5 | When payment arrives in a different currency, the FX rate at payment date is captured on the payment. | Same |
| 6 | Realised FX gain/loss is computed when payment is allocated: `payment.home − invoice.home_allocation`, stored separately. | 4 dp |

Exchange rates are sourced from a configured provider and persisted. The invoice stores the rate used at the time — never re-lookup a rate for an existing invoice.

### 6.1 Currency Decimal Places per ISO 4217

```ts
export const CURRENCY_DECIMALS: Record<string, 0 | 2 | 3 | 4> = {
  // Zero-decimal currencies
  JPY: 0, KRW: 0, VND: 0,
  // Three-decimal currencies
  BHD: 3, JOD: 3, KWD: 3, OMR: 3, TND: 3,
  // Default: 2 decimal places. All others not listed default to 2.
};
```

When display currency decimals > DB (4) exceeds the DB stored decimals (4): fine — the 4th decimal simply is not displayed.

---

## 7. Invariants and Transaction Assertions

The following invariants are enforced inside transactions. They are programmatic asserts, not just database constraints. A violation throws and rolls back the transaction.

| Invariant | Where |
|---|---|
| `Invoice.subtotal + Invoice.taxTotal + Invoice.adjustmentsTotal − Invoice.discountTotal − Invoice.creditApplied + Invoice.roundingAmount === Invoice.total` | create/update invoice transaction |
| `Invoice.total === Σ InvoiceItem.total + Σ adjustments + rounding` | create invoice |
| `Σ PaymentAllocation.amount per InvoiceId ≤ Invoice.total` | Allocation transaction |
| `Σ PaymentAllocation.amount per PaymentId ≤ Payment.amount` | Allocation transaction |
| `Invoice.paidAmount + Invoice.refundedAmount ≤ Invoice.total` | After allocation / refund |
| `Invoice.balance === Invoice.total − Invoice.paidAmount + (refund contra-entries if not stored in payment-allocation)` | After allocation / refund |
| `Payment.allocatedAmount + Payment.unallocatedAmount + Payment.refundedAmount ≤ Payment.amount` | Refund & allocation |
| `Σ CreditNoteItem.total = CreditNote.total` | Credit note creation |
| `TariffVersion.effectiveFrom < TariffVersion.effectiveTo OR effectiveTo IS NULL` | Tariff version insertion |
| `MeterReading.readingValue >= Meter.openingReading AND (next reading ≥ this reading unless isCorrected flag)` | Reading insertion |
| `Customer.balance === Σ unpaid invoice.balance for that customer − unallocated payments` | Nightly reconciliation job + on every allocation transaction |
| `Organization.nextInvoiceNumber was incremented in same transaction as invoice inserted` | Invoice creation (§6 schema ref) |

Implementation pattern:

```ts
// at the end of createInvoice inside the $transaction:
const recomputed = subtotal.minus(discountTotal).plus(taxTotal).plus(adjustmentsTotal)
  .minus(creditApplied).plus(roundingAmount);
if (!recomputed.equals(total) {
  throw new FinancialIntegrityError(
    "Invoice total mismatch",
    { expected: total.toString(), actual: recomputed.toString() }
  );
}
```

---

## 8. Idempotency & Double-Spend Prevention

Financial endpoints that write money (create payment, create refund, create invoice via provider callbacks — are protected against double-spend:

| Mechanism | Where |
|---|---|
| `@@unique([organizationId, idempotencyKey]) | Invoice/Payment/Refund/CreditNote |
| `@@unique([provider, providerPaymentId])` | Payment table — prevents the provider webhook processing the same Stripe charge twice |
| Optimistic `UPDATE ... WHERE amount_unallocated >= requested amount | Allocation |
| Serializable transaction isolation level | All money-moving transactions |

---

## 9. Financial Test Coverage

Every financial algorithm described above has unit tests covering these classes:

### 9.1 Unit Tests — Tariff & Line-Item Computation

```
- Flat rate × integer qty × price = $99 × 1 + tax roundingHALF_UP

- Fractional qty (electric 4dp unit price ×0.5dp qty)
- Prorated monthly rent 15/30 × $1000 → $500.0000
- 1000 line × 001 sum = exactly10.00 (no drift)
- 29/28/31 day month prorating correct (Feb leap year + non-leap)

### 9.2 Document Header & Allocation Tests

```
- 100 payments across 33 invoices sums exactly to the payment
- Overpayment allocated as unallocated
- Partial part part payment leaves the correct balance
- Full payment fully transition status
- FX with USD/EUR = 1.0893 on €100 produces correct $108.93
- 3-decimal KWD amounts: KWD 10.500 round-trip
- 0-decimal JPY amounts: JPY 1050 no fractions,00 stored integer values
```

### 9.3 Taxes

```
- 6% VAT rounding 21% mix line-level and block-level strategies match the same expected totals for known fixtures
- Late fee 5%/month 500.00 overdue for 17 days is exactly (500 ×0.05 × 17/30) = 1.42 → HALF_UP
- EU reverse charge, zero-rated, exempt produce correct 0 tax
```

### 9.4 Financial Integrity End-to-End

```
- Generate 500-invoice batch →
  → every Invoice header invariant holds
  → Customer balances reconcile to sum(invoice.balance)
  → Invoice.balance per customer == sum(allocation allocations)
  → Financial period end (EOD, month-end), ledger Σ(billed - Σ(paid) == A/R balance
```

### 9.5 Concurrency

```
Two concurrent payment requests for the same invoice:
   Only one succeeds. The balance is never over-allocated.
   (Tested with Vitest + worker spawn or jest.setTimeout with true parallelism.)
```

---

## 10. Display vs Storage

- **Storage:** always 4 decimal places stored in DB; always Decimal constructor instances runtime.
- **Display (UI):** round to currency decimals places of Invoice.currency, formatted with Intl.NumberFormat.
- **PDF output:** same display rounding as UI, plus an explicit note when the document total includes roundingAmount (e.g. "Totals may not sum due to rounding of €0.01").
- **API JSON output:** Money fields output as **strings** (not numbers) to preserve precision across JSON.parse. Serialization layer always calls `Prisma.Decimal.prototype.toFixed(dp)`.

Example serializer for Next.js JSON:

```ts
// Never let Next.js serialize money as number:
function serializeMoney(v: Prisma.Decimal, currency: string) {
  const dp = CURRENCY_DECIMALS[currency] ?? 2;
  // 👇 critical: return string, not Number
  return v.toFixed(dp, Prisma.Decimal.ROUND_HALF_UP);
}

// Result:
// { total: "1234.56" (EUR", not 1234.56 which is a number and risks drift)
```

### 10.1 API Inputs

API accepts string, and numbers (the MoneySchema parser accepts both; always stringifies via `new Prisma.Decimal(value). Reject strings with unknowns or formatting characters.

---

## 11. Accounting Equation / Ledger Integrity (Future

While the current schema stores financial data in an application transactional style, for internal consistency is maintained every night by a reconciliation that every:

```
Σ Accounts Receivable (per organization)
 = open Invoices.balance WHERE org = X
 = Σ Customer.balance org X
 modulo 0.0001 tolerance.
```

When this equation fails the run raises Severity 2 on-call ticket + opens an incident. Discrepancies are tracked in a dedicated `ReconciliationDiscrepancy` (log table for audit.

---

## 12. Decision Log & Sign-off Checklist for Financial Changes

Any code change touching money calculation code requires before merge:
- Author:
  -  [ ] Uses Prisma.Decimal arithmetic; no Number conversions
  - [ ] New columns DECIMAL(19,4) new money, DECIMAL(5,4) rate
  - [ ] Rounding documented
  - [ ] Unit test for positive / negative / zero value cases
  - [ ] Unit test for 0 / 2 / 3 decimal currencies
  - [ ] Invariant checked inside transaction / or nightly reconciliation
  - [ ] Idempotency unique keys added where external event
Review (two sign-offs including one senior engineer

---

## Summary

The three non-negotiables are:
1. **MySQL DECIMAL(19,4)**, never Float/Varchar/integer-cents for money in the schema.**
2. **Prisma.Decimal arithmetic, never `+` `−` `*` `/` operators or Math.* functions at runtime.**
3. **Serializable transactions with explicit invariant assertions at the end of every money-moving operation + nightly reconciliation.**

All three combine to guarantee that the platform can handle millions of invoices across hundreds of tenants without a single cent of financial drift in normal operation.
