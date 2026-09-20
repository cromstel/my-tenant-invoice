# Security Overview

## Executive Summary

myTenant Invoice is a Software-as-a-Service multi-tenant billing and invoicing platform operated by **CromStel IT Group**. The platform processes sensitive financial data including customer PII, lease contracts, bank account tokens, payment card data, tax filings, and accounts receivable records for Property Management Organizations (PMOs), Real Estate Investment Trusts (REITs), and residential/commercial landlords globally.

This document summarizes the **security control framework** in place to protect confidentiality, integrity, and availability of tenant data. Detailed deep-dives for each control domain follow in the companion files within this `05-security/` directory.

## Applicable Compliance & Certifications

| Framework / Standard | Status         | Scope                              | Certificate Expiry |
|----------------------|----------------|------------------------------------|--------------------|
| SOC 2 Type II        | Certified      | Trust Services Criteria: Security, Availability, Confidentiality, Processing Integrity | 2026-04-30 |
| ISO 27001:2022       | Certified      | ISMS covering all service operations | 2027-02-18 |
| PCI DSS v4.0         | SAQ-A Validated| Cardholder data environment (tokenization via Spreedly/PCI Proxy; PAN never touches CromStel servers) | 2025-12-31 |
| ISO 27701            | Certified      | PII handling for GDPR/CCPA alignment | 2027-02-18 |
| HIPAA                | Signed BAAs    | Healthcare-sector tenants (US)     | Per-BAA |
| GDPR / UK GDPR       | Compliant      | EU/EEA data subjects; SCC-based transfers (Standard Contractual Clauses IDTA + TIA performed) | Ongoing |
| CCPA / CPRA          | Compliant      | California residents data subject rights | Ongoing |
| SOC 1 Type II        | Certified      | Financial reporting controls (for auditor tenants) | 2026-06-15 |
| CSA STAR Level 2     | Attested       | Cloud Security Alliance Cloud Controls Matrix | 2026-03-20 |

Certificates are available upon request from your Customer Success Manager, or via the Trust Center: https://trust.cromstel.com (requires customer login).

## Shared Responsibility Model

| Responsibility Area               | CromStel (SaaS Provider)                          | Customer (Organization Owner)
|-----------------------------------|---------------------------------------------------|----------------------------------------
| **Facility & Physical**           | Data center (AWS/Azure) physical security, cages, guards, environmental controls | Building access for on-premises systems (if hybrid)
| **Network & Infrastructure**      | VPC design, network ACLs, WAF, DDoS protection, TLS termination, IPSec interconnect | Customer-side firewall rules, allowlisting, IPSec VPN setup to on-prem
| **Hypervisor / Host OS Patching** | EC2/Kubernetes node patching, container host hardening | —
| **Platform & Application Code**   | Application security, secure SDLC, dependency scanning, pen testing | Custom integrations using CromStel API — secure coding on client side
| **Data — At-Rest Encryption**     | AES-256-GCM encryption of all tenant data volumes; KMS key management | Customer-Managed Keys (CMK BYOK) optional — CMK lifecycle in customer KMS
| **Data — Access Controls**        | RBAC engine, row-level isolation enforcement, auth stack | Proper role assignment within tenant org, least privilege, MFA enforcement policy
| **Credentials & Secrets**         | Platform-level secret storage (HashiCorp Vault)       | API keys, tokens, webhook signing secrets at customer side
| **Identity & Authentication**     | IdP (SSO/SAML/OIDC support), MFA engine, session mgmt | Enabling SSO-only org policy, disabling shared accounts
| **Patching Client-Side**          | Dashboard, SDK updates                               | Upgrading user browsers, operating systems, SDK versions in custom code
| **Data Classification & Retention| Platform retention schemas per regulation             | Defining data classification, legal hold, deletion schedule per tenant policy
| **Incident Response & Monitoring**| 24/7 SOC, SIEM, SOAR, intrusion detection            | Reporting suspicious activity, designating Security Contact, enabling alert channels

## Security Domains

The remaining documents in the `05-security/` directory break down security implementation into the following domains:

| Document                        | Covers
|---------------------------------|-----------------------------------------------------------
| `threat-model.md`               | STRIDE threat analysis per component, Mermaid Data-Flow Diagram (DFD) for end-to-end billing flow
| `secrets-management.md`         | HashiCorp Vault architecture, secret lifecycle, rotation policies, zero-knowledge access workflows
| `encryption.md`                 | TLS 1.3 in transit, AES-256-GCM at rest, envelope encryption, AWS KMS / Azure Key Vault integration, BYOK/HYOK
| `tenant-security.md`            | PostgreSQL Row-Level Security (RLS) enforcement, IDOR prevention, tenant-isolation testing methodology
| `session-security.md`           | Cookie hardening, session lifetime, MFA/Step-up auth, device trust, session hijacking defenses
| `input-validation.md`           | Zod schemas for every request DTO, output encoding, SSRF/RCE/SQLi/XSS prevention strategy
| `audit-logging.md`              | Structured audit log schema, tamper-evident append-only log, SIEM integration, 7-year WORM archive
| `incident-response.md`          | IR playbook, severity matrix, customer notification SLAs, post-mortem process, communications template
| `vulnerability-management.md`   | Bug Bounty program (HackerOne), CVSS scoring, SLA patching windows, SAST/DAST/IAST/container scanning

## Security by Default

Every control below is **on by default** for every tenant; no opt-in required for baseline security:

1. **Encryption at-rest (AES-256-GCM) on every data volume including backups.**
2. **Encryption in-transit (TLS 1.3) mandatory**; HTTP requests rejected with 426 Upgrade Required.
3. **Multi-Factor Authentication (TOTP) prompt on first login.** Org admins can enforce MFA org-wide via security policy.
4. **Password strength minimums**: 16 chars + zxcvbn score ≥ 3 (no compromised passwords via HIBP k-anonymity check).
5. **Brute-force lockout** on auth endpoints (5 failures/10 minutes).
6. **SameSite=Lax + Secure + HttpOnly** session cookies with domain-scoping.
7. **CSP strict mode** (`Content-Security-Policy: default-src 'self'`; no unsafe-inline).
8. **Row-Level Security policies active** on every tenant table in Postgres. Connection pool resets session context between every request.
9. **API keys never stored in plaintext;** hash-sha256 only; displayed only once at creation.
10. **Audit log retention: 90 days hot, 7 years immutable archive** (WORM S3 Object Lock + Glacier).
11. **Automatic DB backups every 15 minutes,** cross-region replicated, 35-day point-in-time restore available.
12. **Security scans on every commit** — Snyk open-source, Checkmarx SAST, Trivy container, OWASP ZAP DAST on staging.

## Security Contact

| Concern                          | Address                                          | SLA
|----------------------------------|--------------------------------------------------|-------------------------------------
| Vulnerability disclosure         | security@cromstel.com (PGP available on website) | 24h first response; critical issues within 1 hour
| Customer security incidents      | soc@cromstel.com                                 | 1 hour first response for Severity 1 incidents
| SOC 2 / ISO 27001 / audit requests | compliance@cromstel.com                        | 5 business days
| Data subject / GDPR requests     | privacy@cromstel.com                             | 30 calendar days (per regulation)
| General security questions       | dev-security@cromstel.com                        | 3 business days

## Bug Bounty Program

CromStel IT Group operates a public bounty program on **HackerOne** — `hackerone.com/cromstel-it-group`.

| Severity (CVSS) | Typical Reward Range    | Scope                                                       |
|-----------------|-------------------------|-------------------------------------------------------------|
| Critical (9.0-10.0) | $5,000 – $50,000      | RCE, IDOR to cross-tenant data, authentication bypass with data impact, encryption breaks |
| High (7.0-8.9)     | $1,000 – $15,000       | IDOR within tenant, stored XSS in dashboard, auth misconfigurations with impact, SSRF with metadata access |
| Medium (4.0-6.9)   | $250 – $5,000          | Reflected XSS, CSRF on non-destructive actions, misconfigurations with moderate impact, information disclosure of non-sensitive data |
| Low (0.1-3.9)      | $50 – $500             | Missing security headers (non-impactful), best-practice issues, minor information leakage |

Out of scope (no bounty): DoS/DDoS, physical/social engineering, user enumeration by itself, spamming our users, third-party vendor bugs (report upstream please), SSL-stripping on networks you control.

Safe harbor: We will **not** take legal action against researchers who (1) stay within scope, (2) avoid privacy violations / data exfiltration beyond minimal proof-of-concept, (3) report promptly and give us reasonable patching time.

## Security Roadmap (Next 12 Months)

1. **Passkey / WebAuthn platform default** (passwordless login for all dashboard users by Q4 2025).
2. **Client-Side Field Level Encryption (CSFLE)** using MongoDB Queryable Encryption / AWS Encryption SDK for EU tenants to satisfy Schrems II concerns.
3. **Zero-Trust Service Mesh (Istio)** mTLS between all internal services; upgrade from current inter-service API key model.
4. **Confidential Computing (AMD SEV-SNP)** for all workload nodes in EU-West region to meet EDPB cloud recommendations.
5. **Automated DLP & Data Classification engine** (Vanta + custom ML classifier) to tag PII/PCI/financial data automatically.
6. **SOC 2 Type III** attestation target (Q2 2026) — continuous third-party monitoring.
7. **FedRAMP Moderate** package scoping for US Federal housing authority tenants.

---

*Document owner: Chief Information Security Officer (CISO), CromStel IT Group. Last review: 2025-09-01 by Security Steering Committee. Next scheduled review: 2026-03-01.*
