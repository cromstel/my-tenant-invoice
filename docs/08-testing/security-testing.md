# Security Testing

> Static scanning · dependency audit · dynamic (DAST) · secrets detection · auth & RBAC validation.

---

## 1. Scanning Stack

| Tool                  | Scope                     | Trigger             | Owner           |
|-----------------------|---------------------------|---------------------|-----------------|
| Biome security rules  | In-app `dangerouslySetInnerHTML` | Every PR | CI |
| `pnpm audit`          | Node dependency CVE DB    | Every PR + nightly  | Dependabot |
| `trivy fs`            | Docker image + repo scan  | Release PR          | DevOps |
| `gitleaks`            | Secrets in code / commits | Pre-commit + PR     | Pre-commit hook |
| OWASP ZAP (DAST)      | Running app routes        | Nightly against staging | Security |
| `@authress/sdkm`      | BOLA / tenant-leak probe  | After every deploy  | CI |
| Burp Suite Enterprise | Manual pentest            | Quarterly           | External firm  |

---

## 2. Pre-commit: Secret Scanning

```bash
# .gitleaks.toml
title = "gitleaks config"

[allowlist]
  description = "Allow test fixtures"
  paths = ['''tests/''', '''^drizzle/''']

[[rules]]
  id = "stripe-sk"
  description = "Stripe secret key"
  regex = '''sk_live_[0-9a-zA-Z]{24,}'''
  tags = ["stripe", "key"]

[[rules]]
  id = "stripe-pk-live"
  regex = '''pk_live_[0-9a-zA-Z]{24,}'''
  tags = ["stripe"]

[[rules]]
  id = "aws-ak"
  regex = '''AKIA[0-9A-Z]{16}'''
  tags = ["aws"]

[[rules]]
  id = "generic-api-key"
  regex = '''(?i)(api[_-]?key|secret|token)["'=: ]+["']?[A-Za-z0-9_\-]{20,}["']?'''
  tags = ["key"]
```

```bash
# .husky/pre-commit
docker run --rm -v "$(pwd):/path" -w /path zricethezav/gitleaks:latest protect --staged -v
```

---

## 3. Dependency & License Audit

```jsonc
// package.json
{
  "scripts": {
    "deps:audit": "pnpm audit --prod --audit-level high",
    "deps:outdated": "pnpm outdated --long",
    "licenses:check": "license-checker-rseidelsohn --production --onlyAllow 'MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC;Python-2.0;0BSD' --summary"
  }
}
```

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule: { interval: weekly, day: monday, time: "07:00", timezone: "Africa/Johannesburg" }
    open-pull-requests-limit: 10
    groups:
      react-stack: { patterns: ["react*", "@types/react*", "next*"] }
      utilities:   { patterns: ["zod", "*zod*", "drizzle-orm", "drizzle-kit"] }
```

---

## 4. Auth & RBAC — Parametrized Spec

Every mutation endpoint is probed against the full role matrix.

```ts
// tests/unit/auth/rbac.spec.ts
import { describe, it, expect } from "vitest";
import { can, Role, action, resource } from "@/lib/auth/rbac";

type Case = { role: Role; action: action; resource: resource; ok: boolean };

const matrix: Case[] = [
  // Invoices
  { role: "OWNER",   action: "create", resource: "invoice", ok: true },
  { role: "ADMIN",   action: "create", resource: "invoice", ok: true },
  { role: "BILLING", action: "create", resource: "invoice", ok: true },
  { role: "MEMBER",  action: "create", resource: "invoice", ok: false },
  { role: "OWNER",   action: "delete", resource: "invoice", ok: true },
  { role: "ADMIN",   action: "delete", resource: "invoice", ok: true },
  { role: "BILLING", action: "delete", resource: "invoice", ok: false },
  { role: "MEMBER",  action: "delete", resource: "invoice", ok: false },
  // Tenants (orgs) — OWNER only
  { role: "OWNER",   action: "create", resource: "tenant", ok: true },
  { role: "ADMIN",   action: "create", resource: "tenant", ok: false },
  { role: "OWNER",   action: "impersonate", resource: "user", ok: true },
  { role: "ADMIN",   action: "impersonate", resource: "user", ok: false },
  // Team
  { role: "OWNER",   action: "invite", resource: "user", ok: true },
  { role: "ADMIN",   action: "invite", resource: "user", ok: true },
  { role: "BILLING", action: "invite", resource: "user", ok: false },
  { role: "MEMBER",  action: "invite", resource: "user", ok: false },
  // Reports
  { role: "OWNER",   action: "export", resource: "report", ok: true },
  { role: "ADMIN",   action: "export", resource: "report", ok: true },
  { role: "BILLING", action: "export", resource: "report", ok: false },
];

describe("RBAC matrix", () => {
  it.each<Case>(matrix)(
    "role=%s action=%s on %s → allowed=%s",
    ({ role, action: act, resource: res, ok }) => {
      expect(can({ role }, act, res)).toBe(ok);
    }
  );
});
```

---

## 5. DAST (ZAP) Nightly

```yaml
# .github/workflows/dast.yml
name: DAST — OWASP ZAP
on:
  schedule: [{ cron: "30 2 * * *" }]
  workflow_dispatch:
jobs:
  zap:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm docker:up && pnpm docker:wait && pnpm db:migrate && pnpm db:seed
      - run: pnpm next build
      - name: Serve staging build
        run: |
          AUTH_SECRET=zap_test_secret_aaaaaaaaaaaa \
          NEXT_PUBLIC_APP_URL=http://127.0.0.1:3001 \
          pnpm next start -p 3001 > /tmp/next.log &
          npx wait-on http://127.0.0.1:3001
      - name: ZAP Baseline Scan
        uses: zaproxy/action-baseline@v0.13.0
        with:
          target: "http://127.0.0.1:3001"
          rules_file_name: ".zap/rules.tsv"
          fail_action: true
          allow_issue_writing: false
          cmd_options: "-a -j -m 5 -T 15"
```

---

## 6. SQL Injection — Property-Based

```ts
// tests/unit/db/sql-injection.spec.ts
import { describe, it, expect } from "vitest";
import { fc, testProp } from "@fast-check/vitest";
import { sanitizeUserSearchInput } from "@/lib/db/sanitize";

const payloads = [
  "' OR '1'='1",
  "'; DROP TABLE invoices; --",
  "admin'--",
  "' OR 1=1--",
  "UNION SELECT * FROM users--",
  "x' AND (SELECT 9999 FROM (SELECT SLEEP(5))a) AND '1'='1",
];

describe("search input sanitization", () => {
  it.each(payloads)("neutralizes payload %s", (p) => {
    const s = sanitizeUserSearchInput(p);
    expect(s).not.toMatch(/('|;|--|\/\*|\*\/|xp_|0x)/);
  });

  testProp(
    "never contains raw quote characters for arbitrary unicode strings",
    [fc.fullUnicodeString()],
    (raw) => {
      const out = sanitizeUserSearchInput(raw);
      return !out.includes("'") && !out.includes("\\") && !out.includes(";");
    }
  );
});
```

---

## 7. Stripe Signature Validation

```ts
// tests/unit/payments/signature.spec.ts
import { describe, it, expect } from "vitest";
import { verifyStripeSignature } from "@/lib/payments/stripe/signature";

describe("Stripe webhook signature", () => {
  const secret = "whsec_<stripe-webhook-secret>";

  it("accepts freshly signed payload", () => {
    const ts = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({ id: "evt_123", type: "ping" });
    const hmac = (s: string) =>
      require("crypto").createHmac("sha256", secret).update(s).digest("hex");
    const sig = `t=${ts},v1=${hmac(`${ts}.${body}`)}`;
    expect(() => verifyStripeSignature(body, sig, secret)).not.toThrow();
  });

  it("rejects expired signature (tolerance exceeded)", () => {
    const ts = Math.floor(Date.now() / 1000) - 600;
    const body = "{}";
    const hmac = require("crypto").createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
    const sig = `t=${ts},v1=${hmac}`;
    expect(() => verifyStripeSignature(body, sig, secret, 300)).toThrow(/tolerance/);
  });

  it("rejects tampered body", () => {
    const ts = Math.floor(Date.now() / 1000);
    const bodyA = '{"a":1}';
    const bodyB = '{"a":999999}';
    const hmac = require("crypto").createHmac("sha256", secret).update(`${ts}.${bodyA}`).digest("hex");
    expect(() => verifyStripeSignature(bodyB, `t=${ts},v1=${hmac}`, secret)).toThrow(/signature/);
  });
});
```
