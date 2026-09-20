# Feature Matrix

This document provides a high-level overview of the features planned for **myTenant Invoice**, categorized by module and indicating their development phase.

---

## 1. Feature Categories

-   **Core Platform**: Foundational features for multi-tenancy, authentication, and overall system management.
-   **Organization Management**: Features enabling tenants to configure and manage their own instance.
-   **Property & CRM**: Modules for managing physical properties, units, and customer relationships.
-   **Billing & Finance**: Core invoicing, tariff, metering, and payment processing capabilities.
-   **Reporting & Analytics**: Tools for data visualization, custom reports, and business intelligence.
-   **Integrations & AI**: Third-party connections and AI-assisted functionalities.
-   **Operations & Security**: Underlying infrastructure, monitoring, and security measures.

---

## 2. Feature List and Phases

| Module / Feature                | Description                                                          | Phase          | Status        | Notes                                          |
| :------------------------------ | :------------------------------------------------------------------- | :------------- | :------------ | :--------------------------------------------- |
| **Core Platform**               |                                                                      |                |               |                                                |
| Multi-Tenancy Foundation        | Row-level data isolation, organization context resolution            | Phase 1        | In Progress   | Implemented at DB/API layer                    |
| Authentication & Authorization  | User registration, login, RBAC, session management                 | Phase 1        | In Progress   | Auth.js v5, custom roles/permissions           |
| Global Configuration            | Platform-wide settings, feature flags                                | Phase 2        | Pending       | Super Admin scope                              |
| Audit Logging                   | Comprehensive logging of all critical actions                        | Phase 1        | In Progress   | Integrated into core services                  |
| **Organization Management**     |                                                                      |                |               |                                                |
| Company Profile & Branding      | Logo, colors, contact info, legal disclaimers                        | Phase 3        | Pending       | White-label support                            |
| User & Role Management          | Invite users, assign roles, custom role creation                     | Phase 3        | Pending       | Granular permissions                           |
| Invoice Settings                | Numbering format, currency, fiscal settings                          | Phase 3        | Pending       | Tenant-independent                             |
| Notification Preferences        | Email, SMS, in-app alert configuration                               | Phase 3        | Pending       | Per tenant, per user                           |
| **Property & CRM**              |                                                                      |                |               |                                                |
| Portfolio Management            | Grouping properties into portfolios                                  | Phase 4        | Pending       | Optional hierarchy                             |
| Property & Unit Management      | Addresses, types, owners, occupancy, images, documents               | Phase 4        | Pending       | Flexible property hierarchy                    |
| Customer & Occupant Records     | Contact info, billing addresses, lease terms, payment methods        | Phase 4        | Pending       | Lightweight CRM functionality                  |
| Lease & Occupancy Tracking      | Start/end dates, recurring charges, prorations, history              | Phase 4        | Pending       | Historical data preservation                   |
| **Billing & Finance**           |                                                                      |                |               |                                                |
| Service Catalog                 | Define billable services, packages                                   | Phase 5        | Pending       | Fixed, recurring, usage-based fees             |
| Advanced Tariff Engine          | Flat, tiered, block, time-of-use tariffs, late fees                  | Phase 5        | Pending       | Versioned tariff changes                       |
| Meter Management                | Utility meters, submeters, readings, types, status                   | Phase 5        | Pending       | Manual, import, API, smart meter               |
| Smart Meter & Consumption Engine| Automated readings, anomaly detection, consumption charts            | Phase 5        | Pending       | Comparisons (period, year, average)            |
| Billing Engine                  | Recurring, metered, prorated billing, discounts, taxes               | Phase 6        | Pending       | Financial precision (Decimal.js)               |
| Invoice Lifecycle Management    | Draft, approval, send, payment tracking, void, cancel, rebill        | Phase 6        | Pending       | PDF export, email delivery                     |
| Invoice Numbering               | Configurable per organization, unique constraint                     | Phase 6        | Pending       | Custom formats (e.g., INV-YY-NNN)              |
| Payment Processing              | Stripe, Adyen, PayPal integrations, manual payments                  | Phase 7        | Pending       | Tokenization, reconciliation, idempotency      |
| Credit Notes & Refunds          | Manage credit notes, process refunds                                 | Phase 7        | Pending       | Link to original invoices                      |
| **Reporting & Analytics**       |                                                                      |                |               |                                                |
| Financial Reporting             | Billed/collected revenue, AR aging, invoice status, payments         | Phase 10       | Pending       | Customizable templates                         |
| Dashboard Analytics             | KPI cards, charts, trend indicators, date filters                    | Phase 10       | Pending       | Org-specific metrics                           |
| Data Export (CSV, Excel, PDF)   | Secure export of financial and operational data                      | Phase 10       | Pending       | Tenant-scoped, authorization enforced          |
| **Integrations & AI**           |                                                                      |                |               |                                                |
| Third-Party Integrations        | Stripe, Resend, S3, OpenAI, Anthropic, custom webhooks               | Phase 3/9      | In Progress   | Centralized configuration, secure credentials  |
| AI Assistant (Client Portal)    | Invoice/tariff/usage explanation, document retrieval                 | Phase 9        | Pending       | Secure, tenant-scoped access via tools         |
| Debt Risk & Smart Insights      | Anomaly detection, payment patterns, outstanding balance             | Phase 9        | Pending       | Human review required, estimates only          |
| **Operations & Security**       |                                                                      |                |               |                                                |
| CI/CD Pipelines                 | Automated testing (unit, integration, E2E), builds, deployments      | Phase 0/11     | In Progress   | GitHub Actions, IaC                            |
| Vulnerability Management        | Dependency scanning, security audits, incident response              | Phase 0/11     | In Progress   | Continuous monitoring, penetration testing     |
| Data Encryption                 | At rest (AES-256), in transit (TLS 1.2+)                             | Phase 0/1      | In Progress   | Infrastructure & application layers            |
| Backup & Disaster Recovery      | Automated backups, RPO/RTO, restore procedures                       | Phase 0/11     | In Progress   | Documented in architecture                     |
| Monitoring & Observability      | Structured logging, error tracking, performance monitoring           | Phase 0/11     | In Progress   | Sentry, Prometheus, Grafana                    |

---

## Related Documentation

-   [Product Vision](product-vision.md)
-   [Functional Requirements](functional-requirements.md)
-   [Non-Functional Requirements](non-functional-requirements.md)
-   [Product Roadmap](product-roadmap.md)
-   [Project Status](../PROJECT_STATUS.md)
