# Product Roadmap

This document outlines the high-level roadmap for **myTenant Invoice**, detailing the planned development phases and key milestones. This roadmap is subject to change based on market feedback, technical considerations, and business priorities.

---

## 1. Phases Overview (from Master Prompt)

The project will proceed through the following phases, ensuring a structured and comprehensive development process:

-   **Phase 0: Documentation and Architecture (Current)**: Laying the foundational documentation, architecture specifications, and planning artifacts.
-   **Phase 1: Foundation**: Core Next.js setup, basic styling, database integration, authentication, tenant resolution, and authorization.
-   **Phase 2: SaaS Administration**: Platform Super Admin interfaces, organization provisioning, subscription management, and feature flags.
-   **Phase 3: Organization Management**: Tenant-level profile management, branding, user roles, and configuration.
-   **Phase 4: Property and CRM**: Comprehensive property, unit, customer, and lease management.
-   **Phase 5: Services and Metering**: Catalog of billable services, advanced tariff engine, and utility meter management.
-   **Phase 6: Billing**: Core billing engine, invoice generation, and PDF document creation.
-   **Phase 7: Payments**: Payment processing, allocation, refunds, and reconciliation.
-   **Phase 8: Client Portal**: Self-service portal for clients to view invoices, make payments, and access information.
-   **Phase 9: AI**: AI assistant for client support and smart insights for debt risk.
-   **Phase 10: Analytics**: Dashboards, financial reporting, and data export capabilities.
-   **Phase 11: Production Hardening**: Security audits, performance tuning, accessibility, and final deployment preparations.

---

## 2. Key Milestones and Deliverables

### Phase 0: Documentation and Architecture (Current)

-   **Deliverables**: Complete project directory structure, all foundational documentation (product, architecture, database, API, security, UI/UX, dev, testing, devops, operations), Mermaid diagrams, ERD, feature backlog, risk register, ADRs.
-   **Status**: In Progress. Initial structure and many documents created; completing remaining details and diagrams.
-   **Target Completion**: End of Week 2 (from project start).

### Phase 1: Foundation

-   **Key Features**: Next.js project setup, TypeScript, Tailwind CSS, shadcn/ui integration, MySQL + Prisma setup, centralized Prisma client, environment validation, basic logging, Auth.js/NextAuth with email/password, tenant resolution middleware, core RBAC models, base layouts.
-   **Deliverables**: Working Next.js application, functional authentication, secure tenant context, passing unit/integration tests for core auth/tenant logic, updated documentation.
-   **Target Completion**: End of Week 4.

### Phase 2: SaaS Administration

-   **Key Features**: Platform Admin dashboard, organization creation/management, subscription plan definition, organization status management (Trial, Active, Suspended), trial management, feature flag system, global settings, platform user management.
-   **Deliverables**: Functional Super Admin panel, API for organization/plan management, updated documentation, initial E2E tests for provisioning.
-   **Target Completion**: End of Week 6.

### Phase 3: Organization Management

-   **Key Features**: Organization profile (branding, contact info), user invitation/management, custom role/permission definition, invoice settings (prefix, currency, locale), notification preferences, basic third-party integrations (e.g., Resend for email).
-   **Deliverables**: Organization Admin UI, APIs for configuration, updated documentation, RBAC tests.
-   **Target Completion**: End of Week 8.

### Phase 4: Property and CRM

-   **Key Features**: Portfolio, property, building, unit CRUD operations; customer/occupant profile management (individual/company, contacts), lease creation/management (start/end dates, recurring charges, prorations), historical data preservation.
-   **Deliverables**: Admin UIs for property/customer/lease, APIs, updated documentation, data model review.
-   **Target Completion**: End of Week 10.

### Phase 5: Services and Metering

-   **Key Features**: Service catalog definition (fixed, usage, percentage fees), advanced tariff engine (flat, tiered, block, time-of-use with versioning), meter registration (types, serials, UoM), meter reading entry (manual, import, API), consumption calculation, anomaly detection.
-   **Deliverables**: Admin UIs for services/tariffs/meters, APIs, core billing calculation logic, updated documentation, unit tests for calculations.
-   **Target Completion**: End of Week 12.

### Phase 6: Billing

-   **Key Features**: Recurring billing scheduler, metered billing engine, prorated charge calculation, invoice generation (batch/individual), invoice lifecycle management (Draft, Approval, Sent, Paid), PDF invoice generation (with branding), customizable invoice numbering.
-   **Deliverables**: Billing engine cron jobs/workers, invoice UIs, PDF generation service, updated documentation, extensive unit/integration tests for billing logic.
-   **Target Completion**: End of Week 14.

### Phase 7: Payments

-   **Key Features**: Payment recording (manual, Stripe webhook), payment allocation to invoices, partial payments, overpayments, refunds, payment reconciliation, idempotency for external payments.
-   **Deliverables**: Payment UIs, webhook handlers, payment processing services, updated documentation, integration tests for payment flows.
-   **Target Completion**: End of Week 16.

### Phase 8: Client Portal

-   **Key Features**: Client dashboard (balance, overdue, latest invoice, consumption), view/download invoices, pay invoices, payment history, property/lease info, document access, contact preferences, support requests.
-   **Deliverables**: Responsive client portal UI, APIs, updated documentation, E2E tests for client flows.
-   **Target Completion**: End of Week 18.

### Phase 9: AI

-   **Key Features**: Secure AI assistant for invoice/tariff/meter explanation (client portal), smart insights for debt risk (repeated late payments, increasing balances), human-review workflow for AI-derived actions.
-   **Deliverables**: AI service integration, secure API wrappers for AI tools, AI-powered UI components, updated documentation.
-   **Target Completion**: End of Week 20.

### Phase 10: Analytics

-   **Key Features**: Configurable dashboards (KPIs, charts), financial reports (billed/collected revenue, AR aging, invoice status), revenue by property/service/customer, utility consumption reports, secure data export (CSV, Excel, PDF).
-   **Deliverables**: Reporting engine, analytics dashboards, API for reports, updated documentation.
-   **Target Completion**: End of Week 22.

### Phase 11: Production Hardening

-   **Key Activities**: Comprehensive security audit, penetration testing, full tenant isolation testing, performance optimization (query tuning, caching review, CDN), accessibility audit, load testing, disaster recovery testing, backup verification, deployment documentation finalization.
-   **Deliverables**: Security audit reports, performance benchmarks, accessibility compliance, stable production environment.
-   **Target Completion**: End of Week 24.

---

## 3. Future Considerations

-   **Advanced Integrations**: Accounting systems (Xero, QuickBooks), CRM systems (Salesforce), IoT platforms.
-   **Mobile Applications**: Native iOS/Android apps.
-   **Advanced Analytics**: Predictive analytics for property yields, market trends.
-   **Blockchain for Transparency**: Immutable ledger for critical transactions.

---

## Related Documentation

-   [Product Vision](product-vision.md)
-   [Feature Matrix](feature-matrix.md)
-   [Project Status](../PROJECT_STATUS.md)
