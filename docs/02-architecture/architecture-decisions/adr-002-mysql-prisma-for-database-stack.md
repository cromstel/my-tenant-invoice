# ADR-002: Choosing MySQL 8+ and Prisma ORM for Database Stack

**Status**: Accepted (Supersedes PostgreSQL initial thought)

---

## Context

The initial project specification indicated PostgreSQL as a potential database, but a subsequent, more specific directive mandated a shift. The core requirements for the database layer are:

-   **Reliability**: ACID compliance, transaction support for financial operations.
-   **Scalability**: Ability to handle a large number of tenants and high transaction volume, including read replicas.
-   **Security**: Robust data encryption, access controls.
-   **Data Integrity**: Strong typing, foreign keys, unique constraints, and support for precise financial decimals.
-   **Developer Experience**: A powerful, type-safe ORM that integrates well with TypeScript and Next.js.
-   **Multi-Tenancy**: Native features or patterns to support row-level tenant isolation.

---

## Decision

We have chosen **MySQL 8+** as the relational database and **Prisma ORM** as the data access layer for **myTenant Invoice**.

This decision is based on the explicit project directive and the following factors:

-   **MySQL 8+**: Provides strong performance, high availability features (e.g., InnoDB clusters, read replicas), advanced security features, and native JSON support for flexible metadata. It is a proven choice for large-scale SaaS applications.
-   **Prisma ORM**: Offers a modern, type-safe, and intuitive API for database interactions. Its benefits include:
    -   **Type Safety**: Generates a TypeScript client based on the Prisma schema, eliminating runtime errors related to data structure.
    -   **Migrations**: `Prisma Migrate` provides a robust, version-controlled system for schema evolution.
    -   **Connection Management**: Handles database connections efficiently, crucial for serverless and high-concurrency environments.
    -   **Readability**: Clear and concise query API.
    -   **Integration**: Excellent integration with Next.js Server Actions and API Routes.
-   **Financial Precision**: MySQL's `DECIMAL(19,4)` type combined with Prisma's `Decimal.js` integration ensures accurate financial calculations, avoiding floating-point issues.

---

## Consequences

### Positive

-   **Clear Database Standard**: A definitive choice eliminates ambiguity and streamlines development efforts.
-   **Enhanced Data Integrity**: Strong typing and explicit schema definitions with Prisma reduce data-related bugs.
-   **Reliable Migrations**: Prisma Migrate ensures controlled and repeatable database schema changes.
-   **Optimized for Scale**: MySQL 8+ features and Prisma's query capabilities support high performance and scalability.
-   **Financial Accuracy**: Dedicated `Decimal` types prevent monetary calculation errors.

### Negative

-   **Migration from PostgreSQL**: Requires re-evaluating any PostgreSQL-specific features that might have been assumed initially.
-   **Operational Overhead**: Managing MySQL instances (especially self-hosted) can be complex, though cloud-managed services (e.g., PlanetScale, AWS RDS) mitigate this.
-   **Learning Curve**: Developers new to Prisma or MySQL might need time to adapt.

---

## Related Documentation

-   [Database Architecture](../database-architecture.md)
-   [Data Model](../03-database/data-model.md)
-   [Financial Precision](../03-database/financial-precision.md)
-   [Multi-Tenancy Architecture](../multi-tenancy-architecture.md)
-   [Tech Stack (in Master Prompt)](../../project-documentation.md#36-tech-stack)
-   [DATABASE TECHNOLOGY.md (Superseding)](../../../DATABASE%20TECHNOLOGY.md)
