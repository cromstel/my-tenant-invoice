# Design System

> CromStel IT Group — myTenant Invoice SaaS
> Stack: Next.js 14 (App Router) + Tailwind CSS 3 + shadcn/ui

## 1. Design Tokens

All tokens are consumed via `tailwind.config.ts` and CSS variables. Never hardcode hex/RGB values in components.

### 1.1 Color Palette

```ts
// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",       // #4F46E5 (Indigo-600)
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",     // #F1F5F9
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",   // #DC2626
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",        // #EEF2FF
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT: "hsl(142 76% 36%)",          // #16A34A
          foreground: "hsl(0 0% 98%)",
        },
        warning: {
          DEFAULT: "hsl(38 92% 50%)",           // #F59E0B
          foreground: "hsl(0 0% 98%)",
        },
        info: {
          DEFAULT: "hsl(201 96% 32%)",          // #0369A1
          foreground: "hsl(0 0% 98%)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
};
export default config;
```

### 1.2 CSS Variables (Light + Dark)

```css
/* app/globals.css */
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 244 75% 59%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 244 75% 59%;
    --radius: 0.75rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 244 75% 66%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 244 75% 66%;
  }
}
```

### 1.3 Typography Scale

```ts
// tailwind.config.ts — extend fontFamily
fontFamily: {
  sans: ["var(--font-inter)", "system-ui", "sans-serif"],
  mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
},
```

| Class       | Font Size (px) | Line Height | Letter Spacing | Weight | Usage                  |
|-------------|----------------|-------------|----------------|--------|------------------------|
| text-xs     | 12             | 16 (1.333)  | 0.025em        | 400    | Helper text, badges    |
| text-sm     | 14             | 20 (1.428)  | 0              | 400    | Body copy, table cells |
| text-base   | 16             | 24 (1.5)    | 0              | 400    | Default body           |
| text-lg     | 18             | 28 (1.555)  | 0              | 500    | Section lead-ins       |
| text-xl     | 20             | 28 (1.4)    | -0.01em        | 600    | Subsection headings    |
| text-2xl    | 24             | 32 (1.333)  | -0.01em        | 600    | Page titles (portal)   |
| text-3xl    | 30             | 36 (1.2)    | -0.02em        | 700    | Section titles         |
| text-4xl    | 36             | 40 (1.111)  | -0.025em       | 700    | Marketing h2           |
| text-5xl    | 48             | 52 (1.083)  | -0.035em       | 800    | Hero heading           |
| text-6xl    | 60             | 60 (1)      | -0.04em        | 800    | Marketing h1 (desktop) |

### 1.4 Spacing Scale

Uses Tailwind's default `4px` base. Use semantic names where possible:

```
space-1 = 4px   | space-2 = 8px   | space-3 = 12px  | space-4 = 16px
space-5 = 20px  | space-6 = 24px  | space-8 = 32px  | space-10 = 40px
space-12 = 48px | space-16 = 64px | space-20 = 80px | space-24 = 96px
```

### 1.5 Shadows

```ts
boxShadow: {
  sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  DEFAULT: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
  md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
  ring: "0 0 0 4px hsl(var(--primary) / 0.15)",
},
```

---

## 2. Component Library (shadcn/ui + Extensions)

### 2.1 Core shadcn/ui Primitives Used

| Component        | Path                           | Usage                                   |
|------------------|--------------------------------|-----------------------------------------|
| Button           | `components/ui/button.tsx`     | Primary/secondary/destructive actions   |
| Card             | `components/ui/card.tsx`       | Dashboard tiles, info panels            |
| Input            | `components/ui/input.tsx`      | Text fields                             |
| Select           | `components/ui/select.tsx`     | Dropdowns (tenant switcher, filters)    |
| Table            | `components/ui/table.tsx`      | Invoice line items, tenant lists        |
| Dialog           | `components/ui/dialog.tsx`     | Confirm deletions, modals               |
| Toast / Sonner   | `components/ui/sonner.tsx`     | Async feedback                          |
| Badge            | `components/ui/badge.tsx`      | Status indicators (PAID, DRAFT, etc.)   |
| DataTable        | `components/data-table.tsx`    | TanStack-based paginated tables         |

### 2.2 Custom Domain Components

```tsx
// components/invoice/invoice-status-badge.tsx
import { Badge } from "@/components/ui/badge";
import type { InvoiceStatus } from "@/lib/db/schema";

const badgeMap: Record<InvoiceStatus, { variant: "default" | "secondary" | "destructive" | "success" | "warning" | "outline"; label: string }> = {
  DRAFT: { variant: "secondary", label: "Draft" },
  SENT: { variant: "outline", label: "Sent" },
  VIEWED: { variant: "default", label: "Viewed" },
  PAID: { variant: "success", label: "Paid" },
  OVERDUE: { variant: "destructive", label: "Overdue" },
  CANCELLED: { variant: "outline", label: "Cancelled" },
  REFUNDED: { variant: "warning", label: "Refunded" },
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const { variant, label } = badgeMap[status];
  return (
    <Badge variant={variant as never} className="uppercase text-[10px] tracking-wide">
      {label}
    </Badge>
  );
}
```

---

## 3. Button Hierarchy

```tsx
// Primary action (1 per screen max)
<Button>Create Invoice</Button>

// Secondary / utility
<Button variant="secondary">Export CSV</Button>

// Destructive
<Button variant="destructive">Delete Tenant</Button>

// Ghost / link
<Button variant="ghost">Cancel</Button>
<Button variant="link">Forgot password?</Button>

// Loading state
<Button disabled>
  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  Processing...
</Button>
```

---

## 4. Form Patterns

Every form in the platform uses `react-hook-form` + `zod` resolver + shadcn Form wrapper.

```tsx
// app/(platform)/invoices/new/_components/create-invoice-form.tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";

const createInvoiceSchema = z.object({
  customerName: z.string().min(2, "Name is required").max(100),
  customerEmail: z.string().email("Invalid email"),
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  lineItems: z.array(z.object({
    description: z.string().min(1),
    quantity: z.coerce.number().int().positive(),
    unitPrice: z.coerce.number().positive(),
  })).min(1, "At least one line item is required"),
});

type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export function CreateInvoiceForm({ onSubmit }: { onSubmit: (values: CreateInvoiceInput) => Promise<void> }) {
  const form = useForm<CreateInvoiceInput>({
    resolver: zodResolver(createInvoiceSchema),
    defaultValues: {
      lineItems: [{ description: "", quantity: 1, unitPrice: 0 }],
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="customerName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Customer Name</FormLabel>
              <FormControl><Input placeholder="Acme Corp" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving..." : "Create Invoice"}
        </Button>
      </form>
    </Form>
  );
}
```

---

## 5. Empty & Skeleton States

```tsx
// components/empty-state.tsx
import { FileX } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <FileX className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mt-6 text-lg font-semibold">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && (
        <Button className="mt-6" onClick={action.onClick}>{action.label}</Button>
      )}
    </div>
  );
}
```

Skeleton example for data tables:

```tsx
<div className="space-y-3">
  {Array.from({ length: 8 }).map((_, i) => (
    <div key={i} className="flex items-center gap-4 rounded-md border p-4">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="space-y-2 flex-1">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/5" />
      </div>
      <Skeleton className="h-8 w-20" />
    </div>
  ))}
</div>
```
