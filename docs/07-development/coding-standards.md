# Coding Standards

> Strict TypeScript · SOLID principles · clean architecture. Enforced by Biome, tsc strict, and code review.

---

## 1. TypeScript Strict

`tsconfig.json` must ship with the following enabled. Weakening any of these requires a PR comment + sign-off.

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2023"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "verbatimModuleSyntax": false,
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  }
}
```

### 1.1 Strict Null Handling — Disallowed Patterns

```ts
// ❌ Unchecked array index access
const first = items[0].name;

// ✅ Explicit narrowing
const first = items[0];
if (!first) throw new NotFoundError();
return first.name;
```

### 1.2 Domain Type Safety — Branded IDs

Never use bare `string` for identifiers. Brand them:

```ts
// lib/types/brands.ts
declare const __brand: unique symbol;
type Brand<T, B> = T & { [__brand]: B };

export type OrganizationId = Brand<string, "OrganizationId">;
export type InvoiceId      = Brand<string, "InvoiceId">;
export type CustomerId     = Brand<string, "CustomerId">;
export type TenantSlug     = Brand<string, "TenantSlug">;
```

### 1.3 Enums Over Unions for Persisted Status

Use TypeScript `as const` unions + `z.nativeEnum` only for DB enums. Prefer `enum` with explicit string values for transport:

```ts
export const InvoiceStatus = {
  DRAFT: "DRAFT", SENT: "SENT", VIEWED: "VIEWED",
  PAID: "PAID", OVERDUE: "OVERDUE", CANCELLED: "CANCELLED",
  REFUNDED: "REFUNDED",
} as const;
export type InvoiceStatus = typeof InvoiceStatus[keyof typeof InvoiceStatus];
```

---

## 2. SOLID Application

### 2.1 Single Responsibility

One file does one thing. Split long files into:

```
lib/billing/
├─ tariff-calculator.ts      # Pure math, no I/O
├─ invoice-generator.ts      # Calls calculator + persists
├─ invoice-sender.ts         # Calls mailer + portal publish
└─ index.ts                  # Barrel re-exports
```

### 2.2 Open/Closed via Strategy

Payment gateways, tax engines, and file exporters are injected strategies:

```ts
// lib/billing/tax/calculator.ts
export interface TaxEngine {
  compute(lines: TaxableLine[], countryCode: string, region?: string): TaxResult;
}

export class NoopTaxEngine implements TaxEngine { /* ... */ }
export class VatTaxEngine  implements TaxEngine { /* ... */ }
export class SalesTaxEngine implements TaxEngine { /* ... */ }
```

Pick at runtime:

```ts
export function resolveTaxEngine(org: Organization): TaxEngine {
  switch (org.taxMode) {
    case "VAT":  return new VatTaxEngine();
    case "SALES":return new SalesTaxEngine(org.region);
    default:     return new NoopTaxEngine();
  }
}
```

### 2.3 Liskov Substitution

Derived types must be interchangeable. If you write `PaymentProvider`, both `StripeProvider` and `PayGateProvider` must throw the same `PaymentDeclinedError` hierarchy on failure.

### 2.4 Interface Segregation

Repository interfaces are small per-aggregate:

```ts
// lib/db/repos/invoice-repo.ts
export interface InvoiceReadRepo {
  findById(id: InvoiceId): Promise<Invoice | null>;
  listByOrg(orgId: OrganizationId, filter: InvoiceFilter): Promise<Invoice[]>;
  countByStatus(orgId: OrganizationId, status: InvoiceStatus): Promise<number>;
}

export interface InvoiceWriteRepo {
  create(input: NewInvoice): Promise<Invoice>;
  updateStatus(id: InvoiceId, status: InvoiceStatus): Promise<void>;
  applyPayment(id: InvoiceId, cents: number): Promise<void>;
}
```

### 2.5 Dependency Injection (Server)

Compose at the route-handler level. Avoid framework DI containers; keep it explicit:

```ts
// app/(platform)/invoices/new/page.tsx
export default async function NewInvoicePage() {
  const { organizationId } = await requireSession();
  const deps = {
    customerRepo: new DrizzleCustomerRepo(db, organizationId),
    invoiceRepo:  new DrizzleInvoiceRepo(db, organizationId),
    taxEngine:    resolveTaxEngine(await currentOrg()),
    numbering:    new SequentialNumberingService(db),
  };
  // pass deps into server actions / render
}
```

---

## 3. React & Components

### 3.1 Server First — Minimize Client Components

Default to Server Components. Only mark `"use client"` when required:

| Requirement                                  | Marked `use client`? |
|----------------------------------------------|----------------------|
| Uses hooks (`useState`, `useEffect`)         | Yes                  |
| Uses event handlers (onClick, onChange)      | Yes                  |
| Uses `useSearchParams`, `usePathname`        | Yes                  |
| Renders forms with `react-hook-form`         | Yes                  |
| Pure presentational markup                   | No                   |
| Async data fetching (DB, API)                | No, server component |

### 3.2 Component File Structure

```tsx
// components/invoice/invoice-line-editor.tsx
"use client";

import * as React from "react";
import { useFieldArray } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
}

interface InvoiceLineEditorProps {
  form: ReturnType<typeof useForm<{ lines: InvoiceLine[] }>>;
  className?: string;
}

export function InvoiceLineEditor({ form, className }: InvoiceLineEditorProps) {
  const { fields, append, remove } = useFieldArray({
    control: form.control, name: "lines",
  });

  return (
    <div className={cn("space-y-3", className)}>
      {fields.map((f, i) => (
        <div key={f.id} className="grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_80px_140px_auto]">
          <Input {...form.register(`lines.${i}.description`)} placeholder="Description" />
          <Input type="number" min={1} {...form.register(`lines.${i}.quantity`, { valueAsNumber: true })} />
          <Input
            type="number"
            min={0}
            step="0.01"
            {...form.register(`lines.${i}.unitPriceCents`, { valueAsNumber: true })}
          />
          <Button variant="ghost" size="sm" type="button" onClick={() => remove(i)}>
            Remove
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        type="button"
        onClick={() => append({ id: crypto.randomUUID(), description: "", quantity: 1, unitPriceCents: 0 })}
      >
        + Add line item
      </Button>
    </div>
  );
}
```

### 3.3 Keep Props Explicit

Avoid spread of props into non-primitive children. When passing, restrict via `Pick` / `Omit`:

```ts
// ✅ explicit
type Props = Pick<React.ComponentProps<typeof Input>, "id" | "disabled" | "placeholder"> & {
  label: string;
};
```

### 3.4 Never `useEffect` for Derived State

```ts
// ❌
useEffect(() => setTotal(qty * price), [qty, price]);

// ✅
const total = qty * price;
```

---

## 4. Clean Architecture — Dependency Direction

```
lib/types        ← no external deps, zero framework
   ↑
lib/billing, lib/payments  ← pure logic, no React, no Next, no Drizzle
   ↑
lib/db           ← depends on billing types, Drizzle schema
   ↑
server/* (tRPC)  ← orchestration, session, repos
   ↑
app/* (Next)     ← UI, components, page composition
```

Server code never imports from `app/*`. UI components never import DB directly (use tRPC or server actions).

---

## 5. Linting (Biome)

```jsonc
// biome.json
{
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "complexity": { "noForEach": "error", "noExcessiveCognitiveComplexity": { "level": "error", "options": { "maxComplexity": 12 } } },
      "style": { "useImportType": "error", "useEnumInitializers": "error", "noNonNullAssertion": "error" },
      "suspicious": { "noEmptyBlockStatements": "error", "noRedeclare": "error" },
      "correctness": { "useExhaustiveDependencies": "error", "noUnusedVariables": "error" },
      "security": { "noDangerouslySetInnerHtml": "error" }
    }
  },
  "formatter": { "indentStyle": "space", "indentWidth": 2, "lineWidth": 100, "semicolons": true },
  "javascript": { "formatter": { "quoteStyle": "double", "trailingCommas": "es5" } }
}
```

### 5.1 Pre-commit Hook

```bash
# .husky/pre-commit
pnpm biome check --write --no-errors-on-unmatched --staged
pnpm typecheck
```
