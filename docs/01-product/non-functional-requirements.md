# myTenant Invoice — Non-Functional Requirements (NFRs)

> Document ID: MTI-NFR-004 | Version: 1.0 | Owner: CromStel IT Group — Platform Architect + CISO | Status: APPROVED | Last Updated: 2026-09-20
>
> *Non-Functional Requirements (NFRs) are **hard, contractual, testable** constraints. Any production deployment that violates a hard NFR must be rolled back or remediated within the defined SLA. Soft NFRs are advisory targets.
> Cross-references: [Product Vision](./product-vision.md) · [Business Requirements](./business-requirements.md) · [Functional Requirements](./functional-requirements.md)*

---

## 1. NFR Classification

| Class | Symbol | Enforcement | Consequence of Breach |
|---|---|---|---|
| **M** Mandatory (hard) | 🔴 | Contractual. Audited quarterly. | Production rollback + incident report + root cause within 5 business days. Enterprise SLA credits may apply. |
| **S** Strong Target (soft) | 🟡 | Engineering OKR. Tracked monthly. | Post-mortem + remediation plan within 10 business days. No SLA credit. |
| **A** Advisory (nice-to-have) | 🟢 | Best practice. Tracked per release. | Backlogged for future release. |

---

## 2. Tenant Isolation (Category: ISL)

Tenant isolation is the **primary non-functional concern** of myTenant Invoice. It is an architectural invariant, not a feature. All subsequent NFRs are subordinate to the isolation guarantees below. See [Functional Requirements §14](./functional-requirements.md#14-tenant-isolation-enforcement-points) for a layer-by-layer enforcement map.

### 2.1 Logical Isolation (Database / Storage)

| NFR ID | Class | Requirement | Verification Method | Trace |
|---|---|---|---|---|
| NFR-ISL-001 | 🔴 M | **Row-Level Security (RLS) is enforced on every tenant-scoped table.** Every table containing tenant data has: (a) a non-null `tenant_id` column; (b) a PostgreSQL policy `FOR ALL USING (tenant_id = current_setting('app.current_tenant')::UUID)`; (c) a PostgreSQL policy `FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant')::UUID)`; (d) the app DB role has `NOBYPASSRLS` and cannot disable RLS. | Quarterly manual schema audit + automated RLS-verification test suite runs in CI pipeline against a cloned schema. Any table failing RLS check blocks deploy. | Pillar 1, CG-7 |
| NFR-ISL-002 | 🔴 M | **Cross-tenant read denial: zero rows from an unauthorised tenant are ever returned to any request.** A test harness exercises all 180+ API endpoints with a legitimate JWT for tenant A and a crafted `id` parameter referencing a tenant B row. Every endpoint must return either 404 (preferred) or 403. 0 successes (leaks) allowed. | Automated penetration-test harness runs on every PR (fast path) and weekly against production-like staging (full path). 100% pass rate required. | Pillar 1, CG-7 |
| NFR-ISL-003 | 🔴 M | **No ID enumeration:** All object identifiers (invoice_id, unit_id, client_id, meter_id, etc.) are **UUID v4** (122 bits of entropy). Sequential integers are prohibited for any tenant-scoped entity. IDs do not reveal order, count, or age. | Grep + AST scan of codebase bans `SERIAL` / `auto_increment` / `INTEGER PRIMARY KEY` on any tenant table. Code review checklist item. | Pillar 1 |
| NFR-ISL-004 | 🔴 M | **Object-storage namespace isolation per tenant.** In S3/Azure Blob, tenant organisation data lives under a dedicated prefix: `{bucket}/tenants/{tenant_id}/...`. The IAM role / SAS token used by the application service has s3:GetObject/PutObject/DeleteObject scoped with a prefix condition (`s3:prefix`: `tenants/${app.current_tenant}/*`). A tenant-scoped token cannot list other prefixes. | Manual IAM policy audit quarterly; automated test attempts cross-prefix `ListObjects` and expects 403. | Pillar 1, FR-TR-007 |
| NFR-ISL-005 | 🔴 M | **Tenant key isolation.** PII columns are encrypted with a tenant-owned AES-256-GCM data key. The tenant data key is itself encrypted (envelope encryption) under a tenant-specific KMS key alias in AWS KMS / Azure Key Vault — alias name contains `tenant-<tenant_id>`. A KMS key policy restricts `kms:Decrypt` to the tenant-scoped app service principal. Even if the database is exfiltrated, raw PII cannot be read without the tenant's KMS key (and its IAM policy). | Quarterly KMS policy audit; red-team exercise: given a full DB dump + non-tenant IAM credentials, PII columns must be unreadable (AES ciphertext only). | Pillar 1, FR-TR-007 |
| NFR-ISL-006 | 🟡 S | **Blast-radius limiting:** Worker processes for async jobs (billing runs, PDF generation) are segmented per tenant — a billing run for tenant A runs in a K8s namespace or process group that cannot read memory of a tenant B run. In MVP, achieve this via the application's tenant-scoped DB connection (setting `app.current_tenant` at job start). In Scale phase, move to per-job sidecar with tenant-scoped credentials. | Staging chaos experiment: inject a memory-safety bug in the billing worker; verify it cannot cross tenant boundary. | Pillar 1 |

### 2.2 Access & Operational Isolation

| NFR ID | Class | Requirement | Verification |
|---|---|---|---|
| NFR-ISL-010 | 🔴 M | **CromStel staff (SUPER_ADMIN, PLATFORM_ADMIN, CROMSTEL_SUPPORT) cannot read or modify tenant-scoped business data (invoices, clients, payments, meter reads) without an explicit, time-bound, revocable grant from that tenant's ORG_OWNER.** Grant is single-purpose, max. 72 h, scope (read/write + module subset), audit-logged. Default: CromStel staff see 0 tenant business data (only metadata: tier, seat count, error logs with PII stripped). | Manual incident review + quarterly audit of CROMSTEL_SUPPORT grants; every grant must have a corresponding support ticket + ORG_OWNER audit record. | BR-AUD-01, Pillar 1 |
| NFR-ISL-011 | 🔴 M | **SUPER_ADMIN / PLATFORM_ADMIN analytics views** (FR-RPT-004) never contain PII or per-invoice rows. The analytics ETL strips: name, email, phone, address, tax ID, bank token, invoice line description, dispute text. Only aggregated, tenant-level metrics (counts, sum-amounts, averages) are loaded. | ETL schema audit; query analytics DB directly for PII strings; verify 0 rows returned. | FR-RPT-004 |
| NFR-ISL-012 | 🔴 M | **Cross-region isolation:** A tenant organisation assigned to `eu-west-1` never has its data written or cached outside the EU. Caches (Redis, CDN edge) outside the EU must never contain tenant-scoped payloads — only global assets (JS/CSS, marketing pages). | Regional audit: scan US and APAC caches / buckets for EU tenant_id prefix; 0 occurrences allowed. | BR-LEG-01 |
| NFR-ISL-013 | 🔴 M | **Audit log scoping.** Every row in the audit log has `tenant_id`. An Auditor role assigned to tenant A can ONLY fetch rows where `tenant_id = A`. SUPER_ADMIN querying the audit log for a specific tenant's rows must itself be logged as an event. | Penetration test: Auditor-A JWT attempts to fetch audit rows for tenant B; expect 403 or empty filtered set. | FR-AUD-001/002 |

---

## 3. Security (Category: SEC)

### 3.1 Authentication & Session Management

| NFR ID | Class | Requirement | Verification |
|---|---|---|---|
| NFR-SEC-001 | 🔴 M | **Authentication is stateless via short-lived JWT (RS256 asymmetric, 15-min access token) + long-lived opaque refresh token (stored server-side, rotating, revocable, 7-day max).** JWT payload contains: `sub`, `tenant_id`, `roles[]`, `scope`, `iat`, `exp`, `jti`. JWT is signed with a per-environment RSA-4096 key pair; public keys are served at `/.well-known/jwks.json`. Refresh tokens are single-use (rotation). | OWASP ASVS 4.0 V3 (Session Management) automated scan + manual review. |
| NFR-SEC-002 | 🔴 M | **2FA mandatory for all privileged roles** (`SUPER_ADMIN`, `PLATFORM_ADMIN`, `ORG_OWNER`, `FINANCE_MANAGER`, `AUDITOR`). Supported: TOTP (RFC 6238, e.g., Authy/Google Authenticator) and WebAuthn/FIDO2 (platform key + hardware key). Backup codes: 8 single-use codes, hashed (bcrypt). 2FA cannot be disabled by the user for privileged roles without an ORG_OWNER audit-log override. | Automated config check: privileged session without `amr: mfa` is rejected at API gateway. |
| NFR-SEC-003 | 🔴 M | **Password policy (when passwords are used):** min 12 chars, no top-1M common passwords (haveibeenpwned k-anonymity check on set/change), 90-day expiry soft prompt, lockout after 10 failed attempts (15 min), no password reuse of last 12. Password storage: Argon2id (m=65536, t=3, p=4). Client-portal magic-link login avoids passwords entirely (default). | OWASP ASVS 4.0 V2.1–V2.3; automated password-strength test harness. |
| NFR-SEC-004 | 🔴 M | **CSRF protection:** All state-changing APIs (POST/PUT/PATCH/DELETE) require a double-submit-cookie CSRF token (for browser clients) OR a `Content-Type: application/json` enforcement with custom header `X-Requested-With: XMLHttpRequest`. SameSite=Lax cookies. | OWASP ASVS 4.0 V6.5; automated CSRF testing in CI. |
| NFR-SEC-005 | 🔴 M | **SSO / SAML OIDC (Enterprise):** Enterprise tenant may enable single sign-on for internal staff (ORG_OWNER/FINANCE/PROPERTY) via SAML 2.0 or OIDC. IdP-initiated flows allowed with replay protection (InResponseTo validation, 5-min skew). SCIM 2.0 auto-provisioning/deprovisioning supported (Azure AD, Okta, Google Workspace). | Okta + Azure AD interoperability test suite (manual + automated). |

### 3.2 Encryption at Rest & in Transit

| NFR ID | Class | Requirement |
|---|---|---|
| NFR-SEC-100 | 🔴 M | **TLS 1.2 minimum, TLS 1.3 preferred, for all in-transit traffic.** Client → CDN, CDN → LB, LB → app, app → DB, app → KMS, app → object storage: all TLS. Server cipher suites restricted (no CBC, no RSA key exchange; ECDHE + AEAD only). HSTS preloaded (max-age=63072000; includeSubDomains; preload). |
| NFR-SEC-101 | 🔴 M | **Full-disk encryption (FDE) on every storage volume:** DB volumes, app ephemeral volumes, backup volumes, log volumes. For AWS: EBS `encrypted: true` with KMS-managed CMK. For Azure: Disk Encryption Set with CMK. |
| NFR-SEC-102 | 🔴 M | **Database column-level encryption (CLE) for PII.** Columns marked `*_pii` in the schema are encrypted at rest with AES-256-GCM using the per-tenant data key (NFR-ISL-005). Encrypted columns: name, email, phone, address_line_*, bank account reference, tax_id, IP_address (in audit logs), payment_gateway_customer_id (already a token, but encrypted as defence-in-depth). |
| NFR-SEC-103 | 🟡 S | **Application-layer encryption of invoice PDFs:** Invoice PDFs stored in object storage are additionally encrypted (AES-256-GCM) with a per-tenant document-key, so that a direct bucket read returns ciphertext. Document key is derived from the tenant KMS key + invoice_id (HKDF). |

### 3.3 Input Validation & Injection Mitigation

| NFR ID | Class | Requirement |
|---|---|---|
| NFR-SEC-200 | 🔴 M | **OWASP Top 10 (2021) zero high/critical findings.** Independent pen test report at least annually + quarterly automated scans (OWASP ZAP, Burp Suite Enterprise). Critical (CVSS ≥ 9.0) → patched in ≤ 24 h; High (CVSS 7.0–8.9) → ≤ 72 h; Medium → ≤ 14 days; Low → ≤ 30 days. |
| NFR-SEC-201 | 🔴 M | **SQL injection prevention:** All queries use parameterised queries OR a type-safe query builder (Prisma / Kysely / Drizzle) with compile-time parameter binding. Raw SQL is banned from application code by static analysis (`grep` rule + AST lint). Raw SQL is allowed **only** in RLS policy definitions, migrations, and stored procedures — each reviewed by Security Lead. |
| NFR-SEC-202 | 🔴 M | **XSS & injection output encoding:** User-controlled strings rendered in the browser pass through a sanitiser (DOMPurify config: DEFAULT + SVG+MathML allowed, no `iframe`, no `javascript:`). PDF generation (invoice templates) uses Handlebars with `{{ }}` HTML-escape by default; `{{{ }}}` triple-brace requires Security Lead sign-off in code review. |
| NFR-SEC-203 | 🔴 M | **File upload safety:** End-client portal supports uploads (dispute evidence, lease docs, meter photos). All uploads are: (1) scanned for malware via ClamAV REST (or equivalent SaaS); (2) extension-allowlist + MIME-sniff-verified (`pdf`, `jpg`, `png`, `gif`, `xlsx`, `csv` only); (3) stored in tenant-scoped prefix (NFR-ISL-004); (4) served via `Content-Disposition: attachment` + separate download domain to thwart same-origin XSS; (5) max size per file = 25 MB. |

### 3.4 Vulnerability Management

| NFR ID | Class | Requirement |
|---|---|---|
| NFR-SEC-300 | 🔴 M | **SBOM generated on every release** (CycloneDX 1.5 JSON). SBOM includes NPM, Go/Python/Rust crates, Docker base images. Dependabot/Renovate runs daily; high/critical CVSS on runtime dependencies → patch or accept documented risk within 72 h. |
| NFR-SEC-301 | 🔴 M | **Container security:** Docker images scanned by Trivy/Grype pre-push; high/critical CVSS blocks deploy. Images are distroless or Alpine-minimal; no shell in prod images where possible. Read-only root filesystem; runs as non-root user (UID ≥ 10000). No secrets in image (env vars from KMS/Secrets Manager at runtime). |
| NFR-SEC-302 | 🔴 M | **Secret zero-trust:** No plaintext secrets in repo (git-secrets + gitleaks in pre-commit and CI). All secrets in KMS/Secrets Manager; app boot process fetches them with short-lived instance roles. Leaked secret → automated rotation via Incident Response Playbook #MTI-IR-001. |

### 3.5 Logging & Monitoring (Security)

| NFR ID | Class | Requirement |
|---|---|---|
| NFR-SEC-400 | 🔴 M | **Security events are never sampled** (100% logged): auth success/failure, role change, data export, CROMSTEL_SUPPORT grant/revoke/use, encryption key rotation, config change on RBAC/tenancy, void of invoice > $10k, refund > $5k, admin login from new geo. |
| NFR-SEC-401 | 🔴 M | **No PII in logs.** PII stripping middleware runs on every structured log line. Regex patterns for email, phone, tax_id, IBAN, card PAN are applied at log-ingestion time. Email addresses are replaced with `sha256(email+salt)` for correlation. Log retention: 90 days hot, 1 year warm, then delete (security events: retained 7 years in cold immutable WORM storage per BR-LEG-03). |
| NFR-SEC-402 | 🔴 M | **WAF in front of public endpoints** (Cloudflare/AWS WAF/Azure Front Door WAF). Managed ruleset: OWASP Core Rule Set 3.3 (paranoia level 2), IP reputation list, bot management for CLIENT portal login (rate limit + challenge on failed magic-link attempts). |

---

## 4. Performance & Scalability (Category: PERF / SCL)

### 4.1 Response Time Targets (Synchronous API Endpoints)

Measured at **P95**, **P99**, and **MAX** over a rolling 7-day window. Baseline = 1,000 concurrent active users across 50 tenant orgs, DB size 200 GB, 10M invoice rows. Excludes client-network latency (i.e., measured at the load balancer).

| Endpoint Group | 🔴 M P95 | 🟡 S P99 | 🟡 S MAX | Notes |
|---|---|---|---|---|
| Authentication (login, 2FA verify, refresh) | ≤ 600 ms | ≤ 1.5 s | ≤ 3 s | External IdP SSO excluded (capped at 10 s MAX) |
| Dashboard (KPIs + charts) | ≤ 1.2 s | ≤ 2.5 s | ≤ 5 s | Pre-aggregated materialised views |
| List view (invoices, clients, units, meters) — 25 rows / pagination | ≤ 500 ms | ≤ 1.2 s | ≤ 3 s | RLS + index on `(tenant_id, created_at DESC)` |
| Invoice detail view (single invoice, with drill-down) | ≤ 400 ms | ≤ 1 s | ≤ 2 s | Includes line items, linked reads |
| PDF render (single invoice, A4, 30 lines) | ≤ 1.5 s | ≤ 4 s | ≤ 8 s | First request; subsequent served from object-storage cache |
| Record a meter read (single) | ≤ 250 ms | ≤ 600 ms | ≤ 1.5 s | Includes RLS + validation pipeline |
| CSV bulk import (2,000 rows — meter reads) | ≤ 8 s | ≤ 20 s | ≤ 45 s | Async; progress streamed via SSE |
| Payment initiation (hosted token to gateway) | ≤ 2 s | ≤ 5 s | ≤ 12 s | Includes gateway round-trip (externally bounded) |
| Report export (CSV, 100k rows) | ≤ 30 s | ≤ 90 s | ≤ 3 min | Async, background job |

### 4.2 Batch / Asynchronous Throughput

| NFR ID | Class | Requirement |
|---|---|---|
| NFR-PERF-010 | 🔴 M | **Billing run throughput:** A single tenant org with 10,000 active units × 6 charge lines average = 60,000 invoice lines across ~10,000 invoices completes DRAFT generation in ≤ 4 hours wall-clock on default infrastructure. |
| NFR-PERF-011 | 🔴 M | **Concurrent billing runs:** Platform can sustain 20 simultaneous billing runs (each 10k-invoice equivalent) without individual runtime exceeding 1.3× the solo-runtime baseline. |
| NFR-PERF-012 | 🟡 S | **PDF generation throughput:** 5,000 invoice PDFs rendered and written to object storage in ≤ 30 minutes (≈ 2.8 docs/sec sustained). |
| NFR-PERF-013 | 🟡 S | **Email deliverability (transactional):** 99% of ISSUED invoice emails are delivered (received by MX) within 10 minutes of invoice issue; 99.9% within 1 hour (SendGrid/Postmark fallback). |

### 4.3 Scalability

| NFR ID | Class | Requirement |
|---|---|---|
| NFR-SCL-001 | 🔴 M | **Horizontal, zero-downtime scale-out:** App service layer supports adding/removing instances in < 2 minutes with 0 dropped requests (graceful connection drain). Scaling triggers target 60% CPU or 80% memory. |
| NFR-SCL-002 | 🔴 M | **DB vertical + connection pooling:** PostgreSQL primary supports vertical upgrade (instance size) within a maintenance window with ≤ 15 min downtime (for re-size) OR Citus/PG sharding in Scale phase. PgBouncer in front for connection pooling (min. 10,000 pooled connections across platform). |
| NFR-SCL-003 | 🟡 S | **Multi-region active-passive by Month 18:** EU + US regions operate as active-active for marketing/web; data-plane is per-tenant-region (NFR-ISL-012). Region failover: RPO ≤ 1 h (async replication), RTO ≤ 4 h. |
| NFR-SCL-004 | 🔴 M | **Multi-tenancy load isolation (noisy-neighbour):** Rate-limits at the API gateway are per-tenant-per-endpoint. Defaults: 300 req/min/user, 3,000 req/min/tenant, 10 billing-run concurrent jobs per tenant. A noisy tenant cannot degrade P95 latency of other tenants by more than 10% (verified via chaos test quarterly). |

---

## 5. Availability & Reliability (Category: AVA)

### 5.1 Uptime SLAs

| Tier | Monthly Uptime 🔴 M | SLA Credit | Maintenance Window |
|---|---|---|---|
| **Free** | ≥ 99.5% | — | Any time, 48 h notice |
| **Pro** | ≥ 99.9% (≤ 43 min 50 s downtime/mo) | 10% credit if < 99.9%, 25% if < 99.0%, 50% if < 95.0% | Tuesdays 02:00–04:00 tenant-local (per region); max 4 h / month; 7-day notice |
| **Enterprise** | ≥ 99.95% (≤ 21 min 55 s downtime/mo) | Custom contract (15% / 35% / 60% bands) + dedicated on-call | Negotiable; dedicated maintenance lane |

### 5.2 Reliability NFRs

| NFR ID | Class | Requirement |
|---|---|---|
| NFR-AVA-001 | 🔴 M | **Multi-AZ deployment (3 AZs minimum).** App service, RDS/Azure SQL (primary + standby in separate AZ), Redis (cluster mode 3 shards × 2 replicas), object storage (replication 3 AZ), KMS keys (multi-AZ). Single AZ failure → automated failover, RPO ≤ 1 min, RTO ≤ 10 min (DB), < 1 min (app). |
| NFR-AVA-002 | 🔴 M | **Backup & restore:** (a) DB: continuous point-in-time recovery (PITR) with 35-day retention; weekly full snapshot retained 7 years (encrypted, cross-region copied). (b) Object storage: versioning enabled + cross-region replication (CRR) to recovery region; deleted versions retained 365 days. Restore SLA: 1 TB DB restore in ≤ 8 h. Annual restore test (scheduled, documented). |
| NFR-AVA-003 | 🔴 M | **Idempotency everywhere.** Every write API accepts an `Idempotency-Key: <UUID>` header; the platform returns the same response for the same key for 24 h (stored in idempotency store). Billing runs are idempotent per FR-BR-002; payment submissions via gateway use idempotency tokens. |
| NFR-AVA-004 | 🟡 S | **Chaos engineering:** Monthly game-days in staging (quarterly in production with Enterprise customer opt-in): kill 1 app instance, kill 1 DB replica, simulate 30% packet loss to S3, simulate KMS throttling. Objective: no user-facing errors > 5 minutes for single failure. |
| NFR-AVA-005 | 🔴 M | **Disaster recovery (DR) playbook:** Fully documented, tested annually via tabletop + partial failover. Full regional failover (worst-case scenario): RPO ≤ 1 h, RTO ≤ 8 h for Pro tier, RPO ≤ 15 min / RTO ≤ 2 h for Enterprise with DR add-on. |

---

## 6. Usability & Accessibility (Category: USA / ACC)

| NFR ID | Class | Requirement |
|---|---|---|
| NFR-USA-001 | 🔴 M | **WCAG 2.2 AA conformance** for all user-facing UI (admin console + client portal). Screen-reader tested (NVDA + VoiceOver), keyboard-only navigable, colour contrast 4.5:1 minimum (text), 3:1 minimum (large text/icons). Exceptions (invoice PDF templates): default templates AA; custom templates tenant's responsibility (documented). |
| NFR-USA-002 | 🟡 S | **UX heuristics (Nielsen Norman Group 10 Heuristics):** ≥ 4.2/5 average score in expert review per release. No heuristic rated below 3. |
| NFR-USA-003 | 🔴 M | **Internationalisation (i18n):** UI string externalisation (ICU message format, no hardcoded English); support for Right-to-Left (Arabic, Hebrew) layout; timezone-per-user setting; locale-aware date, number, and currency formatting (Intl API). MVP languages: English (UK), English (US), Arabic (AE), Spanish (ES). Add per release. |
| NFR-USA-004 | 🟡 S | **Time-to-first-task (TTFT) for new user:** ORG_OWNER completing onboarding wizard → creating first property → creating first client → running first billing run (all with sample data) in ≤ 15 minutes without reading documentation. Usability tested on 8 participants; 6/8 must achieve target. |

---

## 7. Maintainability, Extensibility & Operability (Category: MNT / OPS)

| NFR ID | Class | Requirement |
|---|---|---|
| NFR-MNT-001 | 🔴 M | **Code quality gates (CI):** TypeScript strict mode + no `any` escape (or `// eslint-disable` requires 2-eyes review); ESLint pass; Prettier format; test coverage ≥ 80% (line), ≥ 70% (branch) for billing-engine, security, and RBAC modules; ≥ 60% overall. SonarQube critical code-smells 0. |
| NFR-MNT-002 | 🔴 M | **Every async job** (billing run, PDF render, email, export, report) has: (a) unique job id + status (QUEUED/RUNNING/SUCCESS/FAILED/PARTIAL) with progress %; (b) structured log stream (job_id, step, ms_elapsed, rows_processed); (c) automatic retry on transient failure with exponential backoff + jitter (max 5 attempts); (d) dead-letter queue (DLQ) with manual re-drive button + alert to ops. |
| NFR-OPS-001 | 🔴 M | **Observability three pillars:** (1) Metrics (Prometheus format → Datadog/Prom/Grafana): business metrics (invoices generated, payments succeeded, disputes opened), resource metrics (CPU, mem, DB conn pool, queue depth), SLO metrics (latency buckets, error rate, availability). (2) Structured logs (JSON, trace-id, span-id, tenant_id). (3) Distributed tracing (OpenTelemetry, OTLP exporter) across HTTP, queue, DB spans. PII stripped from ALL three pillars (NFR-SEC-401). |
| NFR-OPS-002 | 🔴 M | **SLO alerting on golden signals:** (a) Availability (error rate): ≥ 1% 5xx over 5-min window → P1 alert. (b) Latency: P95 latency > 2× NFR target over 5-min window → P2. (c) Saturation: DB CPU ≥ 85% for 10 min → P2. (d) Traffic anomaly: requests/min per tenant > 3× rolling baseline → P3 + auto rate-limit. |
| NFR-OPS-003 | 🟡 S | **Configuration is declarative (IaC):** Infrastructure (AWS CDK / Terraform), feature flags (LaunchDarkly or Unleash), tenant tier gating (config-service). No manual AWS Console / Azure Portal changes in PROD — everything via CI/CD pipeline with change management approval. |
| NFR-OPS-004 | 🔴 M | **Zero-downtime deployments:** Blue/green or canary deployments; database migrations are "expand-contract" safe (new column nullable + backfilled before app writes to it; old column removed in subsequent release). Rollback to previous release in < 2 minutes. Database rollback policy documented (roll forward preferred; rollback only when migration is reversible). |

---

## 8. Compatibility & Integration (Category: CMP)

| NFR ID | Class | Requirement |
|---|---|---|
| NFR-CMP-001 | 🔴 M | **Browser support (admin + client portal):** Last 2 major versions of Chrome, Edge, Firefox, Safari (desktop). Mobile Safari (iOS 16+), Chrome Android (last 2). No IE11 support (documented). |
| NFR-CMP-002 | 🔴 M | **Email client rendering:** Invoice + dunning email templates tested for correct display in: Gmail, Outlook 2019/365 (Win/Mac), Apple Mail, Yahoo Mail. Litmus/Email on Acid test pass for critical templates (invoice issued, overdue reminder, payment receipt). |
| NFR-CMP-003 | 🔴 M | **REST API versioning:** URL path versioned (`/v1/...`); breaking changes → new version. Deprecated version supported for 12 months with sunset header. OpenAPI 3.1 spec auto-generated at `/openapi.json`; Postman collection downloadable. |
| NFR-CMP-004 | 🟡 S | **Webhook events:** All important state transitions emit signed webhooks (HMAC SHA-256, timestamp + replay window 5 min): `invoice.issued`, `invoice.paid`, `invoice.overdue`, `payment.failed`, `dispute.opened`, `tenant.suspended`, `billing_run.completed`. 5 retry attempts; 410 Gone on endpoint return disables future delivery. |

---

## 9. Legal & Regulatory (Category: LEG)

| NFR ID | Class | Requirement |
|---|---|---|
| NFR-LEG-001 | 🔴 M | **GDPR / UK GDPR compliance:** Data-processing register maintained; DPIA performed for billing engine + end-client portal (high-risk processing); right-to-erasure requests fulfilled in ≤ 30 calendar days; DSARs fulfilled in ≤ 30 days (≤ 2 months complex); sub-processor list published and updated with 30-day notice (BR-LEG-06). |
| NFR-LEG-002 | 🔴 M | **Cookie consent (UK / EU):** Strictly-necessary cookies only by default; marketing/analytics cookies require explicit opt-in (CMP: OneTrust or Cookiebot). Consent records stored 5 years. |
| NFR-LEG-003 | 🔴 M | **Tax retention:** Invoices + supporting documents (meter reads, payments, audit log) retained a minimum of 7 years per BR-LEG-03. Enterprise may specify longer (up to 10 years). Retention is enforced via WORM (Write Once Read Many) storage for audit log and invoice PDFs. |
| NFR-LEG-004 | 🔴 M | **eIDAS qualified electronic signatures (QES):** For Enterprise customers requiring legally-binding e-invoices in EU (EN 16931 / Peppol), CromStel integrates with a qualified trust service provider (QTSP) — default advanced electronic seal (AES) suffices for most jurisdictions; QES is paid add-on. |
| NFR-LEG-005 | 🟡 S | **Privacy by Design audit:** Annual independent privacy audit; data minimisation review quarterly (old fields not needed → deprecate → delete from production). |

---

## 10. Environmental & Sustainability (Category: ESG — Advisory All)

| NFR ID | Class | Requirement |
|---|---|---|
| NFR-ESG-001 | 🟢 A | Compute workloads scheduled on AWS Graviton3 / Azure Ampere Altra ARM instances where possible (lower power, same price/performance). |
| NFR-ESG-002 | 🟢 A | PDF generator default: greyscale unless colour requested; compressed PDF (≤ 200 KB typical invoice). Email footers "consider the environment — do not print this invoice" (tenant-configurable). |
| NFR-ESG-003 | 🟢 A | Post/print-and-mail option default: quarterly statements instead of monthly invoices where jurisdiction allows; tenant org must explicitly opt-in to monthly postal invoices (to reduce paper). |

---

## 11. NFR Verification Plan

| NFR Category | Verification Method | Frequency | Owner |
|---|---|---|---|
| **Tenant Isolation (ISL)** | Automated cross-tenant penetration harness + quarterly schema audit + annual red-team. | Per PR + weekly + quarterly + annual | Security Lead |
| **Security (SEC)** | SAST (Semgrep) per PR, DAST (Burp/ZAP) weekly, dependency scan daily, SBOM per release, external pen-test annually. | Continuous + Annual | CISO |
| **Performance (PERF)** | k6 load test (synthetic workload, 1.2× peak projection) run in staging before every major release. APM dashboards monitored in prod. | Per release + real-time | Platform Architect |
| **Scalability (SCL)** | Soak test 3× peak load for 6 h before major release; chaos noisy-neighbour test quarterly. | Per major release + Quarterly | SRE Lead |
| **Availability (AVA)** | Monthly SLO report against uptime targets; quarterly single-AZ kill drill; annual DR test. | Monthly + Quarterly + Annual | SRE Lead |
| **Accessibility (ACC)** | axe-core scan in CI; quarterly manual audit (external consultant). | Per PR + Quarterly | Design Lead |
| **Legal (LEG)** | DPIA & privacy audit annual; tax/retention audit quarterly. | Annual + Quarterly | DPO / Legal Counsel |

---

## 12. Cross-References

| Document | Relevant Sections |
|---|---|
| [Product Vision](./product-vision.md) | Pillar 1 (Tenant Isolation First) — governs ISL & SEC priority. |
| [Functional Requirements](./functional-requirements.md) | §14 Tenancy Isolation Enforcement Points (layered implementation map). |
| [Business Requirements](./business-requirements.md) | §5 Compliance & Legal (BR-LEG), §6 KPIs (CG-6 uptime). |
| [Acceptance Criteria](./acceptance-criteria.md) | NFR-aligned test cases (performance benchmarks, pen-test pass/fail). |
| [Product Roadmap](./product-roadmap.md) | Phase-by-phase delivery of NFR-SCL-003 (multi-region), NFR-SEC-301 (chaos), etc. |

---

*NFR owner: CromStel IT Group CISO + Platform Architect. Amendments to Class 🔴 M (Mandatory) NFRs require written sign-off from CTO, CISO, and Director of Product with documented risk acceptance.*
