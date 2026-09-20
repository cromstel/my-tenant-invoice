# Database Architecture — MySQL 8 with Prisma ORM

**Document ID:** ARCH-005
**Status:** Approved
**Version:** 1.0.0
**Last Updated:** 2026-09-20
**Author:** CromStel IT Group — Platform Architecture Team

---

## 1. Overview

myTenant Invoice persists all transactional data in **MySQL 8.0 (InnoDB)** using **Prisma ORM 5** as the data access layer. The database is the system of record for all tenants. This document defines the logical and physical schema, indexing strategy, backup/RPO, migration deployment process, and operational runbooks for day-2 database operations.

Why MySQL 8 over PostgreSQL is documented in ADR-002.

---

## 2. Deployment Topology & Connectivity

```mermaid
flowchart LR
    subgraph VPC["VPC (Private Subnet)"]
        direction TB
        App["Next.js App Workers<br/>(Prisma Connection Pool)
        Worker["Async Workers"]

        subgraph MySQL["MySQL 8 (Aurora Compatible)")
            Primary[("Primary Writer<br/>db.r6g.2xlarge<br/>Single writer<br/>Accepts all writes and strong reads")
            Reader1[("Reader-1<br/>db.r6g.xlarge<br/>Report queries<br/>tenant list + details")
            Reader2[("Reader-2<br/>db.r6g.xlarge<br/>Worker read path<br/>+ batch jobs")
        end

        Primary -->|async semi-sync binlog| Reader1
        Primary -->|async semi-sync binlog| Reader2
    end

    App -->|read/write split| Primary
    App -->|reporting read| Reader1
    Worker -->|reads| Reader2
    Worker -->|writes| Primary
```

### 2.1 Connection Pool Configuration (Prisma)

| Setting | Value | Rationale |
|---|---|---|
| **Connection limit (app) | `connection_limit=12` per instance (default is default formula `_numCPU * 2 + 1`). 10 workers × 12 = 120 max. |
| **Pool timeout** | `pool_timeout=10s` — long enough queued queries. |
| **Statement timeout** | `statement_timeout=30s` hard per-query limit, kills runaway reports. |
| **Connection lifetime** | 300s max lifetime to drop stale connections. |
| **SSL/TLS** | Required (`sslaccept=strict`) in all envs including `?ssl={"rejectUnauthorized":true}`. |
| **Pgbouncer** | Not used for v1 — Prisma pooling + short-lived workers sufficient. |

### 2.2 Replica Read Routing
- All `findMany`, `aggregate`, `groupBy` queries for list-views → Reader-1 (via Prisma `$extends`)
- All reporting workers, report exports and invoice jobs → Reader-2
- All mutations (`findUnique` for write path → Primary

---

## 3. Schema Overview — ER Diagram

```mermaid
erDiagram
    TENANT ||--o{ USER_MEMBERSHIP : "has members"
    USER ||--o{ USER_MEMBERSHIP : "belongs to"
    TENANT ||--o{ PLAN_ASSIGNMENT : "on plan"
    PLAN ||--o{ PLAN_ASSIGNMENT : "assigned to"
    TENANT ||--o{ PROPERTY : "owns"
    PROPERTY ||--o{ BUILDING : "has"
    BUILDING ||--o{ UNIT : "contains"
    TENANT_USER ||--o{ LEASE : "signs"
    UNIT ||--o{ LEASE : "leased via"
    TENANT_USER ||--|| USER : "linked to"
    LEASE ||--o{ CHARGE_TEMPLATE : "generates"
    CHARGE_TEMPLATE ||--o{ INVOICE_LINE : "expands to"
    INVOICE ||--o{ INVOICE_LINE : "contains"
    TENANT ||--o{ INVOICE : "bills"
    INVOICE ||--o{ PAYMENT : "paid by"
    PAYMENT }o--|| PAYMENT_METHOD : "via"
    TENANT_USER ||--o{ PAYMENT_METHOD : "stores"
    INVOICE ||--o{ INVOICE_PDF : "rendered to"
    TENANT ||--o{ OUTBOX : "events for"
    TENANT ||--o{ COMMUNICATION : "emails/SMS"

    TENANT {
        char(36) id PK "UUID v7"
        varchar(255) name
        varchar(32) status "ACTIVE|SUSPENDED|..."
        varchar(3) currency_default
        varchar(36) owner_user_id FK
        json config "encrypted overrides"
        datetime created_at
        datetime updated_at
        datetime deleted_at "soft-delete"
    }

    USER {
        char(36) id PK
        varchar(255) email
        varchar(255) password_hash
        varchar(255) name
        datetime email_verified_at
        datetime created_at
        datetime updated_at
    }

    USER_MEMBERSHIP {
        char(36) id PK
        char(36) tenant_id FK
        char(36) user_id FK
        varchar(32) role "ORG_ADMIN|STAFF|ACCOUNTANT|TENANT_USER"
        datetime expires_at
        datetime created_at
        UNIQUE(tenant_id, user_id)
    }

    PLAN {
        char(36) id PK "platform-owned"
        varchar(64) key "FREE|BASIC|PRO|ENTERPRISE"
        varchar(255) name
        int max_properties
        int max_units
        decimal storage_gb
        int emails_per_month
        json features
    }

    PLAN_ASSIGNMENT {
        char(36) id PK
        char(36) tenant_id FK UK
        char(36) plan_id FK
        date effective_from
        date effective_to
        json overrides
    }

    PROPERTY {
        char(36) id PK
        char(36) tenant_id FK "UK with id, first in idx"
        varchar(255) name
        json address
        datetime created_at
        datetime updated_at
        datetime deleted_at
    }

    BUILDING {
        char(36) id PK
        char(36) tenant_id FK
        char(36) property_id FK
        varchar(64) name
    }

    UNIT {
        char(36) id PK
        char(36) tenant_id FK
        char(36) building_id FK
        varchar(64) unit_number
        int bedrooms
        decimal rent
        decimal sqft
    }

    TENANT_USER {
        char(36) id PK
        char(36) tenant_id FK
        char(36) user_id FK
        varchar(255) full_name
        varchar(64) phone
    }

    LEASE {
        char(36) id PK
        char(36) tenant_id FK
        char(36) unit_id FK
        char(36) tenant_user_id FK
        date start_date
        date end_date
        decimal monthly_rent
        decimal security_deposit
        varchar(32) status
    }

    CHARGE_TEMPLATE {
        char(36) id PK
        char(36) tenant_id FK
        char(36) lease_id FK
        varchar(64) type "RENT|UTILITY|FEE|DEPOSIT"
        varchar(255) description
        decimal amount
        varchar(16) cadence "MONTHLY|QUARTERLY|ANNUAL|ONE_TIME"
        date effective_from
        date effective_to
    }

    INVOICE {
        char(36) id PK
        char(36) tenant_id FK
        char(36) lease_id FK
        char(36) tenant_user_id FK
        varchar(32) invoice_number "T-000001 unique per tenant"
        date issue_date
        date due_date
        decimal subtotal
        decimal tax_total
        decimal total
        decimal paid_amount
        varchar(32) status "DRAFT|FINALIZED|PAID|OVERDUE|PARTIAL|VOID"
        json metadata
        datetime created_at
        datetime updated_at
        datetime finalized_at
        UNIQUE(tenant_id, invoice_number)
    }

    INVOICE_LINE {
        char(36) id PK
        char(36) tenant_id FK
        char(36) invoice_id FK
        varchar(64) line_type
        varchar(255) description
        decimal quantity
        decimal unit_price
        decimal line_total
        decimal tax_rate
    }

    PAYMENT {
        char(36) id PK
        char(36) tenant_id FK
        char(36) invoice_id FK
        char(36) payment_method_id FK
        varchar(64) stripe_payment_intent_id
        decimal amount
        varchar(32) status "PENDING|SUCCEEDED|FAILED|REFUNDED"
        datetime processed_at
    }

    PAYMENT_METHOD {
        char(36) id PK
        char(36) tenant_id FK
        char(36) tenant_user_id FK
        varchar(16) type "CARD|ACH|BANK_TRANSFER"
        varchar(255) stripe_payment_method_id "encrypted"
        varchar(64) brand_last4
        boolean is_default
    }

    INVOICE_PDF {
        char(36) id PK
        char(36) tenant_id FK
        char(36) invoice_id FK UK
        varchar(1024) s3_key
        bigint bytes
        varchar(64) sha256
        datetime created_at
    }

    OUTBOX {
        bigint id PK "auto-inc, monotonic order
        char(36) tenant_id FK
        varchar(64) aggregate_type "INVOICE|PAYMENT|LEASE|TENANT
        char(36) aggregate_id
        varchar(64) event_type
        json payload
        varchar(32) status "PENDING|PROCESSED|FAILED"
        datetime occurred_at
        datetime processed_at
        INDEX idx_tenant_status (tenant_id, status, occurred_at)
    }

    COMMUNICATION {
        char(36) id PK
        char(36) tenant_id FK
        varchar(16) channel "EMAIL|SMS|IN_APP"
        varchar(255) to_addr
        varchar(255) subject
        varchar(32) status "PENDING|SENT|FAILED|BOUNCED|OPENED|CLICKED"
        varchar(64) external_id "Resend message id"
        text body_plaintext
        datetime queued_at
        datetime sent_at
    }
```

---

## 4. Data Classification & Column-Level Encryption

| Classification | Examples | Encryption at Rest | Field-Level Application Encryption |
|---|---|---|---|
| **PUBLIC** | invoice number, tenant display name (non-secret) | SSE-KMS (disk) | No |
| **INTERNAL** | rent amounts, status, created_at, most non-PII tables | SSE-KMS | No |
| **CONFIDENTIAL (PII)** | tenant-user emails, phone, names, SSN fields | SSE-KMS | AES-256-GCM, key rotated every 90 days, via `ENCRYPTION_KEY` env |
| **RESTRICTED** | Stripe API keys per Connect account, bank account numbers, password hashes | SSE-KMS | AES-256-GCM or bcrypt (passwords cost=12) |

Implementation: `shared/database/encryption.ts` transparently encrypts before Prisma write and decrypts on read.

---

## 5. Indexing Strategy

### 5.1 Tenant-Scoped Table Primary Keys
All tenant-scoped tables use composite index with `tenant_id` leading column to support RLS query pattern:

```sql
-- All scoped queries look like:
SELECT * FROM invoice WHERE tenant_id = ? AND id = ?;
SELECT * FROM invoice WHERE tenant_id = ? AND status = ? ORDER BY issue_date DESC LIMIT 50;
```

Indexes:
| Table | Primary Key | Key Composite Secondary Indexes |
|---|---|---|
| tenant | id PK | idx_status (status) |
| user | id PK | uk_email (email) UNIQUE |
| user_membership | id PK | uk_tenant_user (tenant_id, user_id) UNIQUE, idx_user (user_id) |
| property | id PK | idx_tenant_id (tenant_id) |
| building | id PK | idx_tenant_prop (tenant_id, property_id) |
| unit | id PK | idx_tenant_bldg (tenant_id, building_id) |
| tenant_user | id PK | idx_tenant_user (tenant_id, user_id) |
| lease | id PK | idx_tenant_unit (tenant_id, unit_id), idx_tenant_status (tenant_id, status) |
| charge_template | id PK | idx_tenant_lease (tenant_id, lease_id) |
| invoice | id PK | uk_tenant_invnum (tenant_id, invoice_number) UNIQUE, idx_tenant_status (tenant_id, status, issue_date DESC) |
| invoice_line | id PK | idx_inv (invoice_id) |
| payment | id PK | idx_tenant_inv (tenant_id, invoice_id), idx_stripe_pi (stripe_payment_intent_id) |
| payment_method | id PK | idx_tenant_user (tenant_id, tenant_user_id) |
| invoice_pdf | id PK | uk_invoice (invoice_id) UNIQUE |
| outbox | id PK | idx_pending (status, occurred_at) — processing order; idx_tenant (tenant_id, status) |
| communication | id PK | idx_tenant_status (tenant_id, status, queued_at) |

### 5.2 Slow Query Log
- Threshold: 500 ms
- Reviewed weekly by DBA; any query crossing 1s requires engineering action (index or query rewrite) before next release.

### 5.3 MySQL Configuration Key Tunables
```ini
[mysqld]
innodb_buffer_pool_size = 70% of RAM
innodb_log_file_size    = 4G
innodb_flush_log_at_trx_commit = 1   # ACID compliance
sync_binlog             = 1
binlog_format           = ROW
max_connections         = 1000
innodb_read_io_threads  = 8
innodb_write_io_threads = 4
character-set-server    = utf8mb4
collation-server        = utf8mb4_0900_ai_ci
default_time_zone       = +00:00   # All dates UTC in DB
sql_mode                = STRICT_TRANS_TABLES,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO
```

---

## 6. Money & Arithmetic — Correctness Guarantees

All currency stored as `DECIMAL(19,4)` in MySQL. Service layer uses `Decimal.js` for arithmetic.

**Absolute rules:**
1. NEVER FLOAT for money.
2. Totals always computed server-side; client displays only.
3. Rounding happens once on total; never at line items (use `ROUND_HALF_EVEN` — banker's rounding).
4. Every invoice carries `version` integer. Updates are optimistic-locked (`WHERE version = current`).

---

## 7. Migration Strategy — Prisma Migrate

### 7.1 Migration Lifecycle
```
prisma/schema.prisma  →  prisma migrate dev  →  prisma/migrations/[timestamp]_name/migration.sql
                                                          ↓
                                              Review (human)
                                                          ↓
                                    CI runs shadow-DB + forward test on staging replica
                                                          ↓
                                              Deploy (App deploy → prisma migrate deploy)
```

### 7.2 Migration Rules (non-negotiable)

1. **Additive first** — add nullable columns; remove columns/rename needs 2 releases.
2. **No destructive changes** in same deploy as code change.
3. **No locking DDL** — use `ALGORITHM=INPLACE, LOCK=NONE` for large tables.
4. **Backfills batch** 1000 rows per tx to avoid long-held locks.
5. **Rollback plan**: Prisma down-migration tested; previous app version must still work with old+new columns (forward-compatible).
6. **Zero-downtime deployment order**:
   1. Deploy additive-only DB migration
   2. Deploy application that reads old+new
   3. (Next release) Remove old columns

---

## 8. Backup, Restore & RPO/RTO

### 8.1 Backups

| Type | Frequency | Retention | RPO | RTO |
|---|---|---|---|---|
| **Automated snapshots (Aurora)** | Continuous (every 5 min incremental) | 35 days | 5 min | ~15 min |
| **Manual snapshots** | Before each release | 90 days | release boundary | ~15 min |
| **Full mysqldump weekly** | Sunday 01:00 UTC | 1 year (encrypted off-site) | 1 week | ~60 min (100 GB DB) |
| **Binlog replication** | Continuous to DR region | 35 days | 5s lag target | ~30 min (failover DR) |

### 8.2 Restore Runbook (P0)
1. Pause writes (enable maintenance mode)
2. Restore snapshot + apply binlog to target RPO
3. Prisma validate & introspect restored schema
4. Swap connection string (Secrets Manager rotation)
5. Warm cache via read-only script
6. Disable maintenance mode
7. Reconcile any payments via Stripe list API delta

---

## 9. Transaction & Isolation Levels

| Use Case | Isolation Level | Locking |
|---|---|---|
| Default (Prisma tx) | REPEATABLE READ + InnoDB MVCC | Row locks |
| Invoice finalization batch | SERIALIZABLE for invoice number sequence per-tenant counter (tenant_invoice_counter table) | Explicit `SELECT ... FOR UPDATE` |
| Payment apply | READ COMMITTED | Optimistic lock via `invoice.version` |
| Reporting queries (read replica) | READ COMMITTED | No locks (replica) |
| Outbox enqueue | REPEATABLE READ | Shared transaction with state mutation |

### 9.1 Distributed Locks (for cross-instance coordination)
Use Redis `SET NX EX` for:
- Billing cycle finalization (per tenant, 15-min lease)
- Nightly report generation (per tenant)
- Stripe reconciliation (platform-level, once per hour)

---

## 10. Future Scaling Roadmap

### 10.1 Near-term (≤ 100k tenants, ≤ 10M invoices)
- ✅ Current: Aurora vertical + read replicas
- ✅ Cache + offload heavy report queries to replica
- ❓ Optional: Query rewrite layer, read-only transaction for reads.

### 10.2 Medium-term (≤ 1M tenants)
- Partition large tables (`RANGE(YEAR(issue_date)`) on `invoice`, `invoice_line`, `payment`, `communication` by year.
- Dedicated reporting replica (column-store → TiFlash or ClickHouse sync via binlog CDC) for ad-hoc BI.

### 10.3 Long-term (≥ 1M tenants)
- Application-level sharding on `tenantId % 64` → 64 shards, each a MySQL cluster.
- Introduce shard lookup table (`tenant → shard_id`) cached in Redis.
- Extract `payments` into its own service (split monolith on payments bounded context).

---

## 11. Operational Monitoring

Metrics captured and alerted on:
1. `db.connections.active` vs `max_connections` (warn at 80%)
2. `db.slow_queries.count` (alert at > 10/min)
3. `db.deadlocks.count` (alert at > 1/hr)
4. `db.replication_lag_seconds` (alert > 30s, p95 5s)
5. `db.lock_wait_seconds` p95 (alert > 2s)
6. `prisma.pool.wait_time` p95 (alert > 200 ms)
7. Binary disk usage (alert < 20% free)

Queries are instrumented with `traceId` and logged to Aurora Performance Insights.
