# Threat Model

## Methodology

The CromStel myTenant Invoice threat model is maintained per **NIST SP 800-154**, **OWASP Threat Modeling Cheat Sheet**, and **Microsoft STRIDE** categorization. Every major feature undergoes threat modeling before architecture sign-off (documented via the `tm-YYYY-NNN.md` RFC template in our internal architecture repo). This document represents the **system-level baseline threat model**, updated quarterly or after major architectural changes.

Data classification levels per asset:

| Level       | Label           | Examples                                                   |
|-------------|-----------------|------------------------------------------------------------|
| Restricted  | Tier 4          | API keys, signing secrets, KMS material, credit card PAN (tokenized only at PSP), SSN/SIN/PEP data, legal hold archives |
| Confidential| Tier 3          | Customer PII, bank account tokens (vaulted), lease data, invoice amounts, tax IDs, org financials |
| Internal    | Tier 2          | Platform metrics, non-sensitive logs, support tickets, internal feature flags |
| Public      | Tier 1          | Marketing website, pricing page, public changelog, status page |

---

## System Data-Flow Diagram (DFD)

```mermaid
flowchart TB
    %% ==== EXTERNAL ENTITIES ====
    subgraph EXTERNAL [External / Untrusted]
        direction LR
        User[fa:fa-user Dashboard User\nBrowser / Mobile]
        APIClient[fa:fa-code Customer Integration\nBackend API Client]
        Payroll[fa:fa-building ERP / Accounting\nNetsuite, Xero, QuickBooks]
        Bank[fa:fa-university Payment Rails\nStripe, Adyen, ACH/BACS]
        Gov[fa:fa-landmark Tax Authorities\nHMRC, IRS, ATO]
        Hacker[fa:fa-skull Attacker\nThreat Actor]
    end

    %% ==== EDGE / PERIMETER ====
    subgraph PERIMETER [Perimeter / Edge Network]
        direction TB
        CF[fa:fa-cloud Cloudflare CDN\nWAF + DDoS + Bot Mgmt]
        ALB[fa:fa-sitemap AWS ALB\nTLS 1.3 Termination\nACM Certs]
        Kong[fa:fa-gateway Kong API GW\nRate Limits + OIDC + JWT Verify\nWAF Rules + IP Allowlist]
    end

    %% ==== APPLICATION SERVICES ====
    subgraph SERVICES [Application Services (VPC Private)]
        direction TB
        Auth[fa:fa-lock Auth Service\nOIDC/SAML, MFA, Sessions\nRBAC/ABAC Engine]
        API[fa:fa-server Backend API\nNode.js + NestJS\nZod Validation]
        Invoice[fa:fa-file-invoice Invoice Engine\nPricing + Tax Calc\nPDF Rendering]
        Pay[fa:fa-credit-card Payment Service\nPSP Orchestration\nTokenization]
        Meter[fa:fa-gauge-high Meter Service\nAnomaly Detection\nUtility Billing]
        Report[fa:fa-chart-column Reporting Worker\nPySpark + DuckDB\nRow-Level ACLs]
        Webhook[fa:fa-bell Webhook Service\nHMAC Signer\nRetry/DLQ]
    end

    %% ==== DATA LAYER ====
    subgraph DATA [Data Layer (VPC Isolated)]
        direction TB
        PG[(fa:fa-database Postgres Aurora\nMulti-AZ + RLS Policies\nAES-256 at REST)]
        Redis[(fa:fa-memory Redis Cluster\nRate Limiting + Caches\nEncryption)]
        S3[(fa:fa-sitemap S3 Buckets\nPDF Invoices + Reports\nObject Lock (WORM))]
        KMS[fa:fa-key AWS KMS\nBYOK Customer Keys\nEnvelope Encryption]
        Vault[fa:fa-vault HashiCorp Vault\nSecrets Mgmt\nDynamic DB Credentials]
        SIEM[fa:fa-search SOC SIEM\nElastic + Splunk\nAudit Logs]
        Queue[fa:fa-stream SQS / SNS\nAsync Worker Queues\nDLQ + Retry]
    end

    %% ==== DATA FLOWS ====
    User -->|HTTPS 1.3 + CSP\nDF-01: Login / Dashboard| CF
    APIClient -->|mTLS Optional\nDF-02: REST API v1 Calls| CF
    Payroll -->|DF-03: ERP Sync (Webhook Pull)| CF
    CF -->|DF-04: Scrubbed Traffic| ALB
    ALB -->|DF-05: Internal mTLS| Kong
    Kong -->|DF-06: Validated JWT + Rate Limited| Auth
    Kong -->|DF-07: Routed + Scoped Request| API

    Auth -->|DF-08: Session Write + MFA Check| Redis
    Auth -->|DF-09: User / Org Lookup (RLS)| PG
    Auth -->|DF-10: Audit: auth.login| SIEM

    API -->|DF-11: SQL Query with RLS ctx| PG
    API -->|DF-12: Cache Get/Set| Redis
    API -->|DF-13: Async Job Submit| Queue
    API -->|DF-14: Invoice Render| Invoice
    API -->|DF-15: Payment Initiation| Pay
    API -->|DF-16: Meter Validate/Capture| Meter
    API -->|DF-17: Report Job Kickoff| Report
    API -->|DF-18: Enqueue Webhook| Webhook
    API -->|DF-19: Structured Audit Event| SIEM

    Invoice -->|DF-20: Tax Jurisdiction Rates| PG
    Invoice -->|DF-21: PDF Upload Signed URL| S3

    Pay -->|DF-22: PSP Charge Request (TLS 1.3)| Bank
    Pay -->|DF-23: Vaulted Token Lookup| Vault
    Bank -->|DF-24: Charge Confirm + Webhook| Pay

    Meter -->|DF-25: Anomaly ML Model Predict| PG
    Report -->|DF-26: Parallel Read Replica Query| PG
    Report -->|DF-27: Report Artifact| S3

    Webhook -->|DF-28: Signed HMAC POST| APIClient
    Webhook -->|DF-29: Signed HMAC POST| Payroll

    PG -->|DF-30: Encrypt Writes via Envelope| KMS
    S3 -->|DF-31: SSE-KMS Encryption| KMS
    API -->|DF-32: Short-lived DB Creds| Vault
    API -->|DF-33: KMS Data Key Generate / Decrypt| KMS

    SIEM[SIEM] -->|DF-34: Alert + Ticketing\n(PagerDuty / Jira)| SOC[fa:fa-user-shield 24/7 SOC Analyst]

    %% ==== THREAT ACTOR FLOWS ====
    Hacker -->|T-01: SQLi Attempt| CF
    Hacker -->|T-02: IDOR URL Tamper| Kong
    Hacker -->|T-03: Brute Force Login| Auth
    Hacker -->|T-04: SSRF via Webhook URL| Webhook
    Hacker -->|T-05: Replay Signed Webhook| APIClient
    Hacker -->|T-06: MITM on Public WiFi| User
    Hacker -->|T-07: Priv Esc / Role Manipulation| API
    Hacker -->|T-08: Supply Chain Attack\nMalicious NPM Dep| API
    Hacker -->|T-09: Insider Exfiltration| DATA

    classDef trust fill:#f8d7da,stroke:#dc3545,color:#000
    classDef edge fill:#e2e3e5,stroke:#6c757d,color:#000
    classDef svc fill:#d1ecf1,stroke:#17a2b8,color:#000
    classDef data fill:#d4edda,stroke:#28a745,color:#000
    classDef actor fill:#fff3cd,stroke:#ffc107,color:#000
    classDef threat fill:#d1a3a3,stroke:#721c24,color:#000,stroke-width:2px

    class EXTERNAL,actor
    class PERIMETER,edge
    class SERVICES,svc
    class DATA,data
    class Hacker,threat
    class SOC,actor
```

**Figure 1**: End-to-end myTenant Invoice DFD v8.2. Threat flows (T-01..T-09) shown in red. Data flows (DF-01..DF-34) labeled. All service-to-service traffic uses AWS Security Groups with explicit deny default; zero internet egress except via controlled NAT + webhook egress IP allowlist.

---

## STRIDE Threat Analysis per Component

### TH-01: Cloudflare / Edge (T-01)

| ID | STRIDE Category | Threat                                   | Likelihood | Impact | Risk | Control(s)                                                                                                   | Residual Risk |
|----|-----------------|------------------------------------------|------------|--------|------|--------------------------------------------------------------------------------------------------------------|---------------|
| E-01 | DoS            | Volumetric DDoS against edge            | High       | Medium | **High** | Cloudflare Magic Transit + Argo Tiered Cache; always-on DDoS scrubbing; 100 Tbps+ protection capacity.       | **Low**       |
| E-02 | Tampering      | SQLi / XSS payload smuggle via URL       | Very High  | High   | **Very High** | Managed Ruleset (OWASP Top10, SQLi, XSS), custom WAF rules + advanced rate limiting, request body inspection. | **Very Low**  |
| E-03 | Spoofing       | Fake client IP via `X-Forwarded-For`     | High       | Medium | **High** | Explicit trusted proxy list; real-IP binding via CF Connecting-IP header only; downstream rejects all others. | **Low**       |
| E-04 | Elevation      | Cache poisoning of authenticated content | Medium     | High   | **High** | Bypass cache on Authorization header presence; `Cache-Control: no-store` private; Signed URLs for S3 assets.  | **Very Low**  |

### TH-02: API Gateway / Kong (T-02)

| ID | STRIDE Category | Threat                                   | Likelihood | Impact | Risk | Control(s)                                                                                                   | Residual Risk |
|----|-----------------|------------------------------------------|------------|--------|------|--------------------------------------------------------------------------------------------------------------|---------------|
| G-01 | IDOR           | Direct object reference across tenants   | Very High  | **Critical** | **Critical** | Gateway validates JWT `org_id` matches URL path `{org_id}`; service-layer RLS is authoritative second check.  | **Very Low**  |
| G-02 | Elevation      | Token scope manipulation                 | Medium     | High   | **High** | JWT signature verification via JWKS (EdDSA only); `alg=none` / `HS256` stripped; scope list parsed & pinned.  | **Very Low**  |
| G-03 | Info Disclosure| Stack trace / verbose error leak        | Medium     | Low    | **Medium** | JSON error envelope only; upstream catch-all for Node exceptions; `X-Powered-By` / Server banner suppressed. | **Very Low**  |
| G-04 | Repudiation    | Missing per-request audit trail         | Low        | High   | **Medium** | `X-Request-ID` + `X-Trace-ID` (OpenTelemetry) on every req/resp; full access logs shipped to SIEM in <10s.     | **Low**       |

### TH-03: Auth Service (T-03)

| ID | STRIDE Category | Threat                                   | Likelihood | Impact | Risk | Control(s)                                                                                                   | Residual Risk |
|----|-----------------|------------------------------------------|------------|--------|------|--------------------------------------------------------------------------------------------------------------|---------------|
| A-01 | Spoofing       | Credential stuffing / brute force        | **Very High** | High | **Critical** | Per-IP+user lockout; HIBP k-anonymity on set/change; CAPTCHA after 2 failures; adaptive auth (Device Fingerprint).| **Low**       |
| A-02 | Spoofing       | Session hijacking via XSS/cookie theft   | Medium     | **Critical** | **High** | HttpOnly + Secure + SameSite=Lax cookies; __Host- prefix; rotation on privilege change; short JWT (15m) + refresh 7d rolling. | **Very Low** |
| A-03 | Spoofing       | MFA bypass / TOTP phishing              | High       | High   | **High** | Passkey/WebAuthn phishing-resistant option; TOTP rate-limit (3/5min); step-up MFA on sensitive ops (void >$10k, API key create). | **Low** |
| A-04 | Tampering      | Token replay / stolen refresh token      | Medium     | High   | **High** | Refresh rotation; JTI bloom-filter revocation; Refresh token bound to device fingerprint + IP class.         | **Low**       |
| A-05 | Elevation      | Horizontal/vertical privilege escalation| Medium     | **Critical** | **High** | RBAC + ABAC dual enforcement at gateway/service/data layers; org:owner actions require dual approval (4-eyes).| **Very Low**  |

### TH-04: Backend API Services (T-07, T-08)

| ID | STRIDE Category | Threat                                   | Likelihood | Impact | Risk | Control(s)                                                                                                   | Residual Risk |
|----|-----------------|------------------------------------------|------------|--------|------|--------------------------------------------------------------------------------------------------------------|---------------|
| S-01 | Injection      | SQL injection via ORM escape            | Medium     | **Critical** | **High** | Prisma parameterized queries + strict; no raw SQL outside audited repository methods; prepared statements; Zod DTO validation. | **Very Low**  |
| S-02 | Injection      | Server-Side Request Forgery (webhook + report HTTP fetches) | High | **Critical** | **Very High** | Egress-only webhook subnet with Squid proxy allowlist; DNS rebind protection; 169.254.169.254 metadata IP blocked; RFC1918 rejected; URL preflight from isolated enclave. | **Low** |
| S-03 | RCE            | Supply chain malicious NPM/PyPI package | Medium     | **Critical** | **High** | Snyk + Dependabot; Sigstore provenance verification; Socket.dev behavioral analysis; sandboxed build runners; distroless containers; readOnlyRootFilesystem; drop ALL Linux capabilities. | **Low** |
| S-04 | IDOR (Data)    | Cross-tenant read via RLS bypass         | Low        | **Critical** | **High** | Periodic automated IDOR scan (Nuclei + custom) in CI; chaos-engineering injection test runs nightly; RLS regression tests in every PR. | **Very Low**  |
| S-05 | Info Disclosure| PII leak in logs / crash dumps          | High       | High   | **High** | JSON logger redaction rules (PII patterns → sha256:8 hash); ELK filter pipeline; crash dump sanitization before Sentry; Sentry scrubbing + DLP. | **Very Low** |
| S-06 | Repudiation    | Modified invoice with no audit trail    | Low        | **Critical** | **High** | Append-only CQRS projection; every write creates immutable EventStore record (Kafka topic, compacted, WORM archive 7yr). | **Low** |

### TH-05: Payment Service (T-XX)

| ID | STRIDE Category | Threat                                   | Likelihood | Impact | Risk | Control(s)                                                                                                   | Residual Risk |
|----|-----------------|------------------------------------------|------------|--------|------|--------------------------------------------------------------------------------------------------------------|---------------|
| P-01 | Tampering      | Double capture charge                   | Medium     | High   | **High** | Idempotency keys mandatory for POST payments; PSP idempotency key echoed; 4-eyes approval for void/refund >$10k. | **Very Low**  |
| P-02 | Info Disclosure| PAN exposure in platform                | Very Low   | **Critical** | **High** | Zero-card-data architecture (Spreedly PCI Proxy vault); PAN never decrypted on CromStel infrastructure; token only. | **Very Low**  |
| P-03 | Spoofing       | Fake inbound PSP webhook                | High       | High   | **High** | PSP HMAC verification (Stripe webhook_secret, Adyen HMAC) + source IP allowlist of PSP egress CIDRs only.        | **Very Low**  |

### TH-06: Data Layer (T-09 insider)

| ID | STRIDE Category | Threat                                   | Likelihood | Impact | Risk | Control(s)                                                                                                   | Residual Risk |
|----|-----------------|------------------------------------------|------------|--------|------|--------------------------------------------------------------------------------------------------------------|---------------|
| D-01 | EoP (Insider)  | DBA exfiltrates other tenant data        | Low        | **Critical** | **Very High** | Break-glass DBA access requires 2 approvers + 1 hour max duration; SCIM/JIT group membership auto-revoke; full DBA session keystroke recording via Boundary; anomaly detection queries. | **Low** |
| D-02 | Tampering      | Malicious DB edit to invoice total       | Low        | **Critical** | **High** | Row-level signature HMAC stored on every invoice row; periodic integrity verification job compares signed hash to data. | **Very Low** |
| D-03 | Info Disclosure| Backup snapshot access by ops staff    | Low        | High   | **High** | Snapshots encrypted with separate KMS CMK; snapshot restore requires CloudTrail multi-party approval; immutable S3 Object Lock. | **Low** |
| D-04 | DoS            | Expensive query (cartesian join) kills DB | Medium  | Medium | **High** | Statement timeouts 30s reads / 10s writes; pg_stat_statements anomaly detection; query planner review index advisor. | **Low** |

### TH-07: Webhook Service (T-04, T-05)

| ID | STRIDE Category | Threat                                   | Likelihood | Impact | Risk | Control(s)                                                                                                   | Residual Risk |
|----|-----------------|------------------------------------------|------------|--------|------|--------------------------------------------------------------------------------------------------------------|---------------|
| W-01 | SSRF           | Attacker points webhook to internal URL | Very High  | **Critical** | **Very High** | Isolated webhook VPC egress proxy (Squid + static allowlisted IPs + DNS over HTTPS rebind guard; RFC1918/metadata IP reject). | **Low** |
| W-02 | Tampering (client-side) | Customer's attacker replays or forges signed webhook | Medium | High | **High** | HMAC-SHA256 with 256-bit random signing secret; anti-replay timestamp (t=) with 5min skew; `MyTenant-Event-Id` de-dupe required on consumer. | **Very Low** |
| W-03 | Info Disclosure| Delivery log leaks PII payload           | High       | Medium | **High** | Delivery log retention 30 days; redacts PII (emails/amounts/names) → sha256 short hash in UI view; full payload only via break-glass. | **Low** |

---

## Attack Trees (Top 2 Risks)

### Attack Tree 1: Cross-Tenant Data Disclosure (Goal: Read Org B invoices as Org A user)

```
Goal: Extract confidential invoice data belonging to a different tenant
├── T1: Exploit IDOR in REST API
│   ├── T1.1: Tamper org_id path param
│   │   └── Mitigated by: Gateway JWT org_id match + 403
│   ├── T1.2: Tamper invoice_id path param to another org's invoice
│   │   └── Mitigated by: PostgreSQL RLS policy (WHERE org_id = current_setting)
│   └── T1.3: Craft filter[customer_id][in]=<other_org_customer>
│       └── Mitigated by: ABAC resource.org_id enforcement (OPA)
├── T2: Exploit IDOR in Reporting (JOINs across orgs)
│   └── Mitigated by: DuckDB row-level ACLs + report builder rewrites queries with org predicate
├── T3: Exploit misconfigured shared cache (Redis cache key leaking)
│   └── Mitigated by: All cache keys prefixed with org_id: prefix; integration tests verify isolation
└── T4: Exploit webhook data leak via misconfigured subscription
    └── Mitigated by: Webhook creation ABAC; audit events; can only create webhook for caller's org
```

### Attack Tree 2: Financial Fraud (Goal: Void $500k invoice, redirect balance to attacker bank account)

```
Goal: Write off a large invoice and divert funds
├── T1: Single user authorization
│   └── Mitigated by: 4-eyes dual approval workflow for >$10k voids
├── T2: Steal session token of user with org:admin
│   ├── T2.1: Phishing / session theft via XSS
│   │   └── Mitigated by: CSP strict, HttpOnly cookies, MFA, session rotation after IP change
│   └── T2.2: Admin endpoint MITM
│       └── Mitigated by: TLS 1.3 only + HSTS pinning + certificate transparency SCTs
├── T3: Modify database directly (insider DBA)
│   └── Mitigated by: Break-glass DBA, JIT access, dual approval, session recording, anomaly detection
├── T4: Compromise CI/CD pipeline → deploy malicious code
│   └── Mitigated by: GitHub Branch Protection, CODEOWNERS, required SAST/DAST pass, signed commits, SLSA Level 3 provenance
└── T5: Tamper bank_account on outgoing refund
    └── Mitigated by: Refund → original payment method only; new bank payee requires MFA step-up + 48h cooling
```

---

## Residual Risk Acceptance Register

After controls, following identified risks remain at Low / Very Low. Documented for annual executive sign-off:

| Risk ID | Description                                                                 | Accepted By                | Date       | Review Date |
|---------|-----------------------------------------------------------------------------|----------------------------|------------|-------------|
| RR-01   | Well-resourced APT + insider collusion could theoretically bypass dual JIT. | CEO + CISO + Audit Chair    | 2025-03-01 | 2026-03-01  |
| RR-02   | Zero-day in Node.js / Linux kernel exploited before upstream patch (0-day). | CISO                      | 2025-03-01 | 2025-09-01  |
| RR-03   | Cloud provider compromise (AWS/Azure hypervisor / KMS bypass).              | CEO + Board Risk Committee | 2025-03-01 | 2026-03-01  |

Controls to mitigate residual risks further: multi-cloud DR (active-active on AWS + Azure) in progress for Tier 1 tenants (RR-03).

---

## Penetration Testing Schedule

| Type                | Frequency         | Vendor              | Last Performed | Next Scheduled | Scope
|---------------------|-------------------|---------------------|----------------|----------------|---------------------------------
| External Web+API    | Quarterly (automated Nuclei + ZAP)      | Internal Red Team + CrowdStrike | 2025-08-15 | 2025-11-15 | All public endpoints (prod)
| Full-scope External | Annual            | Bishop Fox          | 2025-05-10 | 2026-05-10 | Web, API, auth, SSO, mobile
| Internal Cloud      | Annual            | NCC Group           | 2025-02-20 | 2026-02-20 | VPC, K8s, secrets, DB
| PCI ASV Scan        | Quarterly         | SecurityMetrics     | 2025-08-01 | 2025-11-01 | In-scope card environment (CDE)
| Red Team (Purple)   | Semi-Annual       | Coalfire            | 2025-06-15 | 2025-12-15 | Adversarial emulation
| Bug Bounty          | Continuous        | HackerOne           | Ongoing        | Ongoing        | See scope in security-overview.md

Last penetration test report summary available via Trust Center (customer login).
