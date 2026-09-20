# Responsive Design

> Mobile-first strategy · 5 canonical breakpoints · tested viewport matrix · fluid typography.

---

## 1. Breakpoints

Single source of truth — matches Tailwind defaults. Never introduce custom device widths.

| Prefix | Min Width | Device Target              |
|--------|-----------|----------------------------|
| — (base) | 0 px    | Phone portrait (<640px)    |
| `sm:`  | 640 px    | Phone landscape, small tab |
| `md:`  | 768 px    | Tablet portrait            |
| `lg:`  | 1024 px   | Tablet landscape, small laptop (sidebar unlocks) |
| `xl:`  | 1280 px   | Laptop / standard desktop  |
| `2xl:` | 1536 px   | Large desktop / 4K         |

### 1.1 Shell Breakpoints

```tsx
// app/(platform)/layout.tsx — sidebar visibility
<PlatformSidebar className="hidden lg:flex" />

// app/(platform)/_components/platform-topbar.tsx — mobile menu toggle
<Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
  <Menu />
</Button>
```

Sidebar unlocks at `lg:` so users on small tablets get a clean, focused content view.

---

## 2. Fluid Typography

Marketing hero and page titles clamp between min/max across breakpoints, avoiding discrete jumps.

```ts
// tailwind.config.ts — extend theme with clamp() utilities
theme: {
  extend: {
    fontSize: {
      "fluid-hero": "clamp(2.5rem, 6vw + 1rem, 4.5rem)",
      "fluid-h2":   "clamp(1.75rem, 2.5vw + 1rem, 2.75rem)",
      "fluid-h3":   "clamp(1.35rem, 1.2vw + 1rem, 1.875rem)",
    },
  },
},
```

Usage in marketing:

```tsx
<h1 className="font-bold tracking-tight text-fluid-hero">
  Automate tenant invoicing & <span className="text-primary">rent collection</span>
</h1>
```

---

## 3. Grid Systems

### 3.1 Dashboard KPI Grid

```tsx
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
  <Card /> <Card /> <Card /> <Card />
</div>
```

| Breakpoint | Columns |
|------------|---------|
| base       | 1       |
| sm         | 2       |
| lg         | 4       |

### 3.2 Invoice Line Item Table → Cards (mobile)

Responsive wrapper with horizontal scroll under 768px, above uses native table.

```tsx
// components/invoice/line-items-table.tsx
import * as React from "react";

export function LineItemsTable({ items }: { items: Array<{ description: string; qty: number; rate: number; amount: number }> }) {
  return (
    <div className="w-full">
      {/* Desktop table */}
      <div className="hidden md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b text-muted-foreground">
            <tr>
              <th className="py-3 pr-4 font-medium">Description</th>
              <th className="py-3 pr-4 font-medium">Qty</th>
              <th className="py-3 pr-4 font-medium">Rate</th>
              <th className="py-3 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((l, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="py-3 pr-4">{l.description}</td>
                <td className="py-3 pr-4">{l.qty}</td>
                <td className="py-3 pr-4">${l.rate.toFixed(2)}</td>
                <td className="py-3 text-right font-medium">${l.amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="divide-y md:hidden">
        {items.map((l, i) => (
          <li key={i} className="grid grid-cols-2 gap-2 py-4">
            <div className="col-span-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Description</p>
              <p className="mt-0.5 font-medium">{l.description}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Qty</p>
              <p>{l.qty}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Rate</p>
              <p>${l.rate.toFixed(2)}</p>
            </div>
            <div className="col-span-2 text-right">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Amount</p>
              <p className="font-semibold">${l.amount.toFixed(2)}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## 4. Container Strategy

- **Marketing pages** use `.container` (center, `2xl:1400px`, padding 2rem, no sidebar).
- **Platform pages** do not use `.container` — content sits flush inside the main column with `px-4 sm:px-6 lg:px-8`.
- **Print view** uses `@media print` with 0.5in margins and hides nav/chrome.

```css
/* globals.css — print for invoice PDFs */
@media print {
  @page { margin: 0.5in; }
  .no-print { display: none !important; }
  body { background: white !important; color: #111 !important; }
  * { box-shadow: none !important; text-shadow: none !important; }
  a { color: inherit !important; text-decoration: none !important; }
}
```

---

## 5. Responsive Testing Matrix

QA and Playwright E2E cover these viewport sizes in both Chromium and WebKit:

| Name            | Width | Height | Device Target                |
|-----------------|-------|--------|------------------------------|
| iPhone SE       | 375   | 667    | Small phone (portrait)       |
| iPhone 14 Pro   | 393   | 852    | Modern phone (portrait)      |
| iPhone 14 Pro Max | 430 | 932    | Large phone (portrait)       |
| iPad Mini       | 768   | 1024   | Tablet (portrait)            |
| iPad Pro 12.9"  | 1024  | 1366   | Large tablet (landscape)     |
| Laptop 13"      | 1280  | 800    | Standard laptop              |
| Desktop 27"     | 1920  | 1080   | Full HD desktop              |
| 4K Desktop      | 2560  | 1440   | Large monitor                |

### Playwright Config Snippet

```ts
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  projects: [
    { name: "mobile-chrome",  use: { ...devices["Pixel 7"] } },
    { name: "mobile-safari",  use: { ...devices["iPhone 14"] } },
    { name: "tablet",         use: { viewport: { width: 768, height: 1024 } } },
    { name: "laptop-chrome",  use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "laptop-webkit",  use: { ...devices["Desktop Safari"], viewport: { width: 1280, height: 800 } } },
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"] } },
  ],
});
```

---

## 6. Safe Areas & Notch Support

For PWA / home-screen installs, extend background into safe areas:

```css
/* globals.css */
:root {
  --sat: env(safe-area-inset-top);
  --sab: env(safe-area-inset-bottom);
  --sal: env(safe-area-inset-left);
  --sar: env(safe-area-inset-right);
}

header {
  padding-top: max(0.75rem, var(--sat));
  padding-left: var(--sal);
  padding-right: var(--sar);
}

.fixed-bottom-cta {
  padding-bottom: max(1rem, var(--sab));
}
```
