# ADR-004: Implementing Row-Level Multi-Tenancy Model

**Status**: Accepted

---

## Context

**myTenant Invoice** is a SaaS platform requiring strict tenant data isolation. The core requirement is that data belonging to one organization must never be accessible or inferable by another. Several multi-tenancy models exist (separate databases, separate schemas, shared database/separate schema, shared database/shared schema/row-level filtering). Key considerations for choosing a model include:

-   **Data Isolation**: Highest priority – absolutely no cross-tenant data leakage.
-   **Scalability**: Efficiently support 10,000+ tenants without excessive operational overhead.
-   **Cost-Effectiveness**: Optimize infrastructure costs for database resources.
-   **Flexibility**: Allow for organization-specific configurations, branding, and billing rules.
-   **Developer Experience**: Keep application code manageable and easy to reason about tenant context.
-   **Compliance**: Meet SOC 2, GDPR, PCI DSS, and HIPAA requirements for data separation.

---

## Decision

We have adopted a **Shared Database, Shared Schema with Row-Level Filtering** multi-tenancy model for **myTenant Invoice**.

This model involves storing all tenants' data within a single database and schema, but every tenant-specific record includes an `organizationId` column. Access to data is then strictly filtered at the application and database layers based on the authenticated user's `organizationId`.

Key aspects of this implementation:

-   **`organizationId` Column**: Every database table containing tenant-specific data has a mandatory `organizationId` foreign key, linking it to the `Organization` model.
-   **Prisma Query Enforcement**: All Prisma queries for tenant-scoped data will explicitly include `WHERE organizationId = <current_organization_id>` clauses.
-   **Server-Side Context**: The `organizationId` is always derived from the authenticated user's server-side session, never from client-side input.
-   **Centralized Authorization**: A dedicated authorization layer ensures that `organizationId` is automatically applied to all data access and mutation operations.
-   **Unique Constraints**: Tenant-scoped unique constraints are implemented using composite keys (e.g., `@@unique([organizationId, invoiceNumber])`) to allow uniqueness per organization rather than globally.

---

## Consequences

### Positive

-   **Cost-Effective Scalability**: Leverages a single database instance, reducing the overhead of managing separate databases per tenant. Scaling horizontal (read replicas, sharding) is simpler than managing many small databases.
-   **Simplified Database Management**: Easier to backup, restore, and apply schema migrations across all tenants.
-   **Optimized Resource Utilization**: Database resources are shared, leading to better overall utilization.
-   **Flexible Features**: Allows for platform-wide features and analytics that can aggregate (with appropriate anonymization/permissions) data across tenants more easily.
-   **Strong Data Isolation (when enforced correctly)**: With rigorous application-level and database-level filtering, tenant data remains logically separated.

### Negative

-   **Security Risk (if implemented incorrectly)**: The primary risk is accidental or malicious cross-tenant data leakage if `organizationId` filtering is omitted or bypassed. This necessitates extensive [Tenant Isolation Testing](../08-testing/tenant-isolation-testing.md).
-   **Noisy Neighbor Problem**: A single tenant with extremely heavy database usage could potentially impact other tenants, requiring careful monitoring and query optimization.
-   **Data Residency**: Implementing strict data residency per tenant (e.g., EU data in EU DB) is more complex with a shared database, potentially requiring database sharding by region.
-   **Schema Evolution**: While easier to apply, a schema change affects all tenants simultaneously, requiring careful testing.

---

## Related Documentation

-   [Multi-Tenancy Architecture](../multi-tenancy-architecture.md)
-   [Database Architecture](../database-architecture.md)
-   [Tenant Isolation](../03-database/tenant-isolation.md)
-   [Authorization Model](../authorization-model.md)
-   [Tenant Isolation Testing](../08-testing/tenant-isolation-testing.md)
-   [Security Controls](../SECURITY_CONTROLS.md)
