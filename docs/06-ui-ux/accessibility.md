# Accessibility — WCAG 2.2 AA Targets

> All user-facing surfaces must conform to WCAG 2.2 Level AA. Exceptions are documented per-issue and approved by the accessibility champion.

---

## 1. Conformance Baseline

| Success Criterion                         | Level | How we meet it                                                  |
|-------------------------------------------|-------|-----------------------------------------------------------------|
| 1.1.1 Non-text Content                    | A     | All `<img>` must have `alt`, decorative use empty `alt=""`. Icons in buttons rely on visible labels. |
| 1.3.1 Info and Relationships              | A     | Use native semantics: `<table>`, `<fieldset>`, `<h1-6>`. CSS-only layouts must expose ARIA roles. |
| 1.3.2 Meaningful Sequence                 | A     | DOM order matches visual reading order (no CSS-only reordering). |
| 1.3.5 Identify Input Purpose              | AA    | Form inputs use correct `autocomplete` tokens (name, email, tel, postal-code, cc-number, etc.). |
| 1.4.3 Contrast (Minimum)                  | AA    | Text ≥ 4.5:1, large text ≥ 3:1. Enforced in `tailwind.config` token palette. |
| 1.4.4 Resize Text                         | AA    | No breakage at 200% zoom (no fixed `px` heights on text boxes). |
| 1.4.5 Images of Text                      | AA    | No images of text; use `<span>` + webfonts.                     |
| 1.4.11 Non-text Contrast                  | AA    | Controls, focus rings, borders ≥ 3:1 against background.        |
| 1.4.12 Text Spacing                        | AA    | `line-height: 1.5` body, letter-spacing ± words (0.16/0.5em) — test bookmarklet. |
| 1.4.13 Content on Hover or Focus          | AA    | Tooltips: hover persistent, dismissible, hoverable.             |
| 2.1.1 Keyboard                            | A     | All functionality reachable via keyboard. No hover-only actions. |
| 2.1.2 No Keyboard Trap                    | A     | Modals/drawers restore focus, ESC closes.                       |
| 2.4.1 Bypass Blocks                       | A     | Global skip link to `#main`.                                    |
| 2.4.3 Focus Order                         | A     | Tab order follows DOM. No `tabindex > 0`.                       |
| 2.4.6 Headings and Labels                 | AA    | Every form field has a real `<label>`; no placeholder-as-label.  |
| 2.4.7 Focus Visible                       | AA    | `:focus-visible` uses solid 2px ring (Tailwind `ring-2 ring-ring`). |
| 3.1.1 Language of Page                    | A     | `<html lang="en">` + per-region sub-tag for content.             |
| 3.2.1 On Focus                            | A     | Focus does not trigger unexpected navigation / form submit.     |
| 3.2.2 On Input                            | A     | Changing form inputs does not auto-submit unless announced.     |
| 3.3.1 Error Identification                | A     | Inline error with `aria-invalid` + `aria-describedby`.           |
| 3.3.2 Labels or Instructions              | A     | Required fields marked via `aria-required` + visual `*`.         |
| 3.3.3 Error Suggestion                    | AA    | Zod schema provides a corrective message for every invalid field. |
| 3.3.4 Error Prevention (Legal, Financial) | AA    | Destructive actions: confirmation dialog, undo-window toast, cancel/save explicit buttons. |
| 3.3.8 Accessible Authentication           | AA    | Password fields have show/hide. No copy-blocking. SSO + OTP + magic-link alternatives. |
| 4.1.1 Parsing                             | A     | Valid HTML — no duplicate IDs; test with html-validate.         |
| 4.1.2 Name, Role, Value                   | A     | All shadcn components ship with proper ARIA. No `<div onClick>` as button. |
| 4.1.3 Status Messages                     | AA    | Toasts, spinners, loading bars render into `aria-live="polite"` region. |
| 2.4.8 Location (breadcrumb)               | AAA   | Provided in Platform shell as a reach goal.                     |

---

## 2. Page Shell

### 2.1 Skip Link

```tsx
// app/layout.tsx — first element inside <body>
<a
  href="#main"
  className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
>
  Skip to content
</a>
<main id="main">...</main>
```

### 2.2 Focus Ring Tokens

```css
/* globals.css */
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px hsl(var(--background)), 0 0 0 4px hsl(var(--ring));
  border-radius: var(--radius);
}
```

---

## 3. Forms

### 3.1 Required Field Convention

Use shadcn `FormField` + `FormLabel` with a mandatory `*` for required fields:

```tsx
<FormField name="customerEmail" render={({ field, fieldState }) => (
  <FormItem>
    <FormLabel className="after:ml-0.5 after:text-destructive after:content-['*']">
      Customer Email
    </FormLabel>
    <FormControl>
      <Input
        type="email"
        autoComplete="email"
        aria-invalid={!!fieldState.error}
        aria-describedby={fieldState.error ? "customerEmail-error" : undefined}
        placeholder="customer@example.com"
        {...field}
      />
    </FormControl>
    <FormMessage id="customerEmail-error" />
  </FormItem>
)} />
```

### 3.2 Input Autocomplete Tokens

| Field           | `autoComplete`          |
|-----------------|-------------------------|
| Full name       | `"name"`                |
| First name      | `"given-name"`          |
| Last name       | `"family-name"`         |
| Email           | `"email"`               |
| Telephone       | `"tel"`                 |
| Street line 1   | `"address-line1"`       |
| City            | `"address-level2"`      |
| Region          | `"address-level1"`      |
| Postal code     | `"postal-code"`         |
| Country         | `"country"`             |
| Org name        | `"organization"`        |
| Cardholder      | `"cc-name"`             |
| Card number     | `"cc-number"`           |
| Card expiry     | `"cc-exp"`              |
| Card CVC        | `"cc-csc"`              |

---

## 4. Icons, Buttons & ARIA

### 4.1 Icon-Only Buttons

Always provide a visually accessible name:

```tsx
<Button variant="ghost" size="icon" aria-label="Download PDF invoice">
  <Download className="h-4 w-4" aria-hidden />
</Button>
```

### 4.2 Status Badges (invoice state)

```tsx
<Badge
  role="status"
  aria-live="polite"
  className="uppercase text-[10px] tracking-wide"
>
  <span className="sr-only">Invoice status: </span>PAID
</Badge>
```

### 4.3 Loading / Toast Announcements

```tsx
// components/loading-announcer.tsx
"use client";

export function LoadingAnnouncer({ message }: { message: string | null }) {
  return (
    <div role="status" aria-live="polite" aria-atomic className="sr-only">
      {message}
    </div>
  );
}
```

---

## 5. Color & Contrast

### 5.1 Automated Contrast Checks

Run in CI against the design token palette:

```ts
// scripts/check-contrast.test.ts
import { describe, it, expect } from "vitest";
import { getContrast } from "color-contrast";

const pairs: Array<[string, string, number]> = [
  ["#FFFFFF", "#4F46E5", 4.5],  // white on primary body
  ["#FFFFFF", "#111827", 7.0],  // white on foreground text
  ["#FFFFFF", "#DC2626", 4.6],  // destructive button label
  ["#4F46E5", "#FFFFFF", 5.8],  // primary button text
];

describe("WCAG contrast", () => {
  it.each(pairs)("%s on %s ≥ %s:1", (fg, bg, ratio) => {
    expect(getContrast(fg, bg)).toBeGreaterThanOrEqual(ratio);
  });
});
```

### 5.2 No Color-Only Status Cues

All status tiles also show an icon + label:

- Paid → green + check icon
- Overdue → red + exclamation
- Draft → gray + pencil

---

## 6. Motion & Vestibular

Respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
```

Never use auto-playing `<video>` on marketing pages. If a video hero is ever added, it must be `muted` + `playsinline` + `autoplay only if !prefers-reduced-motion`.

---

## 7. Modal / Dialog Behavior

Every dialog follows:

1. **Trap focus** inside using `@radix-ui/react-dialog` (shadcn).
2. **Restore focus** to the trigger on close.
3. **Close on ESC**.
4. **Close on backdrop click** if not destructive.
5. **`aria-describedby`** points to the body text for screen readers.

```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent aria-describedby="confirm-delete-body">
    <DialogHeader>
      <DialogTitle>Permanently delete this invoice?</DialogTitle>
      <DialogDescription id="confirm-delete-body">
        This action cannot be undone. All payment history and portal links will be deactivated.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter className="gap-2 sm:justify-end">
      <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      <Button variant="destructive" onClick={onConfirm}>Delete invoice</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## 8. Testing Stack

| Tool / Practice                  | Scope                                     |
|----------------------------------|-------------------------------------------|
| `axe-core` + Playwright          | Every route in E2E: `expect(await axe()).toHaveNoViolations()` |
| Vitest + `@react-aria/axe`       | Component unit tests with user interaction |
| `pa11y-ci`                       | Production build smoke of all marketing + auth routes |
| Manual keyboard audit            | Weekly sprint check (full platform shell)  |
| NVDA / VoiceOver smoke           | Pre-release: key flows with screen reader |

### Example Axe + Playwright

```ts
// tests/e2e/a11y.spec.ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("accessibility /dashboard", () => {
  test("should not have any automatically detectable accessibility issues", async ({ page }) => {
    await page.goto("/dashboard");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
```
