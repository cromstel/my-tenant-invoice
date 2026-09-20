# Schema Reference

This document provides a detailed reference for the core database schema of **myTenant Invoice**, derived from the `prisma/schema.prisma` file. It describes each Prisma model, its fields, types, and relationships, with an emphasis on how multi-tenancy and financial precision are implemented.

---

## 1. Schema Overview

The schema is built on MySQL 8+ and managed by Prisma ORM. It adheres to the principle of row-level multi-tenancy, where nearly all tenant-specific records are explicitly linked to an `Organization` via `organizationId`.

**File Location**: [prisma/schema.prisma](../../prisma/schema.prisma)

---

## 2. Core Models and Fields

### 2.1. User & Authentication

#### `User`
-   `id`: `String` (`@id @default(cuid())`) - Unique user identifier.
-   `email`: `String` (`@unique`) - User's email address.
-   `passwordHash`: `String` - Hashed password.
-   `name`: `String?` - User's full name.
-   `image`: `String?` - Profile image URL.
-   `emailVerified`: `DateTime?` - Timestamp of email verification.
-   `createdAt`: `DateTime` (`@default(now())`)
-   `updatedAt`: `DateTime` (`@updatedAt`)
-   **Relations**: `accounts`, `sessions`, `organizationMembers`, `auditLogs` (as `actor`)

#### `Account`
-   `id`: `String` (`@id @default(cuid())`)
-   `userId`: `String` (`@map("user_id") @relation(fields: [userId], references: [id], onDelete: Cascade)`) - Links to `User`.
-   `type`: `String`
-   `provider`: `String`
-   `providerAccountId`: `String`
-   `createdAt`, `updatedAt`: `DateTime`
-   **Constraints**: `@@unique([provider, providerAccountId])`

#### `Session`
-   `id`: `String` (`@id @default(cuid())`)
-   `sessionToken`: `String` (`@unique`)
-   `userId`: `String` (`@map("user_id") @relation(fields: [userId], references: [id], onDelete: Cascade)`) - Links to `User`.
-   `expires`: `DateTime`

### 2.2. Organizations & Roles

#### `Organization`
-   `id`: `String` (`@id @default(cuid())`) - Unique ID for the tenant.
-   `name`: `String`
-   `slug`: `String` (`@unique`) - URL-friendly unique identifier.
-   `status`: `OrganizationStatus` (`@default(TRIAL)`) - Enum for organization lifecycle.
-   `currency`: `String` (`@db.VarChar(3) @default("USD")`) - ISO currency code.
-   `locale`, `timezone`, `invoicePrefix`, `nextInvoiceNumber`: Configuration fields.
-   **Relations**: `members`, `properties`, `customers`, `invoices`, etc.

#### `OrganizationStatus` (Enum)
-   `TRIAL`, `ACTIVE`, `PAST_DUE`, `SUSPENDED`, `CANCELLED`, `ARCHIVED`

#### `OrganizationMember`
-   `id`: `String` (`@id @default(cuid())`)
-   `organizationId`: `String` (`@relation(fields: [organizationId], references: [id], onDelete: Cascade)`) - Links to `Organization`.
-   `userId`: `String` (`@relation(fields: [userId], references: [id], onDelete: Cascade)`) - Links to `User`.
-   `roleId`: `String` (`@relation(fields: [roleId], references: [id], onDelete: Restrict)`) - Links to `Role`.
-   **Constraints**: `@@unique([organizationId, userId])`

#### `Role`
-   `id`: `String` (`@id @default(cuid())`)
-   `name`: `String` (`@unique`) - Unique role name (e.g., `ORG_ADMIN`).
-   `isPlatformRole`: `Boolean` (`@default(false)`) - Differentiates platform vs. organization roles.
-   **Relations**: `members`, `permissions` (via `RolePermission`)

#### `Permission`
-   `id`: `String` (`@id @default(cuid())`)
-   `name`: `String` (`@unique`) - Unique permission string (e.g., `invoice.read`).
-   **Relations**: `roles` (via `RolePermission`)

#### `RolePermission`
-   `id`: `String` (`@id @default(cuid())`)
-   `roleId`, `permissionId`: `String` (`@relation`) - Links `Role` and `Permission`.
-   **Constraints**: `@@unique([roleId, permissionId])`

### 2.3. Property Management

#### `Portfolio`
-   `id`: `String` (`@id @default(cuid())`)
-   `organizationId`: `String` (`@relation`) - Tenant scope.
-   `name`: `String`
-   **Constraints**: `@@unique([organizationId, name])`
-   **Relations**: `properties`

#### `Property`
-   `id`: `String` (`@id @default(cuid())`)
-   `organizationId`: `String` (`@relation`) - Tenant scope.
-   `portfolioId`: `String?` (`@relation`) - Optional link to `Portfolio`.
-   `name`: `String`
-   `address`: `String`
-   `propertyType`: `PropertyType` (`@default(RESIDENTIAL)`) - Enum.
-   `occupancyRate`: `Decimal` (`@db.Decimal(5, 2)`) - E.g., 85.50 for 85.5%.
-   `images`: `Json?`, `documents`: `Json?`
-   **Constraints**: `@@unique([organizationId, name])`
-   **Relations**: `buildings`, `units`, `customers`, `leases`, `meters`

#### `PropertyType` (Enum)
-   `RESIDENTIAL`, `COMMERCIAL`, `OFFICE`, `RETAIL`, `INDUSTRIAL`, `PUBLIC`, `EDUCATIONAL`, `MIXED_USE`, `OTHER`

#### `Building`
-   `id`: `String` (`@id @default(cuid())`)
-   `organizationId`, `propertyId`: `String` (`@relation`)
-   `name`: `String`
-   **Constraints**: `@@unique([organizationId, propertyId, name])`
-   **Relations**: `units`

#### `Unit`
-   `id`: `String` (`@id @default(cuid())`)
-   `organizationId`, `propertyId`: `String` (`@relation`)
-   `buildingId`: `String?` (`@relation`)
-   `unitNumber`: `String`
-   `occupancyStatus`: `UnitOccupancyStatus` (`@default(VACANT)`) - Enum.
-   `currentLeaseId`: `String?` (`@unique`, but typically `currentLeaseId String? @relation("CurrentUnitLease")` to represent 1:1 or 1:0-1 `Unit` to `Lease` relation)
-   **Constraints**: `@@unique([organizationId, propertyId, unitNumber])`
-   **Relations**: `leases`, `meters`, `currentLease` (self-referencing for current occupant)

#### `UnitType` (Enum)
-   `APARTMENT`, `HOUSE`, `CONDO`, `OFFICE_SPACE`, `RETAIL_SPACE`, `WAREHOUSE`, `OTHER`

#### `UnitOccupancyStatus` (Enum)
-   `OCCUPIED`, `VACANT`, `UNDER_MAINTENANCE`, `RESERVED`

### 2.4. Customer Management

#### `Customer`
-   `id`: `String` (`@id @default(cuid())`)
-   `organizationId`: `String` (`@relation`) - Tenant scope.
-   `propertyId`: `String?` (`@relation("PropertyCustomers")`) - Optional, for customers directly linked to a property.
-   `customerNumber`: `String` (`@unique`) - Unique per organization.
-   `type`: `CustomerType` (`@default(INDIVIDUAL)`) - Enum.
-   `firstName`, `lastName`, `fullName`, `email`, `phoneNumber`: Contact details.
-   `fullName`, `email`: (`@unique`) - Unique per organization for these fields.
-   **Constraints**: `@@unique([organizationId, customerNumber])`, `@@unique([organizationId, fullName])`, `@@unique([organizationId, email])`
-   **Relations**: `contacts`, `leases`, `invoices`, `payments`

#### `CustomerType` (Enum)
-   `INDIVIDUAL`, `COMPANY`

#### `CustomerContact`
-   `id`: `String` (`@id @default(cuid())`)
-   `customerId`: `String` (`@relation(fields: [customerId], references: [id], onDelete: Cascade)`) - Links to `Customer`.
-   `email`: `String` (`@unique`) - Unique per customer for contact email.
-   `isPrimary`: `Boolean` (`@default(false)`) - Indicates primary contact.
-   **Constraints**: `@@unique([customerId, email])`

### 2.5. Lease & Occupancy

#### `Lease`
-   `id`: `String` (`@id @default(cuid())`)
-   `organizationId`, `customerId`, `unitId`: `String` (`@relation`)
-   `leaseNumber`: `String` (`@unique`) - Unique per organization.
-   `startDate`, `endDate`, `moveInDate`, `moveOutDate`, `billingStartDate`, `billingEndDate`: `DateTime` (`@db.Date`) - Date fields.
-   `status`: `LeaseStatus` (`@default(ACTIVE)`) - Enum.
-   `depositAmount`, `recurringCharge`: `Decimal` (`@db.Decimal(19, 4)`)
-   `serviceAgreement`: `Json?`
-   **Constraints**: `@@unique([organizationId, leaseNumber])`
-   **Relations**: `invoices`, `currentUnitLease` (self-referencing back to `Unit`)

#### `LeaseStatus` (Enum)
-   `ACTIVE`, `PENDING`, `EXPIRED`, `TERMINATED`, `RENEWED`, `DRAFT`

### 2.6. Services & Tariffs

#### `Service`
-   `id`: `String` (`@id @default(cuid())`)
-   `organizationId`: `String` (`@relation`) - Tenant scope.
-   `name`: `String` (`@unique`) - Unique per organization.
-   `serviceType`: `ServiceTypeEnum` (`@default(RENT)`) - Enum.
-   `defaultPrice`: `Decimal` (`@db.Decimal(19, 4)`)
-   **Constraints**: `@@unique([organizationId, name])`
-   **Relations**: `packageItems`, `invoiceItems`, `tariffs`

#### `ServiceTypeEnum` (Enum)
-   `RENT`, `ELECTRICITY`, `WATER`, `GAS`, `HEATING`, `COOLING`, `INTERNET`, `WASTE`, `PARKING`, `MAINTENANCE`, `SERVICE_CHARGE`, `CLEANING`, `SECURITY`, `CUSTOM_SERVICE`

#### `ServicePackage`
-   `id`: `String` (`@id @default(cuid())`)
-   `organizationId`: `String` (`@relation`)
-   `name`: `String` (`@unique`) - Unique per organization.
-   **Constraints**: `@@unique([organizationId, name])`
-   **Relations**: `items`

#### `ServicePackageItem`
-   `id`: `String` (`@id @default(cuid())`)
-   `servicePackageId`, `serviceId`: `String` (`@relation`)
-   `quantity`: `Int`, `unitPrice`: `Decimal` (`@db.Decimal(19, 4)`)
-   **Constraints**: `@@unique([servicePackageId, serviceId])`

#### `Tariff`
-   `id`: `String` (`@id @default(cuid())`)
-   `organizationId`, `serviceId`: `String` (`@relation`)
-   `name`: `String` (`@unique`) - Unique per organization.
-   `isActive`: `Boolean`
-   **Constraints**: `@@unique([organizationId, name])`
-   **Relations**: `versions`, `meters`

#### `TariffVersion`
-   `id`: `String` (`@id @default(cuid())`)
-   `tariffId`: `String` (`@relation`) - Links to `Tariff`.
-   `versionNumber`: `Int`
-   `effectiveDate`, `endDate`: `DateTime` (`@db.Date`)
-   `tariffType`: `TariffTypeEnum` - Enum for tariff structure.
-   `rules`: `Json?` - Stores the actual tariff rules (e.g., tiers, rates).
-   **Constraints**: `@@unique([tariffId, versionNumber])`
-   **Relations**: `invoiceItems`

#### `TariffTypeEnum` (Enum)
-   `FLAT_RATE`, `TIERED`, `BLOCK`, `TIME_OF_USE`, `PEAK`, `OFF_PEAK`, `USAGE`, `STANDING_CHARGE`, `SEASONAL`, `CUSTOM_RATE`, `DISCOUNTED`, `PERCENTAGE`, `LATE_FEE`, `MIN_CHARGE`, `MAX_CHARGE`, `TAX`

### 2.7. Metering

#### `Meter`
-   `id`: `String` (`@id @default(cuid())`)
-   `organizationId`, `propertyId`: `String` (`@relation`)
-   `unitId`, `tariffId`: `String?` (`@relation`)
-   `serialNumber`: `String` (`@unique`) - Unique per organization.
-   `meterType`: `MeterTypeEnum` (`@default(ELECTRICITY)`) - Enum.
-   `unitOfMeasurement`: `String` (`@db.VarChar(10)`)
-   `installationDate`, `removalDate`: `DateTime` (`@db.Date`)
-   `multiplier`: `Decimal` (`@db.Decimal(10, 4)`)
-   `openingReading`, `latestReading`: `Decimal` (`@db.Decimal(19, 4)`)
-   `status`: `MeterStatusEnum` (`@default(ACTIVE)`) - Enum.
-   **Constraints**: `@@unique([organizationId, serialNumber])`
-   **Relations**: `readings`, `invoiceItems`

#### `MeterTypeEnum` (Enum)
-   `ELECTRICITY`, `WATER`, `GAS`, `HEAT`, `COOLING`, `CUSTOM`

#### `MeterStatusEnum` (Enum)
-   `ACTIVE`, `INACTIVE`, `BROKEN`, `REMOVED`

#### `MeterReading`
-   `id`: `String` (`@id @default(cuid())`)
-   `meterId`: `String` (`@relation`) - Links to `Meter`.
-   `reading`: `Decimal` (`@db.Decimal(19, 4)`)
-   `readingDate`: `DateTime` (`@db.Date`)
-   `readingType`: `ReadingTypeEnum` (`@default(MANUAL)`) - Enum.
-   `anomalyDetected`: `Boolean` (`@default(false)`)
-   **Constraints**: `@@unique([meterId, readingDate])`

#### `ReadingTypeEnum` (Enum)
-   `MANUAL`, `IMPORT`, `API`, `SMART_METER`, `ESTIMATED`, `CORRECTED`

### 2.8. Billing & Invoicing

#### `BillingCycle`
-   `id`: `String` (`@id @default(cuid())`)
-   `organizationId`: `String` (`@relation`)
-   `name`: `String` (`@unique`) - Unique per organization.
-   `frequency`: `BillingFrequency` (`@default(MONTHLY)`) - Enum.
-   `startDate`, `endDate`: `DateTime` (`@db.Date`)
-   `dueDateOffsetDays`: `Int`
-   **Constraints**: `@@unique([organizationId, name])`
-   **Relations**: `invoices`

#### `BillingFrequency` (Enum)
-   `WEEKLY`, `MONTHLY`, `QUARTERLY`, `SEMIANNUAL`, `ANNUAL`, `CUSTOM`

#### `Invoice`
-   `id`: `String` (`@id @default(cuid())`)
-   `organizationId`, `customerId`: `String` (`@relation`)
-   `billingCycleId`, `leaseId`: `String?` (`@relation`)
-   `invoiceNumber`: `String` (`@unique`) - Unique per organization.
-   `status`: `InvoiceStatus` (`@default(DRAFT)`) - Enum.
-   `invoiceDate`, `dueDate`: `DateTime` (`@db.Date`)
-   `currency`: `String` (`@db.VarChar(3)`)
-   `subtotal`, `discountAmount`, `taxAmount`, `total`, `amountPaid`, `remainingBalance`: `Decimal` (`@db.Decimal(19, 4)`)
-   `deletedAt`: `DateTime?` - For soft deletion.
-   **Constraints**: `@@unique([organizationId, invoiceNumber])`
-   **Relations**: `items`, `payments` (via `PaymentAllocation`), `creditNotes`

#### `InvoiceStatus` (Enum)
-   `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `SENT`, `VIEWED`, `PARTIALLY_PAID`, `PAID`, `OVERDUE`, `VOID`, `CANCELLED`, `REFUNDED`

#### `InvoiceItem`
-   `id`: `String` (`@id @default(cuid())`)
-   `invoiceId`, `serviceId`: `String` (`@relation`)
-   `tariffVersionId`, `meterId`: `String?` (`@relation`)
-   `quantity`, `unitPrice`, `amount`, `taxRate`, `taxAmount`: `Decimal` (`@db.Decimal(19, 4)` and `5,4` for rate).
-   `billingPeriodStart`, `billingPeriodEnd`: `DateTime?` (`@db.Date`)
-   **Relations**: `invoice`, `service`, `tariffVersion`, `meter`

#### `CreditNote`
-   `id`: `String` (`@id @default(cuid())`)
-   `organizationId`, `invoiceId`: `String` (`@relation`)
-   `creditNoteNumber`: `String` (`@unique`) - Unique per organization.
-   `creditDate`: `DateTime` (`@db.Date`)
-   `amount`: `Decimal` (`@db.Decimal(19, 4)`)
-   **Constraints**: `@@unique([organizationId, creditNoteNumber])`
-   **Relations**: `items`

#### `CreditNoteItem`
-   `id`: `String` (`@id @default(cuid())`)
-   `creditNoteId`: `String` (`@relation`)
-   `invoiceItemId`: `String?` (`@relation`)
-   `amount`: `Decimal` (`@db.Decimal(19, 4)`)

### 2.9. Payments

#### `Payment`
-   `id`: `String` (`@id @default(cuid())`)
-   `organizationId`, `customerId`: `String` (`@relation`)
-   `transactionId`: `String?` (`@unique`) - External payment provider transaction ID.
-   `amount`: `Decimal` (`@db.Decimal(19, 4)`)
-   `currency`: `String` (`@db.VarChar(3)`)
-   `paymentDate`: `DateTime` (`@db.Date`)
-   `status`: `PaymentStatus` (`@default(PENDING)`) - Enum.
-   `type`: `PaymentType` (`@default(INVOICE_PAYMENT)`) - Enum.
-   `idempotencyKey`: `String?` (`@unique`) - For preventing duplicate webhook processing.
-   `deletedAt`: `DateTime?` - For soft deletion.
-   **Constraints**: `@@unique([transactionId])`, `@@unique([idempotencyKey])`
-   **Relations**: `allocations`, `refunds`

#### `PaymentStatus` (Enum)
-   `PENDING`, `PROCESSING`, `SUCCEEDED`, `FAILED`, `CANCELLED`, `REFUNDED`, `PARTIALLY_REFUNDED`

#### `PaymentType` (Enum)
-   `INVOICE_PAYMENT`, `OVERPAYMENT`, `DEPOSIT`, `OTHER`

#### `PaymentAllocation`
-   `id`: `String` (`@id @default(cuid())`)
-   `paymentId`, `invoiceId`: `String` (`@relation`)
-   `amount`: `Decimal` (`@db.Decimal(19, 4)`)
-   **Constraints**: `@@unique([paymentId, invoiceId])`

#### `Refund`
-   `id`: `String` (`@id @default(cuid())`)
-   `paymentId`: `String` (`@relation`)
-   `refundAmount`: `Decimal` (`@db.Decimal(19, 4)`)

### 2.10. Documents & Notifications

#### `Document`
-   `id`: `String` (`@id @default(cuid())`)
-   `organizationId`: `String` (`@relation`) - Tenant scope.
-   `entityType`, `entityId`: `String` - Links document to a specific record (e.g., `Invoice`, `Property`).
-   `fileName`, `fileType`, `fileSize`: File metadata.
-   `storagePath`: `String` (`@unique`) - Path in object storage (e.g., S3).
-   `uploadedByUserId`: `String` (`@relation("UploadedDocuments")`) - Links to `User`.
-   `deletedAt`: `DateTime?` - For soft deletion.
-   **Constraints**: `@@unique([storagePath])`

#### `Notification`
-   `id`: `String` (`@id @default(cuid())`)
-   `organizationId`: `String?` (`@relation`) - Optional, for platform-wide notifications.
-   `userId`: `String` (`@relation("UserNotifications")`) - Links to `User`.
-   `type`: `NotificationType` - Enum for type of notification.
-   `readAt`: `DateTime?`
-   `metadata`: `Json?`
-   **Relations**: `organization`, `user`

#### `NotificationType` (Enum)
-   `INFO`, `WARNING`, `ERROR`, `SUCCESS`, `INVOICE_CREATED`, `INVOICE_DUE_SOON`, `INVOICE_OVERDUE`, `PAYMENT_RECEIVED`, `PAYMENT_FAILED`, `LEASE_EXPIRY`, `METER_READING_ANOMALY`, `METER_READING_MISSING`, `SUPPORT_UPDATE`, `SYSTEM_ALERT`, `FEATURE_UPDATE`

#### `NotificationPreference`
-   `id`: `String` (`@id @default(cuid())`)
-   `organizationId`: `String?` (`@relation`)
-   `userId`: `String` (`@relation("NotificationPreferences")`)
-   `channel`: `NotificationChannel` - Enum for delivery method.
-   `notificationType`: `String` - Stores `NotificationType` enum value as string for dynamic preferences.
-   `enabled`: `Boolean`
-   **Constraints**: `@@unique([userId, organizationId, channel, notificationType])`

#### `NotificationChannel` (Enum)
-   `EMAIL`, `IN_APP`, `SMS`, `WEBHOOK`

### 2.11. Audit Logging

#### `AuditLog`
-   `id`: `String` (`@id @default(cuid())`)
-   `organizationId`: `String?` (`@relation("Organization")`) - Tenant scope.
-   `actorId`: `String?` (`@relation("Actor")`) - User who performed action, links to `User`.
-   `action`: `String` (`@db.VarChar(100)`) - e.g., `invoice.create`.
-   `entityType`, `entityId`: `String` - Type and ID of affected record.
-   `metadata`: `Json?` - Stores details like old/new values, IP address, user agent.
-   **Indexes**: `@@index([organizationId, createdAt])`, `@@index([entityType, entityId])`, `@@index([actorId, createdAt])`

### 2.12. Integrations & Webhooks

#### `WebhookEndpoint`
-   `id`: `String` (`@id @default(cuid())`)
-   `organizationId`: `String` (`@relation`)
-   `url`: `String`
-   `secret`: `String` (`@db.Text`) - Encrypted secret for signing payloads.
-   `events`: `Json?` - List of subscribed event types.
-   **Constraints**: `@@unique([organizationId, url])`
-   **Relations**: `eventsHistory`

#### `WebhookEvent`
-   `id`: `String` (`@id @default(cuid())`)
-   `webhookEndpointId`: `String` (`@relation`)
-   `eventType`: `String` (`@db.VarChar(100)`)
-   `payload`: `Json`
-   `deliveryStatus`: `WebhookDeliveryStatus` (`@default(PENDING)`) - Enum.
-   `retries`: `Int`
-   **Relations**: `webhookEndpoint`

#### `WebhookDeliveryStatus` (Enum)
-   `PENDING`, `SUCCEEDED`, `FAILED`, `RETRYING`

#### `ApiKey`
-   `id`: `String` (`@id @default(cuid())`)
-   `organizationId`: `String?` (`@relation`)
-   `key`: `String` (`@unique`) - Hashed API key.
-   `name`: `String`
-   `createdByUserId`: `String` (`@relation("CreatedApiKeys")`) - Links to `User`.
-   `deletedAt`: `DateTime?` - For soft deletion.

#### `Integration`
-   `id`: `String` (`@id @default(cuid())`)
-   `organizationId`: `String` (`@relation`)
-   `type`: `IntegrationType` (`@default(STRIPE)`) - Enum for service type.
-   `name`: `String`
-   `configuration`: `Json?` - Encrypted config (e.g., API keys for external services).
-   **Constraints**: `@@unique([organizationId, type])`

#### `IntegrationType` (Enum)
-   `STRIPE`, `ADYEN`, `PAYPAL`, `RESEND`, `AWS_S3`, `OPENAI`, `ANTHROPIC`, `SLACK`, `SAP`, `SALESFORCE`, `OTHER`

### 2.13. Support Tickets

#### `SupportTicket`
-   `id`: `String` (`@id @default(cuid())`)
-   `organizationId`: `String` (`@relation`)
-   `customerId`: `String?` (`@relation`)
-   `userId`: `String` (`@relation("ReportedTickets")`) - User who opened ticket.
-   `subject`, `description`: `String`
-   `status`: `SupportTicketStatus` (`@default(OPEN)`) - Enum.
-   `priority`: `SupportTicketPriority` (`@default(MEDIUM)`) - Enum.
-   `assignedToUserId`: `String?` (`@relation("AssignedTickets")`) - User assigned to ticket.

#### `SupportTicketStatus` (Enum)
-   `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`, `PENDING_CUSTOMER`

#### `SupportTicketPriority` (Enum)
-   `LOW`, `MEDIUM`, `HIGH`, `URGENT`

---

## 3. Financial Data Precision

All monetary values (e.g., `price`, `total`, `amount`, `balance`) are defined using the `Decimal` type in Prisma, mapped to MySQL's `DECIMAL(19,4)`.

-   **`DECIMAL(19,4)`**: Allows for up to 15 digits before the decimal point and 4 digits after. This provides sufficient precision for financial calculations and prevents floating-point inaccuracies inherent in `Float` or `Double` types.

```prisma
  total          Decimal      @db.Decimal(19, 4)
  amountPaid     Decimal      @db.Decimal(19, 4)
  taxRate        Decimal      @db.Decimal(5, 4) // E.g., 0.2000 for 20%
```

---

## 4. Unique Constraints and Indexing Strategy

-   **Tenant-Scoped Uniqueness**: Most unique constraints for tenant-specific data are composite, including `organizationId`. This ensures uniqueness within an organization, not globally (e.g., two different organizations can have an `invoiceNumber` "INV-000001").
    ```prisma
    @@unique([organizationId, invoiceNumber])
    ```
-   **Indexing**: Non-unique indexes are strategically applied to frequently queried fields, especially `organizationId` and common filter/sort columns (e.g., `createdAt`, `status`, `customerId`).
    ```prisma
    @@index([organizationId, createdAt])
    @@index([organizationId, status])
    ```

---

## Related Documentation

-   [Data Model](data-model.md)
-   [Entity Relationship Diagram (ERD)](erd.md)
-   [Tenant Isolation](tenant-isolation.md)
-   [Indexing Strategy](indexing-strategy.md)
-   [Financial Precision](financial-precision.md)
-   [Database Architecture](../02-architecture/database-architecture.md)
-   [Prisma Schema (on GitHub)](../../prisma/schema.prisma)
