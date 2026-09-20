# Entity Relationship Diagram (ERD)

This document presents the Entity Relationship Diagram (ERD) for **myTenant Invoice**, visualizing the core database entities and their relationships. This diagram is generated using Mermaid syntax and reflects the `prisma/schema.prisma` structure.

---

## 1. Overview

The ERD highlights the key entities and how they relate, with a strong emphasis on the `Organization` as the central hub for all tenant-scoped data. Foreign keys (`FK`) and primary keys (`PK`) are explicitly marked, and relationship cardinalities are shown.

---

## 2. Core ERD

```mermaid
ERD
    USER {
        string id PK
        string email
        string passwordHash
        DateTime createdAt
        DateTime updatedAt
    }

    ACCOUNT {
        string id PK
        string userId FK
        string type
        string provider
        string providerAccountId
        DateTime createdAt
        DateTime updatedAt
    }

    SESSION {
        string id PK
        string sessionToken
        string userId FK
        DateTime expires
    }

    ORGANIZATION {
        string id PK "Unique identifier for the tenant organization"
        string name
        string slug UK
        OrganizationStatus status
        string currency
        string locale
        string timezone
        string invoicePrefix
        int nextInvoiceNumber
        DateTime createdAt
        DateTime updatedAt
    }

    ORGANIZATION_MEMBER {
        string id PK
        string organizationId FK
        string userId FK
        string roleId FK
        DateTime createdAt
        DateTime updatedAt
    }

    ROLE {
        string id PK
        string name UK
        boolean isPlatformRole
    }

    PERMISSION {
        string id PK
        string name UK
    }

    ROLE_PERMISSION {
        string id PK
        string roleId FK
        string permissionId FK
    }

    SUBSCRIPTION_PLAN {
        string id PK
        string name UK
        decimal price
        string currency
        SubscriptionInterval interval
        json features
    }

    ORGANIZATION_SUBSCRIPTION {
        string id PK
        string organizationId FK UK "One subscription per organization"
        string planId FK
        SubscriptionStatus status
        DateTime currentPeriodStart
        DateTime currentPeriodEnd
        DateTime createdAt
        DateTime updatedAt
    }

    PORTFOLIO {
        string id PK
        string organizationId FK
        string name "@@unique([organizationId, name])"
        DateTime createdAt
        DateTime updatedAt
    }

    PROPERTY {
        string id PK
        string organizationId FK
        string portfolioId FK
        string name "@@unique([organizationId, name])"
        string address
        PropertyType propertyType
        int unitCount
        decimal occupancyRate
        DateTime createdAt
        DateTime updatedAt
    }

    BUILDING {
        string id PK
        string organizationId FK
        string propertyId FK
        string name "@@unique([organizationId, propertyId, name])"
        DateTime createdAt
        DateTime updatedAt
    }

    UNIT {
        string id PK
        string organizationId FK
        string propertyId FK
        string buildingId FK
        string unitNumber "@@unique([organizationId, propertyId, unitNumber])"
        UnitType unitType
        UnitOccupancyStatus occupancyStatus
        string currentLeaseId FK
        DateTime createdAt
        DateTime updatedAt
    }

    CUSTOMER {
        string id PK
        string organizationId FK
        string propertyId FK
        string customerNumber UK "@@unique([organizationId, customerNumber])"
        CustomerType type
        string firstName
        string lastName
        string fullName UK "@@unique([organizationId, fullName])"
        string email UK "@@unique([organizationId, email])"
        DateTime createdAt
        DateTime updatedAt
    }

    CUSTOMER_CONTACT {
        string id PK
        string customerId FK
        string email UK "@@unique([customerId, email])"
        string firstName
        string lastName
        DateTime createdAt
        DateTime updatedAt
    }

    LEASE {
        string id PK
        string organizationId FK
        string customerId FK
        string unitId FK
        string leaseNumber UK "@@unique([organizationId, leaseNumber])"
        Date startDate
        Date endDate
        LeaseStatus status
        decimal depositAmount
        decimal recurringCharge
        DateTime createdAt
        DateTime updatedAt
    }

    SERVICE {
        string id PK
        string organizationId FK
        string name UK "@@unique([organizationId, name])"
        ServiceTypeEnum serviceType
        boolean isBillable
        decimal defaultPrice
        DateTime createdAt
        DateTime updatedAt
    }

    SERVICE_PACKAGE {
        string id PK
        string organizationId FK
        string name UK "@@unique([organizationId, name])"
        DateTime createdAt
        DateTime updatedAt
    }

    SERVICE_PACKAGE_ITEM {
        string id PK
        string servicePackageId FK
        string serviceId FK
        int quantity
        decimal unitPrice
    }

    TARIFF {
        string id PK
        string organizationId FK
        string serviceId FK
        string name UK "@@unique([organizationId, name])"
        boolean isActive
        DateTime createdAt
        DateTime updatedAt
    }

    TARIFF_VERSION {
        string id PK
        string tariffId FK
        int versionNumber UK "@@unique([tariffId, versionNumber])"
        Date effectiveDate
        Date endDate
        TariffTypeEnum tariffType
        json rules
        DateTime createdAt
        DateTime updatedAt
    }

    METER {
        string id PK
        string organizationId FK
        string propertyId FK
        string unitId FK
        string tariffId FK
        string serialNumber UK "@@unique([organizationId, serialNumber])"
        MeterTypeEnum meterType
        string unitOfMeasurement
        Date installationDate
        decimal multiplier
        decimal openingReading
        decimal latestReading
        MeterStatusEnum status
        DateTime createdAt
        DateTime updatedAt
    }

    METER_READING {
        string id PK
        string meterId FK
        decimal reading
        Date readingDate UK "@@unique([meterId, readingDate])"
        ReadingTypeEnum readingType
        boolean anomalyDetected
        DateTime createdAt
        DateTime updatedAt
    }

    BILLING_CYCLE {
        string id PK
        string organizationId FK
        string name UK "@@unique([organizationId, name])"
        BillingFrequency frequency
        Date startDate
        Date endDate
        int dueDateOffsetDays
        boolean isDefault
        DateTime createdAt
        DateTime updatedAt
    }

    INVOICE {
        string id PK
        string organizationId FK
        string customerId FK
        string billingCycleId FK
        string leaseId FK
        string invoiceNumber UK "@@unique([organizationId, invoiceNumber])"
        InvoiceStatus status
        Date invoiceDate
        Date dueDate
        string currency
        decimal subtotal
        decimal discountAmount
        decimal taxAmount
        decimal total
        decimal amountPaid
        decimal remainingBalance
        DateTime createdAt
        DateTime updatedAt
        DateTime deletedAt
    }

    INVOICE_ITEM {
        string id PK
        string invoiceId FK
        string serviceId FK
        string tariffVersionId FK
        string meterId FK
        decimal quantity
        decimal unitPrice
        decimal amount
        decimal taxRate
        decimal taxAmount
        DateTime createdAt
        DateTime updatedAt
    }

    CREDIT_NOTE {
        string id PK
        string organizationId FK
        string invoiceId FK
        string creditNoteNumber UK "@@unique([organizationId, creditNoteNumber])"
        Date creditDate
        decimal amount
        DateTime createdAt
        DateTime updatedAt
    }

    CREDIT_NOTE_ITEM {
        string id PK
        string creditNoteId FK
        string invoiceItemId FK
        decimal amount
    }

    PAYMENT {
        string id PK
        string organizationId FK
        string customerId FK
        string transactionId UK "Optional external transaction ID"
        string paymentMethod
        decimal amount
        string currency
        Date paymentDate
        PaymentStatus status
        PaymentType type
        string idempotencyKey UK "@@unique([idempotencyKey])"
        DateTime createdAt
        DateTime updatedAt
        DateTime deletedAt
    }

    PAYMENT_ALLOCATION {
        string id PK
        string paymentId FK
        string invoiceId FK
        decimal amount
    }

    REFUND {
        string id PK
        string paymentId FK
        decimal refundAmount
        DateTime refundDate
    }

    DOCUMENT {
        string id PK
        string organizationId FK
        string entityType
        string entityId
        string fileName
        string fileType
        int fileSize
        string storagePath UK
        string uploadedByUserId FK
        DateTime createdAt
        DateTime updatedAt
        DateTime deletedAt
    }

    NOTIFICATION {
        string id PK
        string organizationId FK
        string userId FK
        NotificationType type
        string title
        string message
        DateTime readAt
        DateTime createdAt
        DateTime updatedAt
    }

    NOTIFICATION_PREFERENCE {
        string id PK
        string organizationId FK
        string userId FK
        NotificationChannel channel
        string notificationType
        boolean enabled
    }

    AUDIT_LOG {
        string id PK
        string organizationId FK
        string actorId FK
        string action
        string entityType
        string entityId
        json metadata
        string ipAddress
        string userAgent
        DateTime createdAt
    }

    WEBHOOK_ENDPOINT {
        string id PK
        string organizationId FK
        string url
        string secret
        boolean isEnabled
        json events
        DateTime createdAt
        DateTime updatedAt
    }

    WEBHOOK_EVENT {
        string id PK
        string webhookEndpointId FK
        string eventType
        json payload
        WebhookDeliveryStatus deliveryStatus
        int statusCode
        int retries
        DateTime createdAt
        DateTime updatedAt
    }

    API_KEY {
        string id PK
        string organizationId FK
        string key UK
        string name
        DateTime expiresAt
        string createdByUserId FK
        DateTime createdAt
        DateTime updatedAt
        DateTime deletedAt
    }

    INTEGRATION {
        string id PK
        string organizationId FK
        IntegrationType type UK "@@unique([organizationId, type])"
        string name
        json configuration
        boolean isEnabled
        DateTime createdAt
        DateTime updatedAt
    }

    SUPPORT_TICKET {
        string id PK
        string organizationId FK
        string customerId FK
        string userId FK
        string subject
        SupportTicketStatus status
        SupportTicketPriority priority
        string assignedToUserId FK
        DateTime createdAt
        DateTime updatedAt
        DateTime closedAt
    }

    // Relationships
    USER ||--o{ ACCOUNT : has
    USER ||--o{ SESSION : has
    USER ||--o{ ORGANIZATION_MEMBER : has
    USER ||--o{ AUDIT_LOG : performed
    USER ||--o{ DOCUMENT : uploaded
    USER ||--o{ NOTIFICATION : receives
    USER ||--o{ NOTIFICATION_PREFERENCE : configures
    USER ||--o{ API_KEY : created
    USER ||--o{ SUPPORT_TICKET : reported_by
    USER ||--o{ SUPPORT_TICKET : assigned_to

    ORGANIZATION ||--o{ ORGANIZATION_MEMBER : includes
    ORGANIZATION ||--o{ PROPERTY : owns
    ORGANIZATION ||--o{ CUSTOMER : serves
    ORGANIZATION ||--o{ LEASE : manages
    ORGANIZATION ||--o{ SERVICE : defines
    ORGANIZATION ||--o{ TARIFF : manages
    ORGANIZATION ||--o{ METER : manages
    ORGANIZATION ||--o{ INVOICE : generates
    ORGANIZATION ||--o{ PAYMENT : processes
    ORGANIZATION ||--o{ CREDIT_NOTE : issues
    ORGANIZATION ||--o{ ORGANIZATION_SUBSCRIPTION : subscribes_to
    ORGANIZATION ||--o{ NOTIFICATION : sends
    ORGANIZATION ||--o{ DOCUMENT : owns
    ORGANIZATION ||--o{ AUDIT_LOG : has
    ORGANIZATION ||--o{ WEBHOOK_ENDPOINT : configured_by
    ORGANIZATION ||--o{ API_KEY : belongs_to
    ORGANIZATION ||--o{ INTEGRATION : manages
    ORGANIZATION ||--o{ SUPPORT_TICKET : has
    ORGANIZATION ||--o{ BILLING_CYCLE : defines

    ROLE ||--o{ ORGANIZATION_MEMBER : assigned_to
    ROLE ||--o{ ROLE_PERMISSION : includes
    PERMISSION ||--o{ ROLE_PERMISSION : part_of

    SUBSCRIPTION_PLAN ||--o{ ORGANIZATION_SUBSCRIPTION : chosen
    
    ORGANIZATION_SUBSCRIPTION ||--|| ORGANIZATION : for
    ORGANIZATION_SUBSCRIPTION ||--|| SUBSCRIPTION_PLAN : uses

    PORTFOLIO ||--o{ PROPERTY : groups

    PROPERTY ||--o{ BUILDING : has
    PROPERTY ||--o{ UNIT : has
    PROPERTY ||--o{ LEASE : associated_with
    PROPERTY ||--o{ METER : has
    PROPERTY ||--o{ CUSTOMER : serves

    BUILDING ||--o{ UNIT : contains

    UNIT ||--o{ LEASE : occupied_by
    UNIT ||--o| METER : has

    CUSTOMER ||--o{ CUSTOMER_CONTACT : has
    CUSTOMER ||--o{ LEASE : signed_by
    CUSTOMER ||--o{ INVOICE : billed_to
    CUSTOMER ||--o{ PAYMENT : made_by
    CUSTOMER ||--o{ SUPPORT_TICKET : opens

    LEASE ||--o{ INVOICE : generates
    LEASE ||--|{ UNIT : current_lease (via currentLeaseId)

    SERVICE ||--o{ SERVICE_PACKAGE_ITEM : part_of
    SERVICE ||--o{ TARIFF : has
    SERVICE ||--o{ INVOICE_ITEM : billed_as

    SERVICE_PACKAGE ||--o{ SERVICE_PACKAGE_ITEM : contains

    TARIFF ||--o{ TARIFF_VERSION : has
    TARIFF ||--o{ METER : uses

    TARIFF_VERSION ||--o{ INVOICE_ITEM : applied_to

    METER ||--o{ METER_READING : records
    METER ||--o{ INVOICE_ITEM : includes_usage

    BILLING_CYCLE ||--o{ INVOICE : defined_by

    INVOICE ||--o{ INVOICE_ITEM : comprises
    INVOICE ||--o{ PAYMENT_ALLOCATION : settled_by
    INVOICE ||--o{ CREDIT_NOTE : credited_by

    PAYMENT ||--o{ PAYMENT_ALLOCATION : allocates
    PAYMENT ||--o{ REFUND : has

    WEBHOOK_ENDPOINT ||--o{ WEBHOOK_EVENT : triggers

    CREDIT_NOTE ||--o{ CREDIT_NOTE_ITEM : comprises

    // Self-referencing relations
    UNIT }o--o{ LEASE : "CurrentUnitLease" 
```

---

## 3. Key Relationships and Multi-Tenancy

-   **`Organization` as Root**: The `Organization` entity is central. Almost all other domain entities (Property, Customer, Invoice, Payment, Meter, etc.) have a direct `organizationId` foreign key, ensuring strict data partitioning.
-   **User-Organization-Role**: A `User` can belong to multiple `Organizations` through `OrganizationMember`, each with a specific `Role`, enabling flexible access control for consultants, accountants, or platform staff.
-   **Versioned Tariffs**: `TariffVersion` ensures that historical invoices can always be accurately reproduced, even if tariff rules change over time.
-   **Financial Transactions**: `Invoice`, `Payment`, `CreditNote` are designed with explicit relationships and `Decimal` types for financial accuracy and auditability.
-   **Soft Deletion**: For critical historical data (e.g., `Invoice`, `Payment`, `Document`), a `deletedAt` timestamp is used instead of hard deletion to preserve historical records.

---

## Related Documentation

-   [Data Model](data-model.md)
-   [Schema Reference](schema-reference.md)
-   [Tenant Isolation](tenant-isolation.md)
-   [Financial Precision](financial-precision.md)
-   [Database Architecture](../02-architecture/database-architecture.md)
-   [Prisma Schema (on GitHub)](../../prisma/schema.prisma)
