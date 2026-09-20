# Security Policy — myTenant Invoice

CromStel IT Group takes the security of **myTenant Invoice** very seriously.
This document outlines our security stance, responsible disclosure policy,
and contact paths for reporting vulnerabilities.

---

## 1. Supported Versions

Only the latest stable release and the immediately preceding minor release
receive security updates. Older releases are not supported.

| Version  | Supported          |
| -------- | ------------------ |
| 0.1.x    | :white_check_mark: |
| < 0.1.0  | :x:                |

---

## 2. Reporting a Vulnerability

**DO NOT** file a public GitHub issue for a security concern. Public disclosure
can put all users at risk.

Instead, send a detailed report to:

> **security@cromstelit.com**

Include:

- A clear description of the vulnerability.
- Steps to reproduce (PoC, script, curl commands, screenshots).
- Affected version(s).
- Your estimated severity and impact.
- If you know of a fix or mitigation, please share it.

You will receive an acknowledgment within **2 business days** and a detailed
response within **5 business days**.

---

## 3. Disclosure Timeline

1. **T+0d** — Report received.
2. **T+2d** — Acknowledgment.
3. **T+5d** — Initial triage and severity classification.
4. **T+30d** — Target public disclosure with a released patch.
5. If a fix is not ready by T+30d, we will provide a status update and
   coordinate a safe disclosure window with the reporter.

---

## 4. Scope

In scope:

- All code in this repository (`/src`, `/prisma`, `/app` routes, etc.).
- Authenticated and unauthenticated endpoints.
- Tenant isolation guarantees.
- Authorization bypasses (IDOR, privilege escalation, cross-tenant leaks).
- Injection flaws (SQL, NoSQL, XSS, SSRF, CSRF).
- Session and authentication weaknesses.

Out of scope:

- Social engineering / phishing of end users.
- Denial of service against third-party services (Cloudflare, AWS, etc.).
- Attacks requiring physical access or root on a user’s device.
- Spam / content issues on public SaaS registration pages.
- Theoretical vulnerabilities with no clear exploit path.

---

## 5. Secure by Default Principles

Security controls that must never be weakened without an ADR:

- Tenant data is always filtered by `organizationId` at the data layer.
- Secrets live only in environment variables / secret managers.
- Production stacks encrypt data at rest and in transit (TLS 1.2+).
- Inputs are validated with Zod schemas on the server before touching the DB.
- All financial operations run inside database transactions.
- Idempotency keys protect external webhooks (Stripe, etc.).
- Audit logs capture every material user action and are append-only.

---

## 6. Vulnerability Scanning

The project runs:

- `npm audit` on every CI pipeline.
- ESLint + Prettier + TS strict mode on every commit.
- Tenant isolation integration tests on every PR.
- Penetration testing before major releases.

See also: [docs/05-security/vulnerability-management.md](docs/05-security/vulnerability-management.md).

---

## 7. Thanks

We sincerely thank independent security researchers who responsibly
disclose vulnerabilities. We will credit you in the release notes unless
you request anonymity.

— **CromStel IT Group** (https://cromstelit.com)
