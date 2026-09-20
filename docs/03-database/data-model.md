# Data Model

This document provides a detailed overview of the core data models within **myTenant Invoice**, based on the MySQL database schema and managed by Prisma ORM. It describes the entities, their attributes, and relationships, emphasizing the multi-tenancy design principles.

---

## 1. Multi-Tenancy Foundation

The central principle of the data model is strict tenant isolation. Every tenant-scoped entity includes an `organizationId` field, establishing a clear ownership chain. This ensures that data from one organization cannot be accidentally or maliciously accessed by another.

**Core Multi-Tenancy Relationship**:

```mermaid
ERD
    ORGANIZATION {
        string id PK "Unique identifier for the organization (tenant)"
        string name
        string slug
        OrganizationStatus status
        ...
    }

    ORGANIZATION_MEMBER {
        string id PK
        string organizationId FK
        string userId FK
        string roleId FK
        ...
    }

    USER {
        string id PK
        string email
        string passwordHash
        ...
    }

    ROLE {
        string id PK
        string name
        boolean isPlatformRole
        ...
    }

    PERMISSION {
        string id PK
        string name
        ...
    }

    ROLE_PERMISSION {
        string id PK
        string roleId FK
        string permissionId FK
    }

    ORGANIZATION ||--o{ ORGANIZATION_MEMBER : has
    USER ||--o{ ORGANIZATION_MEMBER : belongs_to
    ROLE ||--o{ ORGANIZATION_MEMBER : has
    ROLE ||--o{ ROLE_PERMISSION : has
    PERMISSION ||--o{ ROLE_PERMISSION : has
```

---

## 2. Core Modules and Entities

Below is a conceptual overview of the main data entities, grouped by their functional modules. For detailed schema, refer to [Schema Reference](schema-reference.md) and `prisma/schema.prisma`.

### 2.1. Users & Authentication

-   **User**: Core user profile (email, password hash, name).
-   **Account**: Links users to OAuth providers (e.g., Google, GitHub).
-   **Session**: User session information for authentication.

### 2.2. Organizations & Roles

-   **Organization**: Represents a tenant (company, landlord, municipality) with its unique configurations (branding, currency, invoice prefix).
-   **OrganizationMember**: Defines a user's membership and role within a specific organization.
-   **Role**: Defines a set of permissions. Can be platform-wide or organization-specific.
-   **Permission**: Granular action/resource pair (e.g., `invoice.read`, `property.create`).
-   **RolePermission**: Junction table associating permissions with roles.

### 2.3. Subscriptions & Plans

-   **SubscriptionPlan**: Defines available SaaS plans (price, interval, features).
-   **OrganizationSubscription**: Tracks an organization's active subscription, linked to Stripe if applicable.

### 2.4. Property Management

-   **Portfolio**: Optional grouping of properties within an organization.
-   **Property**: Physical assets (address, type, owner, manager) belonging to an organization.
-   **Building**: Child of `Property`, represents a building within a property.
-   **Unit**: Child of `Property` or `Building`, represents individual rentable/billable units.

### 2.5. Customer Management

-   **Customer**: Represents the individual or company being billed (occupant, client). Linked to an `Organization` and optionally a `Property`.
-   **CustomerContact**: Multiple contact persons associated with a `Customer`.

### 2.6. Lease & Occupancy

-   **Lease**: Defines a tenancy agreement (start/end dates, recurring charges, linked `Unit` and `Customer`). Historical leases are preserved.

### 2.7. Services & Tariffs

-   **Service**: Defines billable services (e.g., Rent, Electricity, Maintenance) configurable per organization.
-   **ServicePackage**: Groups multiple services into a single package.
-   **ServicePackageItem**: Links a `Service` to a `ServicePackage`.
-   **Tariff**: Defines a billing rule for a `Service` (e.g., flat rate, tiered, usage-based).
-   **TariffVersion**: Versioned tariff rules with effective dates, ensuring historical invoice reproducibility.

### 2.8. Metering

-   **Meter**: Represents a utility meter (serial, type, UoM) linked to a `Property` or `Unit`.
-   **MeterReading**: Historical readings for a `Meter`, including reading type and anomaly detection.

### 2.9. Billing & Invoicing

-   **BillingCycle**: Defines recurring billing periods and due date offsets per organization.
-   **Invoice**: The core billing document (number, status, total, customer, organization).
-   **InvoiceItem**: Line items within an `Invoice`, linked to `Service`, `TariffVersion`, `Meter`.
-   **CreditNote**: Documents for reducing outstanding invoice amounts.
-   **CreditNoteItem**: Line items within a `CreditNote`.

### 2.10. Payments

-   **Payment**: Records incoming payments (amount, method, status, transaction ID).
-   **PaymentAllocation**: Links a `Payment` to an `Invoice`, specifying how much of the payment was applied.
-   **Refund**: Records refunds made against payments.

### 2.11. Documents & Notifications

-   **Document**: Metadata for files stored in object storage (e.g., PDFs, images), linked to an `Organization` and a specific `entityId`.
-   **Notification**: Stores in-app notifications for users.
-   **NotificationPreference**: User-specific preferences for notification channels and types.

### 2.12. Audit & Integrations

-   **AuditLog**: Immutable record of significant actions performed by users or the system.
-   **WebhookEndpoint**: Configurable external endpoints for real-time notifications.
-   **WebhookEvent**: History of outgoing webhook deliveries and their status.
-   **ApiKey**: Securely stored API keys for programmatic access.
-   **Integration**: Configuration for third-party services (e.g., Stripe, OpenAI).

### 2.13. Support

-   **SupportTicket**: Records customer support requests.

---

## 3. Key Data Principles

-   **Financial Precision**: All monetary values use MySQL `DECIMAL(19,4)` to prevent floating-point errors.
-   **Immutable History**: For financial and historical records (invoices, payments, meter readings, leases), soft deletion (`deletedAt` field) or status changes are used instead of destructive `DELETE` operations.
-   **Application-Level IDs**: Uses `cuid()` for all primary keys to provide opaque, non-sequential, and application-safe identifiers.
-   **Foreign Keys & Constraints**: Extensive use of foreign keys (`@relation`) and unique constraints (`@@unique`) to maintain relational integrity and enforce business rules (e.g., `@@unique([organizationId, invoiceNumber])`).
-   **Indexing**: Strategic indexing (e.g., `@@index([organizationId, createdAt])`) to optimize query performance, especially for tenant-scoped lookups.

---

## Related Documentation

-   [Entity Relationship Diagram (ERD)](erd.md)
-   [Schema Reference](schema-reference.md)
-   [Tenant Isolation](tenant-isolation.md)
-   [Financial Precision](financial-precision.md)
-   [Database Architecture](../02-architecture/database-architecture.md)
-   [Prisma Schema (on GitHub)](../../prisma/schema.prisma)
