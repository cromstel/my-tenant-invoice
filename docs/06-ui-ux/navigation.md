# Navigation Architecture

> myTenant Invoice — Next.js App Router route groups + sidebar shells

## 1. Route Groups Overview

```
app/
├── (marketing)/            layout.tsx → Marketing nav + footer
│   ├── page.tsx            /
│   ├── pricing/            /pricing
│   ├── features/           /features
│   └── about/              /about
│
├── (auth)/                 layout.tsx → Centered card, no sidebar
│   ├── login/              /login
│   ├── register/           /register
│   ├── forgot-password/    /forgot-password
│   └── reset-password/     /reset-password
│
├── (platform)/             layout.tsx → Platform shell w/ sidebar + org switcher
│   ├── dashboard/          /dashboard
│   ├── invoices/           /invoices (list)
│   │   ├── new/            /invoices/new
│   │   └── [id]/           /invoices/:id (detail + edit)
│   ├── customers/          /customers
│   ├── tariffs/            /tariffs
│   ├── payments/           /payments
│   ├── reports/            /reports
│   ├── tenants/            /tenants (org admin only)
│   ├── users/              /users (org admin only)
│   └── settings/           /settings
│       ├── organization/   /settings/organization
│       ├── billing/        /settings/billing
│       └── team/           /settings/team
│
└── (portal)/[slug]/        layout.tsx → Branded portal shell per customer
    └── invoices/
        └── [id]/           /p/:slug/invoices/:id
```

---

## 2. Marketing Nav

Single sticky top nav with logo + links + CTA button.

```tsx
// app/(marketing)/_components/marketing-nav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";

const links = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/docs", label: "Docs" },
];

export function MarketingNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <span className="text-primary">myTenant</span>
          <span className="text-foreground">Invoice</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`text-sm font-medium transition-colors ${
                pathname === l.href ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button variant="ghost" asChild><Link href="/login">Sign in</Link></Button>
          <Button asChild><Link href="/register">Start free trial</Link></Button>
        </div>

        <Sheet>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon" aria-label="Open menu"><Menu /></Button>
          </SheetTrigger>
          <SheetContent side="right">
            <nav className="flex flex-col gap-4 pt-10">
              {links.map((l) => (
                <Link key={l.href} href={l.href} className="text-base font-medium">
                  {l.label}
                </Link>
              ))}
              <div className="mt-6 flex flex-col gap-2">
                <Button variant="outline" asChild><Link href="/login">Sign in</Link></Button>
                <Button asChild><Link href="/register">Start free trial</Link></Button>
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
```

---

## 3. Platform Shell (Sidebar + Topbar)

### 3.1 Layout Structure

```tsx
// app/(platform)/layout.tsx
import { PlatformSidebar } from "./_components/platform-sidebar";
import { PlatformTopbar } from "./_components/platform-topbar";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-muted/30">
      <PlatformSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <PlatformTopbar />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
```

### 3.2 Sidebar Items (Role-Aware)

```tsx
// app/(platform)/_components/platform-sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, FileText, Users, Receipt, CreditCard,
  BarChart3, Building2, Settings, Shield,
} from "lucide-react";
import { useCurrentRole } from "@/hooks/use-current-role";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: Array<"OWNER" | "ADMIN" | "BILLING" | "MEMBER">;
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/tariffs", label: "Tariffs", icon: Receipt, roles: ["OWNER", "ADMIN", "BILLING"] },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/reports", label: "Reports", icon: BarChart3, roles: ["OWNER", "ADMIN"] },
  { href: "/tenants", label: "Tenants", icon: Building2, roles: ["OWNER"] },
  { href: "/users", label: "Team", icon: Shield, roles: ["OWNER", "ADMIN"] },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function PlatformSidebar() {
  const pathname = usePathname();
  const role = useCurrentRole();

  const visible = navItems.filter((i) => !i.roles || (role && i.roles.includes(role)));

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-card lg:flex">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <span className="text-lg font-bold text-primary">myTenant</span>
        <span className="text-sm font-medium text-muted-foreground">Invoice</span>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {visible.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

### 3.3 Topbar (Org Switcher + User Menu)

```tsx
// app/(platform)/_components/platform-topbar.tsx
"use client";

import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  ChevronsUpDown, Plus, ChevronRight, Bell, Search,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useRouter } from "next/navigation";

export function PlatformTopbar() {
  const user = useCurrentUser();
  const router = useRouter();
  return (
    <header className="sticky top-0 z-30 h-16 border-b bg-card/80 backdrop-blur">
      <div className="flex h-full items-center gap-4 px-4 sm:px-6">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="w-[220px] justify-start gap-2 text-left">
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate text-sm font-medium">{user?.organizationName ?? "Loading..."}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[220px]">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Organizations
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => router.push("/tenants/new")}>
              <Plus className="mr-2 h-4 w-4" /> New organization
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              Acme Property Group <ChevronRight className="ml-auto h-4 w-4 opacity-50" />
            </DropdownMenuItem>
            <DropdownMenuItem>
              CromStel Commercial
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="relative ml-auto flex-1 md:grow-0 md:w-[320px]">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search invoices, customers..."
            className="w-full rounded-md border bg-background pl-8 pr-3 py-2 text-sm outline-none ring-ring focus:ring-2"
          />
        </div>

        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="h-5 w-5" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {user?.name?.[0] ?? "U"}
              </div>
              <span className="hidden text-sm font-medium sm:block">{user?.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => router.push("/settings/profile")}>
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => router.push("/settings/billing")}>
              Subscription
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
```

---

## 4. Customer Portal Nav

The customer portal is a de-branded shell per customer `slug`.

```tsx
// app/(portal)/[slug]/_components/portal-nav.tsx
"use client";

import Link from "next/link";

export function PortalNav({ slug, logo, brandName }: { slug: string; logo?: string; brandName: string }) {
  return (
    <header className="sticky top-0 z-30 w-full border-b bg-background">
      <div className="container flex h-16 items-center justify-between">
        <Link href={`/p/${slug}/invoices`} className="flex items-center gap-3">
          {logo ? (
            <img src={logo} alt="" className="h-8 w-8 object-contain" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              {brandName[0]}
            </div>
          )}
          <span className="font-semibold">{brandName}</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link href={`/p/${slug}/invoices`} className="hover:text-foreground">Invoices</Link>
          <Link href={`/p/${slug}/payments`} className="hover:text-foreground">Payments</Link>
          <Link href={`/p/${slug}/contact`} className="hover:text-foreground">Contact</Link>
        </nav>
      </div>
    </header>
  );
}
```

---

## 5. Breadcrumbs

Enabled on every (platform) sub-page via a reusable component placed under the page title.

```tsx
// components/breadcrumbs.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

const labelMap: Record<string, string> = {
  dashboard: "Dashboard",
  invoices: "Invoices",
  customers: "Customers",
  tariffs: "Tariffs",
  payments: "Payments",
  reports: "Reports",
  tenants: "Tenants",
  users: "Team",
  settings: "Settings",
  new: "New",
  edit: "Edit",
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex items-center text-sm text-muted-foreground">
      <Link href="/dashboard" className="flex items-center gap-1 hover:text-foreground">
        <Home className="h-3.5 w-3.5" /> Dashboard
      </Link>
      {segments.slice(1).map((seg, i) => {
        const href = "/" + segments.slice(0, i + 2).join("/");
        const label = labelMap[seg] ?? (seg.length > 6 ? "#" + seg.slice(0, 6) : seg);
        const isLast = i === segments.length - 2;
        return (
          <span key={href} className="flex items-center">
            <ChevronRight className={cn("mx-1 h-3.5 w-3.5", isLast && "opacity-50")} />
            {isLast ? (
              <span className="font-medium text-foreground">{label}</span>
            ) : (
              <Link href={href} className="hover:text-foreground">{label}</Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
```
