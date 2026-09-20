# Indexing Strategy — myTenant Invoice

## Document Status

- **Version:** 1.0.0
- **Database:** MySQL 8.0+ (InnoDB B-tree indexes; generated-column secondary indexes on JSON)
- **Query Planner Target:** EXPLAIN shows `type: ref` or better for every OLTP endpoint

## Related Documentation

- [Data Model](./data-model.md)
- [Entity-Relationship Diagram](./erd.md)
- [Schema Reference](./schema-reference.md)
- [Tenant Isolation](./tenant-isolation.md)
- [Migrations](./migrations.md)

---

## 1. Index Design Principles

### 1.1 Lead with `organizationId`

Every tenant-scoped table has at least one composite index whose **first column is `organizationId`**. This matches the application's dominant access pattern: nearly all queries filter by organization first, then by status, date, customer, etc.

MySQL composite B-tree indexes are leftmost-prefix matched. Leading with `organizationId` means:

```
@@index([organizationId, status, createdAt])

Matches:
  WHERE organizationId = ?                              → index prefix used
  WHERE organizationId = ? AND status = ?               → index prefix used
  WHERE organizationId = ? AND status = ? AND createdAt BETWEEN ? AND ?  → full index
  WHERE organizationId = ? AND createdAt BETWEEN ? AND ? → skips status; still uses first col

Does NOT match:
  WHERE status = ? AND createdAt BETWEEN ? AND ?        → cannot use this index
```

### 1.2 Prefer Composite Over Single-Column

For every `@@index([organizationId])` there is usually a better composite index that the application actually uses. Adding dozens of single-column indexes bloats storage and slows down writes without improving reads proportionally.

### 1.3 Every Index Tied to a Query

Do not index a column "just in case." Each `@@index` and `@@unique` in the Prisma schema must be traceable to at least one concrete query path. Candidate indexes are validated with `EXPLAIN ANALYZE` on a production-sized dataset before merge.

### 1.4 Uniqueness is Per-Tenant

Natural business identifiers are unique within an organization:

```prisma
@@unique([organizationId, invoiceNumber])   -- ✅ Two orgs can both have INV-000001
```

Not globally:

```prisma
@unique invoiceNumber   -- ❌ Breaks independent numbering per org
```

### 1.5 Foreign Keys Indexed

Every non-composite FK column has an index explicitly declared. Prisma may create indexes automatically for relations on MySQL; in ambiguous cases (multi-FK tables), declare the composite index you actually want to avoid unused secondary indexes.

---

## 2. Per-Table Index Map

### 2.1 Platform / Identity Tables

| Table | Index / Unique | Columns | Why |
|---|---|---|---|
| `User` | PK | `id` | Surrogate |
| | UK | `email` | Login lookup; case-insensitive uniqueness enforced by app |
| | IX | `status` | Bulk user operations |
| | IX | `(email, status)` | Credential validation |
| | IX | `(createdAt)` | Admin user listing |
| `Session` | PK | `id` | |
| | UK | `tokenHash` | Session token lookup |
| | IX | `userId` | List sessions for a user |
| | IX | `expiresAt` | Garbage collection of expired sessions |
| | IX | `(userId, expiresAt)` | "Active sessions for user" listing |
| `Role` | PK | `id` | |
| | UK | `(organizationId, normalizedName)` | Platform roles have NULL org; per-org custom role names unique |
| | IX | `scope` | Role listing filter |
| | IX | `(organizationId, scope)` | Org roles listing |
| `Permission` | PK | `id` | |
| | UK | `key` | Permission registry lookup |
| | IX | `category` | Grouping in admin UI |
| `RolePermission` | PK | `(roleId, permissionId)` | Composite PK; enforces unique grant |
| | IX | `permissionId` | Permission→roles reverse lookup |
| `SubscriptionPlan` | PK | `id` | |
| | UK | `code` | Plan code for pricing API |
| | IX | `(isPublic, sortOrder)` | Pricing page ordering |
| | IX | `interval` | Billing batch queries |
| `Organization` | PK | `id` | |
| | UK | `slug` | Subdomain/slug routing |
| | IX | `status` | Platform dashboards |
| | IX | `(status, createdAt)` | Onboarding/funnel reporting |
| | IX | `planId` | Plan subscriber counts |
| `OrganizationMember` | PK | `id` | |
| | UK | `(organizationId, userId)` | One membership per user per org |
| | IX | `userId` | All orgs for a user |
| | IX | `roleId` | Role→members reverse listing |
| | IX | `(organizationId, isOwner)` | Billing contact / owner enumeration |

### 2.2 Property Hierarchy Tables

| Table | Index / Unique | Columns | Purpose |
|---|---|---|---|
| `Portfolio` | PK | `id` | |
| | UK | `(organizationId, code)` | Portfolio code per org |
| | IX | `managerUserId` | Per-manager dashboards |
| `Property` | PK | `id` | |
| | UK | `(organizationId, propertyNumber)` | Natural identifier per org |
| | IX | `portfolioId` | List properties by portfolio |
| | IX | `(organizationId, propertyType)` | Property type filter |
| | IX | `(organizationId, status)` | Active vs archived properties |
| | IX | `managerUserId` | Manager filter |
| `Building` | PK | `id` | |
| | UK | `(propertyId, code)` | Code unique within one property |
| | IX | `organizationId` | Lead column for org queries |
| | IX | `propertyId` | Build 1:N load |
| `Unit` | PK | `id` | |
| | UK | `(propertyId, unitNumber)` | Unit number unique within property |
| | IX | `organizationId` | Lead column |
| | IX | `buildingId` | List units per building |
| | IX | `(organizationId, unitStatus)` | Vacancy/occupancy filters |
| | IX | `(buildingId, unitStatus)` | Per-building vacancy dashboards |

### 2.3 CRM and Lease Tables

| Table | Index / Unique | Columns | Purpose |
|---|---|---|---|
| `Customer` | PK | `id` | |
| | UK | `(organizationId, customerNumber)` | Customer no. per org |
| | IX | `(organizationId, customerType)` | Segment filter |
| | IX | `(organizationId, legalName)` | Sorted customer listing (order by name queries) |
| | IX | `(organizationId, balance)` | Collections dashboard (filter high balance) |
| | IX | `primaryEmail` | Lookup by email (portal invite flow) |
| `CustomerContact` | PK | `id` | |
| | IX | `organizationId` | Lead column |
| | IX | `customerId` | Per-customer contact list |
| | IX | `(customerId, isPrimary)` | Primary contact load |
| | IX | `(customerId, isBillingContact)` | Billing contact resolution |
| `Lease` | PK | `id` | |
| | UK | `(organizationId, leaseNumber)` | Lease no. per org |
| | IX | `customerId` | Customer lease history |
| | IX | `unitId` | Unit occupancy history |
| | IX | `propertyId` | Property leases |
| | IX | `(organizationId, status)` | Lease listing by status |
| | IX | `(organizationId, startDate)` | New lease reporting |
| | IX | `(organizationId, endDate)` | Expiring leases (alert job) |
| | IX | `(customerId, status)` | Customer active leases |

### 2.4 Services, Tariffs & Metering Tables

| Table | Index / Unique | Columns | Purpose |
|---|---|---|---|
| `Service` | PK | `id` | |
| | UK | `(organizationId, code)` | Service code per org |
| | IX | `(organizationId, billingType)` | Billing-type filter (fixed/metered/...) |
| | IX | `(organizationId, isActive)` | Catalog listing |
| `Tariff` | PK | `id` | |
| | UK | `(organizationId, code)` | Tariff code per org |
| | IX | `serviceId` | Tariffs per service |
| | IX | `(organizationId, tariffType)` | Tariff-type filter |
| | IX | `(organizationId, isActive)` | Catalog listing |
| `TariffVersion` | PK | `id` | |
| | UK | `(tariffId, versionNumber)` | Semantic versioning per tariff |
| | IX | `(tariffId, effectiveFrom)` | Resolve active version on a date |
| | IX | `(tariffId, effectiveFrom, effectiveTo)` | Same, with effectiveTo |
| `Meter` | PK | `id` | |
| | UK | `(organizationId, serialNumber)` | Serial no. per org |
| | IX | `propertyId` | Meter inventory per property |
| | IX | `unitId` | Meter inventory per unit |
| | IX | `leaseId` | Meters on a lease |
| | IX | `tariffId` | Tariff→meter lookup |
| | IX | `(organizationId, meterType)` | By utility type |
| | IX | `(organizationId, status)` | Active vs removed meters |
| | IX | `(organizationId, latestReadingAt)` | Meters due for reading |
| `MeterReading` | PK | `id` | |
| | UK | `(meterId, readingDate, readingValue)` | Import dedup |
| | IX | `organizationId` | Lead column |
| | IX | `meterId` | List readings per meter |
| | IX | `(meterId, readingDate)` | Date-range per meter (primary billing lookup) |
| | IX | `(meterId, readingValue)` | Delta anomaly scan |
| | IX | `(organizationId, source)` | Import batches |
| | IX | `recordedBy` | Who entered readings |
| | IX | `importedBatchId` | Batch processing |

### 2.5 Financial Tables

| Table | Index / Unique | Columns | Purpose |
|---|---|---|---|
| `BillingCycle` | PK | `id` | |
| | IX | `organizationId` | Lead |
| | IX | `(organizationId, cycleStart, cycleEnd)` | Date-range reporting |
| | IX | `(organizationId, status)` | Open/closed cycle filter |
| | IX | `frequency` | Batch runner filter |
| `Invoice` | PK | `id` | |
| | UK | `(organizationId, invoiceNumber)` | Invoice no. per org |
| | UK | `(organizationId, idempotencyKey)` | Duplicate-create guard |
| | IX | `customerId` | Customer invoice history |
| | IX | `leaseId` | Per-lease history |
| | IX | `billingCycleId` | Invoices in a run |
| | IX | `(organizationId, status)` | DRAFT/PAID/OVERDUE tabs |
| | IX | `(organizationId, invoiceDate)` | Date-range report |
| | IX | `(organizationId, dueDate)` | Overdue job scans |
| | IX | `(customerId, status)` | Customer's unpaid invoices |
| | IX | `(organizationId, periodStart, periodEnd)` | Period-based reports |
| | IX | `(organizationId, balance)` | Collections dashboard sort |
| | IX | `(organizationId, total)` | Revenue thresholds |
| | IX | `recurringGroupId` | Recurring invoice chain lookup |
| `InvoiceItem` | PK | `id` | |
| | UK | `(invoiceId, lineNumber)` | Per-line uniqueness |
| | IX | `organizationId` | Lead |
| | IX | `invoiceId` | Load lines per invoice |
| | IX | `serviceId` | Revenue by service |
| | IX | `tariffVersionId` | Tariff usage analytics |
| | IX | `meterId` | Meter line-items |
| | IX | `meterReadingId` | Back-reference from reading to billable line |
| `CreditNote` | PK | `id` | |
| | UK | `(organizationId, creditNoteNumber)` | |
| | UK | `(organizationId, idempotencyKey)` | |
| | IX | `customerId` | Customer credit history |
| | IX | `invoiceId` | Credits applied to an invoice |
| | IX | `(organizationId, status)` | Filter |
| | IX | `(organizationId, creditNoteDate)` | Reporting |
| | IX | `(customerId, status)` | Open credits for a customer |
| `CreditNoteItem` | PK | `id` | |
| | UK | `(creditNoteId, lineNumber)` | |
| | IX | `organizationId` | Lead |
| | IX | `creditNoteId` | Line listing |
| `Payment` | PK | `id` | |
| | UK | `(organizationId, paymentNumber)` | |
| | UK | `(provider, providerPaymentId)` | Payment-provider dedup (global) |
| | UK | `(organizationId, idempotencyKey)` | App-level dedup |
| | IX | `customerId` | Customer payments |
| | IX | `(organizationId, status)` | Payment status tabs |
| | IX | `(organizationId, transactionDate)` | Date-range reports |
| | IX | `(organizationId, paymentMethod)` | Reconciliation by method |
| | IX | `(customerId, status)` | Customer recent payments |
| | IX | `providerEventId` | Webhook-event→payment lookup |
| | IX | `(organizationId, unallocatedAmount)` | Credits on account; unallocated > 0 |
| `PaymentAllocation` | PK | `id` | |
| | UK | `(paymentId, invoiceId)` | Never double-allocate a payment to an invoice |
| | IX | `organizationId` | Lead |
| | IX | `paymentId` | Allocations for a payment |
| | IX | `invoiceId` | Allocations against an invoice (for balance calc) |
| `Refund` | PK | `id` | |
| | UK | `(organizationId, refundNumber)` | |
| | UK | `(organizationId, idempotencyKey)` | |
| | IX | `customerId` | Customer refunds |
| | IX | `paymentId` | Refunds per payment |
| | IX | `invoiceId` | Refunds per invoice |
| | IX | `(organizationId, status)` | Filter |
| | IX | `(organizationId, createdAt)` | Reports |

### 2.6 Operational Tables

| Table | Index / Unique | Columns | Purpose |
|---|---|---|---|
| `Notification` | PK | `id` | |
| | IX | `organizationId` | Lead |
| | IX | `recipientUserId` | User notification list |
| | IX | `(organizationId, channel)` | Channel-specific audits |
| | IX | `(organizationId, status)` | Retry jobs scan `PENDING + retry < N` |
| | IX | `(organizationId, eventType)` | Event-type queries |
| | IX | `(organizationId, createdAt)` | Historical listing |
| | IX | `(recipientUserId, status)` | "Unread for user" counter |
| | IX | `(status, nextRetryAt)` | Retry worker poll (global across orgs) |
| | IX | `invoiceId` | Back-reference |
| | IX | `paymentId` | Back-reference |
| `Document` | PK | `id` | |
| | IX | `organizationId` | Lead |
| | IX | `(organizationId, documentType)` | Filter by PDF/photo/etc. |
| | IX | `(organizationId, createdAt)` | Listing |
| | IX | `invoiceId` | Inline invoice docs |
| | IX | `paymentId` | Inline payment docs |
| | IX | `customerId` | Customer file listing |
| | IX | `leaseId` | Lease agreements |
| | IX | `propertyId` | Property photos |
| | IX | `(storageBucket, storageKey)` | Object storage reference |
| `AuditLog` | PK | `id` | Append-only; no FKs with cascade |
| | IX | `(organizationId, createdAt)` | Per-org audit listing |
| | IX | `(actorId, createdAt)` | Per-actor history |
| | IX | `(entityType, entityId)` | "Show all changes to object X" |
| | IX | `(action, createdAt)` | Global action timeline |
| | IX | `(severity, createdAt)` | Severity filter |
| | IX | `(organizationId, action, createdAt)` | Org-scoped action timeline |
| `WebhookEndpoint` | PK | `id` | |
| | UK | `(organizationId, url)` | One endpoint per unique URL per org |
| | IX | `(organizationId, status)` | Active endpoints |
| | IX | `(status, consecutiveFailures)` | Auto-disable dead endpoints worker |
| `WebhookEvent` | PK | `id` | |
| | UK | `eventId` | Idempotent delivery |
| | IX | `webhookEndpointId` | History per endpoint |
| | IX | `organizationId` | Lead |
| | IX | `(status, nextRetryAt)` | Retry worker poll (global) |
| | IX | `(eventType, createdAt)` | Event type dashboards |
| | IX | `(webhookEndpointId, status)` | Delivery stats per endpoint |
| `ApiKey` | PK | `id` | |
| | UK | `keyHash` | Key hash unique |
| | IX | `(organizationId, status)` | Active keys per org |
| | IX | `userId` | Per-user API keys |
| | IX | `keyPrefix` | Client-side prefix lookup during key validation |
| | IX | `lastUsedAt` | Unused-key pruning job |
| `Integration` | PK | `id` | |
| | UK | `(organizationId, provider, instanceLabel)` | One-or-more per provider per org |
| | IX | `(organizationId, status)` | Connections listing |
| | IX | `(provider, status)` | Provider dashboards |
| | IX | `lastSyncAt` | Resync scheduling |
| `SupportTicket` | PK | `id` | |
| | UK | `(organizationId, ticketNumber)` | |
| | IX | `customerId` | Tickets per customer |
| | IX | `authorId` | Opened by |
| | IX | `assigneeId` | Assignee queue |
| | IX | `(organizationId, status)` | Status queues |
| | IX | `(organizationId, priority)` | Triage by priority |
| | IX | `(organizationId, createdAt)` | Listing |
| | IX | `(status, slaResolveBy)` | SLA breach detection |
| `SupportTicketMessage` | PK | `id` | |
| | IX | `ticketId` | Conversation load |
| | IX | `authorId` | Per-author history |
| | IX | `(ticketId, isInternal)` | Internal vs customer-visible load |
| | IX | `(ticketId, createdAt)` | Chronological conversation load |

---

## 3. The `organizationId`-Lead Rule in MySQL

Because every scoped query matches on `organizationId = ?`, placing it first means that the optimizer can resolve the tenant predicate with a single range scan that narrows the working set by > 99.9%.

Example EXPLAIN target for an overdue query:

```
Query:
SELECT * FROM Invoice
WHERE organizationId = ?
  AND status IN ('PARTIALLY_PAID', 'OVERDUE')
  AND dueDate <= NOW()
ORDER BY dueDate ASC;

EXPLAIN:
select_type: SIMPLE
table: Invoice
type: range
possible_keys: Invoice_organizationId_status_idx, Invoice_organizationId_dueDate_idx
key: Invoice_organizationId_status_idx
key_len: 32+2   (≈ CUID 32 bytes + ENUM size)
ref: const,const
rows: 128
Extra: Using where; Using filesort (fallback)
```

If filesort is frequent in production, consider promoting the status+due-date variant:

```
@@index([organizationId, status, dueDate])
```

This turns the same query into a no-sort range scan when `IN()` contains a single value.

---

## 4. Primary Key Strategy

All tables use:

```prisma
id String @id @default(cuid())
```

In InnoDB, the primary key is the clustered index. CUIDs are monotonically increasing on their leading bytes, which preserves insertion locality and avoids the page-splits characteristic of random UUIDs (UUID v4). No secondary index table ever needs both `organizationId` + the PK in the lead, because the PK is already globally unique and queries either look up by PK (already indexed) or by org-scoped predicates.

---

## 5. Full-Text and Search

Tenant-scoped keyword search uses MySQL `FULLTEXT` indexes for entities where natural-language search is expected (customer name, invoice notes, ticket description).

```sql
-- Applied via raw-SQL migration (Prisma does not natively emit FULLTEXT in 5.x)
ALTER TABLE Customer
  ADD FULLTEXT INDEX Customer_org_legalName_ft
    (organizationId, legalName, billingStreet, billingCity, billingRegion);

ALTER TABLE Invoice
  ADD FULLTEXT INDEX Invoice_org_notes_ft
    (organizationId, customerNotes, termsAndConditions, footerNotes, reference, purchaseOrderRef);

ALTER TABLE SupportTicket
  ADD FULLTEXT INDEX Ticket_org_subject_desc_ft
    (organizationId, subject, description);
```

Always lead the `MATCH ... AGAINST` predicate with `organizationId = ?` to enforce tenant isolation at the query layer before the full-text evaluator runs.

If/when MySQL full-text search is insufficient, switch to an external search engine (OpenSearch/Typesense) that is itself tenant-tagged.

---

## 6. JSON Columns and Generated-Column Indexes

When a JSON field must be queried frequently, promote it to a stored generated column and index that:

```sql
-- Example: indexing the external provider event id inside AuditLog.metadata
ALTER TABLE AuditLog
  ADD COLUMN provider_event_id VARCHAR(255)
    GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.providerEventId')))
    STORED NULL,
  ADD INDEX AuditLog_providerEventId_idx (provider_event_id);
```

Prisma ignores generated columns in schema validation; declare them as regular migrations using raw SQL and add a comment in `schema.prisma` near the JSON field.

---

## 7. Index Maintenance

### 7.1 Cardinality Recheck

Before a GA release and quarterly after:

```sql
ANALYZE TABLE Invoice;
ANALYZE TABLE AuditLog;
ANALYZE TABLE MeterReading;
ANALYZE TABLE Notification;
ANALYZE TABLE WebhookEvent;
```

This refreshes InnoDB statistics for the query planner so composite index selection is accurate.

### 7.2 Unused Indexes

Monthly, identify unused indexes via `sys.schema_unused_indexes`. Any index with 0 hits after 90 days is removed in a cleanup migration, except:
- All `@@unique` constraints.
- Indexes used exclusively by quarterly/yearly reporting jobs.

### 7.3 Fragmentation

For tables over 10M rows (`AuditLog`, `MeterReading`, `Notification`), check fragmentation quarterly:

```sql
SELECT ENGINE, TABLE_NAME, ROUND(DATA_FREE/1024/1024, 2) AS data_free_mb
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY DATA_FREE DESC
LIMIT 10;
```

When DATA_FREE exceeds 30% of the table size, run `OPTIMIZE TABLE ...` or an online rebuild during a maintenance window. With row compression (InnoDB COMPRESSED) on, tables with large `Text` and `Json` columns fragment faster.

---

## 8. Adding a New Index — Checklist

Before adding an index to `schema.prisma`, a PR author must confirm:

1. ✅ A concrete endpoint or background job query requires it.
2. ✅ `EXPLAIN` on production-like data shows a full table scan or `Using filesort` without the index.
3. ✅ `EXPLAIN` with the new index shows an improvement (`type` is `ref` / `range` / `eq_ref`).
4. ✅ The leading columns match the query predicate's `WHERE` order.
5. ✅ The index does not duplicate an existing leftmost prefix.
6. ✅ For writes: the table's write volume does not make the index too costly (benchmark on a copy).
7. ✅ Migration uses `ALGORITHM=INPLACE, LOCK=NONE` for large tables.
8. ✅ Added to this document's per-table index map in §2.

If any item is "N/A with explanation," the PR reviewer decides.
