# Authorization Model

This document details the authorization model for **myTenant Invoice**, covering Role-Based Access Control (RBAC) and permission-based access, ensuring granular and secure control over system functionalities across different user types and organizations.

---

## 1. Overview

Authorization in myTenant Invoice is implemented through a combination of:

-   **Role-Based Access Control (RBAC)**: Users are assigned roles, and roles have predefined sets of permissions. This simplifies management for common user types.
-   **Permission-Based Access Control (PBAC)**: Fine-grained permissions are defined (e.g., `invoice.read`, `property.create`). Roles are composed of these permissions.
-   **Tenant-Aware Authorization**: All authorization checks inherently include an `organizationId` context, preventing cross-tenant data access or actions.

This model supports Platform-level, Organization-level, and Client-level roles with distinct permission sets.

---

## 2. Core Entities

### 2.1. Users

-   Represent individuals accessing the platform.
-   Can be members of multiple organizations (via `OrganizationMember`).
-   Have a `userId` that is universally unique.

### 2.2. Organizations

-   The primary tenant unit in the system.
-   All tenant-scoped data and actions are tied to an `organizationId`.

### 2.3. Roles (`Role` Model)

-   Logical grouping of permissions.
-   Can be `isPlatformRole` (e.g., `SUPER_ADMIN`) or `Organization` specific (e.g., `ORG_ADMIN`).
-   Roles are assigned to users within the context of an organization (`OrganizationMember`).

### 2.4. Permissions (`Permission` Model)

-   Atomic authorizations (e.g., `property.read`, `invoice.create`).
-   Mapped to roles via `RolePermission`.

### 2.5. Organization Member (`OrganizationMember` Model)

-   Links a `User` to an `Organization` and assigns them a `Role` within that organization.
-   Enforces the many-to-many relationship between users and organizations.

---

## 3. Defined Roles

Roles are categorized to reflect their scope and responsibilities:

### 3.1. Platform Roles (for CromStel IT Group staff)

These roles manage the SaaS platform itself and have elevated privileges.

| Role Name      | Description                                                    | Permissions (Examples)           |
| :------------- | :------------------------------------------------------------- | :------------------------------- |
| `SUPER_ADMIN`    | Full unrestricted access to all platform functionality and tenant data (with safeguards). | `platform.*`, `organization.*`, `user.*` (impersonation) |
| `PLATFORM_ADMIN` | Manages platform settings, users, subscriptions, and integrations. | `platform.read`, `platform.update`, `subscription.manage` |
| `PLATFORM_SUPPORT` | Access to view tenant data for support, with strict audit logging. | `tenant.read`, `support.manage`, `audit.read` |
| `PLATFORM_FINANCE` | Manages platform-level billing, revenue, and financial reporting. | `platform.finance.read`, `platform.finance.export` |

### 3.2. Organization Roles (for Tenant staff)

These roles manage resources within a specific organization.

| Role Name        | Description                                                          | Permissions (Examples)                                            |
| :--------------- | :------------------------------------------------------------------- | :---------------------------------------------------------------- |
| `ORG_OWNER`        | Full administrative control over their organization. Can manage billing, users, properties. | `organization.*`, `invoice.*`, `customer.*`, `property.*`         |
| `ORG_ADMIN`        | Manages organization settings, users, properties, and billing. Limited financial control. | `organization.update`, `member.manage`, `property.manage`, `invoice.read`, `invoice.create` |
| `FINANCE_MANAGER`  | Oversees all financial operations, invoices, payments, and reporting. | `invoice.*`, `payment.*`, `reports.*`, `tariff.*`                 |
| `PROPERTY_MANAGER` | Manages properties, units, leases, and related customer data.        | `property.*`, `unit.*`, `lease.*`, `customer.read`                |
| `BILLING_OFFICER`  | Focuses on invoice creation, sending, and payment tracking.          | `invoice.create`, `invoice.read`, `invoice.send`, `payment.record` |
| `ACCOUNTANT`       | Primarily for financial reporting and reconciliation.                | `invoice.read`, `payment.read`, `reports.export`                  |
| `SUPPORT_AGENT`    | Provides customer support within the organization.                 | `customer.read`, `lease.read`, `support.manage`                   |
| `VIEWER`           | Read-only access to most organization data.                        | `*.read` (e.g., `invoice.read`, `property.read`)                  |

### 3.3. Client Roles (for Tenant's Customers)

These roles are for external customers accessing the [Client Self-Service Portal](../10-operations/client-portal-guide.md).

| Role Name            | Description                                                          | Permissions (Examples)                                           |
| :------------------- | :------------------------------------------------------------------- | :--------------------------------------------------------------- |
| `CLIENT`               | General access to view their own invoices, payments, and property info. | `invoice.read.self`, `payment.read.self`, `property.read.self`   |
| `CLIENT_FINANCE_CONTACT` | Can view and pay invoices, access financial statements for their account. | `invoice.read.self`, `invoice.pay.self`, `payment.read.self`     |
| `CLIENT_READ_ONLY`     | View-only access to their own information.                           | `invoice.read.self`, `property.read.self`                        |

---

## 4. Permission Granularity

Permissions follow a `resource.action` convention. Examples:

-   `invoice.read`: View any invoice within the organization.
-   `invoice.create`: Create new invoices.
-   `invoice.update`: Modify existing invoices.
-   `invoice.approve`: Change invoice status to APPROVED.
-   `invoice.send`: Send invoices to customers.
-   `invoice.cancel`: Cancel an invoice.
-   `property.read`: View property details.
-   `property.create`: Add new properties.
-   `customer.read`: View customer details.
-   `payment.record`: Record a manual payment.
-   `reports.read`: Access dashboards and reports.
-   `user.impersonate`: (Platform Admin only) Impersonate an organization user (with strict audit).

---

## 5. Authorization Enforcement

Authorization must be enforced at **all critical layers**:

1.  **Database Layer**: Via `organizationId` foreign keys and explicit `WHERE` clauses in all Prisma queries. A user should never be able to query data outside their `organizationId` even if they bypass higher layers.
2.  **API Layer (Route Handlers / Server Actions)**: Middleware or decorators will intercept requests, resolve the authenticated user's organization context, and check if the user's role has the necessary permissions for the requested action and resource.
3.  **Service/Repository Layer**: Business logic should receive `organizationId` and `userId` as explicit parameters and perform checks before interacting with the database.
4.  **UI Layer**: UI elements (buttons, links, menu items) should be conditionally rendered or disabled based on user permissions, but this is a usability feature, not a security control.

### 5.1. Tenant Context Resolution

The `organizationId` for a request is always derived from the authenticated user's session and their `OrganizationMember` records. It is **never** trusted directly from client-side input.

### 5.2. Impersonation Safeguards

Platform `SUPER_ADMIN` and `PLATFORM_SUPPORT` roles may have impersonation capabilities. This feature will have:

-   Dedicated audit logs for every impersonation action.
-   Clear UI indicators when impersonating.
-   Time-limited impersonation sessions.
-   Restrictions on actions that can be performed while impersonating.

---

## 6. Security Considerations

-   **Least Privilege**: Users and roles are granted only the minimum permissions necessary to perform their tasks.
-   **Separation of Duties**: Critical actions (e.g., creating and approving invoices) can be assigned to different roles.
-   **IDOR Prevention**: All API endpoints and data access methods must validate `organizationId` and object ownership, preventing Insecure Direct Object Reference vulnerabilities.
-   **Access Log Monitoring**: All authorization failures are logged and monitored for suspicious activity.

---

## Related Documentation

-   [Authentication Architecture](authentication-architecture.md)
-   [Multi-Tenancy Architecture](multi-tenancy-architecture.md)
-   [Tenant Security](../05-security/tenant-security.md)
-   [Tenant Isolation Testing](../08-testing/tenant-isolation-testing.md)
-   [Security Controls](../SECURITY_CONTROLS.md)
