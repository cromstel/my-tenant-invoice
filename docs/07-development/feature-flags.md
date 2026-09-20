# Feature Flags

> Hybrid flags: in-code defaults for dev, LaunchDarkly for production rollouts. All flags have explicit lifecycle + removal ticket.

---

## 1. Flag Registry

Single source of truth in `lib/feature-flags/registry.ts`:

```ts
// lib/feature-flags/registry.ts
export interface FeatureFlag {
  key: string;
  description: string;
  defaultOn: boolean;
  envVar: string;
  /** Which users see it. Targets are additive. */
  targets?: {
    emailDomains?: string[];   // @cromstel.co.za → internal dogfood
    organizationIds?: string[];
    percentageOfOrg?: number;  // 0..100 consistent by orgId hash
  };
  /** Kill-switch deadline. After this date, flag MUST be removed or extended. */
  expiresAt: string; // ISO date YYYY-MM-DD
  owner: string;     // engineering owner email
  jira: string;      // ticket for removal
}

export const FLAGS = {
  NEW_DASHBOARD: {
    key: "new_dashboard",
    description: "Next-gen dashboard with KPI + forecasting",
    defaultOn: true,
    envVar: "FF_NEW_DASHBOARD",
    targets: { percentageOfOrg: 100 },
    expiresAt: "2026-12-01",
    owner: "john@cromstel.co.za",
    jira: "TBI-321",
  },
  BULK_INVOICE_SEND: {
    key: "bulk_invoice_send",
    description: "Mass-send selected invoices from list view",
    defaultOn: true,
    envVar: "FF_BULK_INVOICE_SEND",
    expiresAt: "2026-10-15",
    owner: "zara@cromstel.co.za",
    jira: "TBI-289",
  },
  CUSTOM_PORTAL_THEMING: {
    key: "custom_portal_theming",
    description: "Allow customers to set custom portal CSS, logo, colors",
    defaultOn: false,
    envVar: "FF_CUSTOM_PORTAL_THEMING",
    targets: { emailDomains: ["cromstel.co.za"], percentageOfOrg: 5 },
    expiresAt: "2027-02-28",
    owner: "priya@cromstel.co.za",
    jira: "TBI-401",
  },
  SAML_SSO: {
    key: "saml_sso",
    description: "Enterprise SSO via SAML2.0",
    defaultOn: false,
    envVar: "FF_SAML_SSO",
    targets: { organizationIds: ["org_enterprise_001"] },
    expiresAt: "2026-11-30",
    owner: "zane@cromstel.co.za",
    jira: "TBI-155",
  },
} as const satisfies Record<string, FeatureFlag>;

export type FlagKey = keyof typeof FLAGS;
```

### 1.1 Lifecycle Checks in CI

```ts
// scripts/expired-flags.test.ts
import { describe, it, expect } from "vitest";
import { FLAGS } from "@/lib/feature-flags/registry";

describe("feature flag lifecycle", () => {
  const today = new Date();
  for (const [name, f] of Object.entries(FLAGS)) {
    it(`${name} must not be expired`, () => {
      const expires = new Date(f.expiresAt);
      const diffDays = Math.ceil((expires.getTime() - today.getTime()) / 86_400_000);
      expect(diffDays, `Flag ${name} (${f.jira}) expired ${f.expiresAt}`).toBeGreaterThan(0);
    });
  }
});
```

---

## 2. Evaluation (Server + Client)

### 2.1 Server Side

```ts
// lib/feature-flags/evaluator.ts
import { FLAGS, type FlagKey } from "./registry";
import { createHash } from "crypto";

interface EvaluatorContext {
  organizationId?: string;
  email?: string;
}

function stablePercent(orgId: string): number {
  return (createHash("sha256").update(orgId).digest()[0] ?? 0) % 100;
}

export function isFlagEnabled(key: FlagKey, ctx: EvaluatorContext = {}): boolean {
  const flag = FLAGS[key];
  const env = process.env[flag.envVar];
  if (env !== undefined) return env === "1" || env.toLowerCase() === "true";

  // LaunchDarkly remote override in prod only
  if (process.env.NODE_ENV === "production" && process.env.LAUNCHDARKLY_SDK_KEY) {
    // (production call path, see §4)
  }

  // Target rules
  if (flag.targets) {
    const t = flag.targets;
    if (t.emailDomains && ctx.email) {
      const domain = ctx.email.split("@")[1];
      if (domain && t.emailDomains.includes(domain)) return true;
    }
    if (t.organizationIds?.includes(ctx.organizationId ?? "")) return true;
    if (t.percentageOfOrg && ctx.organizationId) {
      if (stablePercent(ctx.organizationId) < t.percentageOfOrg) return true;
    }
  }
  return flag.defaultOn;
}
```

### 2.2 Route Usage

```tsx
// app/(platform)/dashboard/page.tsx
import { isFlagEnabled } from "@/lib/feature-flags";
import { requireSession } from "@/lib/auth/session";
import { LegacyDashboard } from "./_components/legacy-dashboard";
import { NewDashboard } from "./_components/new-dashboard";

export default async function DashboardPage() {
  const session = await requireSession();
  const useNew = isFlagEnabled("NEW_DASHBOARD", {
    organizationId: session.organizationId,
    email: session.email,
  });
  return useNew ? <NewDashboard /> : <LegacyDashboard />;
}
```

### 2.3 Client Side (Safe Partial Exposure)

Expose an evaluation snapshot during SSR via `<script>` tag, never flag names:

```tsx
// app/(platform)/layout.tsx — injects window.__FLAGS__
import { isFlagEnabled } from "@/lib/feature-flags";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const flags = {
    bulkSend: isFlagEnabled("BULK_INVOICE_SEND", session),
    portalTheming: isFlagEnabled("CUSTOM_PORTAL_THEMING", session),
  } satisfies Record<string, boolean>;

  return (
    <>
      <script
        dangerouslySetInnerHTML={{ __html: `window.__FLAGS__ = ${JSON.stringify(flags)}` }}
      />
      <Shell>{children}</Shell>
    </>
  );
}
```

```ts
// hooks/use-flags.ts
"use client";

type Flags = { bulkSend: boolean; portalTheming: boolean };

export function useFlags(): Flags {
  if (typeof window === "undefined") return { bulkSend: false, portalTheming: false };
  return (window as any).__FLAGS__ ?? { bulkSend: false, portalTheming: false };
}
```

---

## 3. In Tests

Always pin flag state explicitly per test — no `process.env` leakage between tests.

```ts
// vitest.config.ts → setupFiles: ["tests/setup-feature-flags.ts"]
// tests/setup-feature-flags.ts
import { beforeEach, vi } from "vitest";
import * as flags from "@/lib/feature-flags/evaluator";

beforeEach(() => {
  vi.restoreAllMocks();
  // Default: every flag OFF unless test overrides
  vi.spyOn(flags, "isFlagEnabled").mockImplementation((k) => {
    switch (k) {
      case "BULK_INVOICE_SEND": return true;
      default: return false;
    }
  });
});
```

```ts
// tests/unit/invoice-list.spec.ts
it("shows bulk actions when flag on", () => {
  vi.spyOn(require("@/lib/feature-flags/evaluator"), "isFlagEnabled")
    .mockImplementation((k) => k === "BULK_INVOICE_SEND");
  // render + assert Bulk button visible
});
```

---

## 4. LaunchDarkly Production Integration

```ts
// lib/feature-flags/launchdarkly.ts
import { init, LDClient } from "@launchdarkly/node-server-sdk";

let client: LDClient | null = null;
const sdkKey = process.env.LAUNCHDARKLY_SDK_KEY;

if (sdkKey) {
  client = init(sdkKey);
  client.on("failed", (err) => {
    require("@/lib/logging").logger.warn({ err }, "LD SDK failed to init, falling back to local");
    client = null;
  });
}

export async function remoteVariation(
  key: string,
  ctx: { organizationId?: string; userId?: string; email?: string },
  fallback: boolean
): Promise<boolean> {
  if (!client) return fallback;
  await client.waitForInitialization({ timeout: 500 });
  return client.variation(key, {
    key: ctx.userId ?? ctx.organizationId ?? "anon",
    custom: {
      organizationId: ctx.organizationId ?? null,
      email: ctx.email ?? null,
    },
  }, fallback);
}
```

---

## 5. Removal Process

1. When a flag is `defaultOn=true` for 2 releases without incidents → open removal PR.
2. PR removes flag entry from registry, evaluator, and ALL conditional branches for `false`.
3. Code review confirms: no dead `else` branch leftover.
4. Close the associated Jira ticket referenced in `flags.ts`.
