# Backup & Restore — myTenant Invoice

## Document Status

- **Version:** 1.0.0
- **Database:** MySQL 8.0+ (InnoDB)
- **Objectives:** RPO ≤ 15 minutes, RTO ≤ 4 hours for full recovery, RTO ≤ 1 hour for point-in-time recovery of a single tenant

## Related Documentation

- [Data Model](./data-model.md)
- [Tenant Isolation](./tenant-isolation.md)
- [Retention Policy](./retention-policy.md)
- [Disaster Recovery](../09-devops/disaster-recovery.md)
- [Environments](../09-devops/environments.md)
- [Secrets Management](../05-security/secrets-management.md)

---

## 1. Strategy Overview

Three complementary layers ensure recoverability:

```text
                        ┌───────────────────────────────────────┐
                        │ 1. Continuous replication (binlog)    │
                        │    Point-in-time recovery (PITR)     │
                        │    RPO: seconds                       │
                        └───────────────────┬───────────────────┘
                                            │
                        ┌───────────────────▼───────────────────┐
                        │ 2. Snapshots (EBS/volume/DB-native)  │
                        │    Hourly incremental, weekly full    │
                        │    RPO: 15 min                        │
                        └───────────────────┬───────────────────┘
                                            │
                        ┌───────────────────▼───────────────────┐
                        │ 3. Logical dumps (mysqldump)          │
                        │    Nightly, on-demand before releases │
                        │    Portable across MySQL versions     │
                        └───────────────────────────────────────┘
```

No single layer is sufficient:
- Binlog alone cannot recover from DROP TABLE / DROP DATABASE errors (it replicates them too, unless delayed replication is configured).
- Snapshots alone cannot restore to a point between snapshot intervals with sub-hour granularity.
- Logical dumps are too slow for primary recovery on terabyte-scale databases but are indispensable for schema-level recovery, partial export, and legal discovery.

---

## 2. Objectives

| Metric | Target | Measurement |
|---|---|---|
| **Recovery Point Objective (RPO)** | ≤ 15 minutes | Timestamp delta between last safe binlog position and failure event |
| **Recovery Time Objective (RTO) — Full DB** | ≤ 4 hours | Time to restore and validate service for all tenants |
| **Recovery Time Objective (RTO) — Single tenant** | ≤ 1 hour | Time to restore only one organization's rows from a known-good backup into a clean state |
| **Backup retention — Hot** | 7 days | Online, immediately restorable snapshots + binlog |
| **Backup retention — Warm** | 30 days | On-demand restorable object storage snapshots |
| **Backup retention — Cold (compliance)** | 7 years | Encrypted, immutable object storage lock (compliance mode) |
| **Backup verification frequency** | Weekly automated restore test + monthly live-fire DR drill | See §8 |

All objectives apply to production. Staging uses a reduced but identical strategy (reduced retention). Development environments are not backed up; seed scripts reproduce them.

---

## 3. Continuous Backup (Binlog)

MySQL binary logs are the basis of point-in-time recovery.

### 3.1 Server Configuration

```ini
# /etc/mysql/conf.d/binlog.cnf
[mysqld]
server-id               = 1
log_bin                 = /var/lib/mysql/binlogs/mysql-bin
binlog_format           = ROW
binlog_row_image        = FULL
expire_logs_days        = 0
binlog_expire_logs_seconds = 2592000    ; 30 days
sync_binlog             = 1
innodb_flush_log_at_trx_commit = 1
max_binlog_size         = 256M
gtid_mode               = ON
enforce_gtid_consistency = ON
binlog_transaction_dependency_tracking = WRITESET
```

### 3.2 Offloading

Binlogs are streamed continuously to object storage using a dedicated agent (e.g., `mysqlbinlog --read-from-remote-server`, or the managed service equivalent). The bucket is versioned, encrypted with a KMS key, and has object-lock compliance retention enabled for at least 30 days.

### 3.3 Delayed Replica

At least one replica runs with `CHANGE REPLICATION SOURCE TO ... SOURCE_DELAY = 3600` (1 hour delay). This provides a window to recover from operator mistakes before the error replicates:

```sql
-- Stop the replica before the bad transaction replays
STOP REPLICA;
-- Point-in-time recover from binlog up to the bad GTID
-- Then resume the rest of replication forward from there
```

---

## 4. Snapshot Backups

Use storage-engine or volume snapshots consistent with InnoDB:

| Type | Schedule | Retention | Tool |
|---|---|---|---|
| Full snapshot | Weekly, Sunday 02:00 UTC | 4 weekly online, 8 weekly offline | Managed DB snapshot / LVM + `FLUSH TABLES WITH READ LOCK` + snapshot + unlock |
| Incremental | Hourly on the hour | 48 online, 14 days warm | DB-native incremental or volume snapshots |
| Pre-release on-demand | Immediately before `prisma migrate deploy` in production | Permanent until 2 successful future deployments validate | Manual via operator command |

### 4.1 Consistency Guarantees

InnoDB crash recovery guarantees a consistent snapshot even without a warm backup tool, but a file-system snapshot while MySQL is running must be followed by crash recovery on restore. The preferred tool chain is:

1. `FLUSH BINARY LOGS;` (rotate so the last binlog checkpoint is fully written)
2. Optional: single transaction `FLUSH TABLES tbl1, tbl2, ... WITH READ LOCK;` on the logical list of tables (skipped in managed DBs that provide crash-safe snapshots)
3. Take the volume snapshot (< 1 second)
4. `UNLOCK TABLES;`

### 4.2 Encryption

- Snapshots are encrypted at rest using the provider's default encryption key, plus a customer-managed KMS key for the backup volume if available.
- Access to snapshots is restricted to the disaster-recovery IAM role. Access logs are shipped to a tamper-proof audit trail.

---

## 5. Logical Dumps (mysqldump)

Logical dumps are **not** the primary recovery path because restore time scales linearly with table size. Their purpose:
- Schema-level recovery (restore a single dropped table without full restore)
- Portable export for GDPR data requests
- Legal discovery
- Migration between MySQL major versions
- Validation of backup integrity (SQL replayable on a fresh instance)

### 5.1 Schedule

| Type | Schedule | Retention |
|---|---|---|
| Full schema + data nightly | 03:15 UTC daily | 14 days online, 12 months cold |
| Schema-only nightly | 03:45 UTC daily | 12 months |
| Before any `migrate deploy` | On-demand in deploy pipeline | Permanent (archived with release tag) |
| GDPR/tenant export request | On-demand | Per-case retention window |

### 5.2 Command

```bash
# Full logical dump (no GTID purged, consistent single-transaction)
mysqldump \
  --defaults-extra-file=/etc/mysql-backup-creds.cnf \
  --host="${DB_HOST}" \
  --user=backup_user \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  --set-gtid-purged=OFF \
  --hex-blob \
  --order-by-primary \
  --compress \
  --databases mytenant_invoice \
| gpg --batch --yes --trust-model always \
    --recipient "${BACKUP_ENCRYPTION_FP}" \
    --symmetric --cipher-algo AES256 \
    --passphrase-file /run/secrets/backup-passphrase \
| aws s3 cp - \
    "s3://${BUCKET}/mysqldump/$(date +%Y)/$(date +%m)/$(date +%d)/full-$(date +%Y%m%d-%H%M%S).sql.gpg" \
    --storage-class STANDARD_IA \
    --server-side-encryption aws:kms \
    --sse-kms-key-id "${KMS_KEY}"
```

### 5.3 Credentials

The `backup_user` account has only:

```sql
CREATE USER 'backup_user'@'%' IDENTIFIED BY '...';
GRANT SELECT, PROCESS, RELOAD, LOCK TABLES, REPLICATION CLIENT, SHOW VIEW, EVENT, TRIGGER ON *.* TO 'backup_user'@'%';
REVOKE INSERT, UPDATE, DELETE, DROP, ALTER, CREATE ON *.* FROM 'backup_user'@'%';
```

This prevents accidental writes from an account whose key is exposed to the backup host.

---

## 6. Restore Procedures

### 6.1 Full Disaster Recovery

Steps for the incident commander in a "database is gone / unusable" scenario:

```
Step 1 — Declare incident, activate DR runbook.
    → Freeze deployments.
    → Detach application from database (failing over to 503 maintenance page).

Step 2 — Identify recovery point.
    → Confirm last known-good GTID/binlog position before incident.
    → If caused by bad migration / bad SQL, subtract 1-2 minutes from incident time.

Step 3 — Restore last full snapshot to a new (empty) MySQL cluster.
    → Expected time: ~30-90 minutes depending on DB size.

Step 4 — Replay binlogs up to recovery point (PITR).
    → mysqlbinlog --stop-datetime="<recovery_time>" ... | mysql
    → Verify GTID set matches expected recovery point.

Step 5 — Integrity checks.
    →  COUNT(*) per critical table vs last known metric (CloudWatch/Datadog).
    →  SUM(Invoice.total) grouped by date; compare for last 7 days.
    →  Foreign key integrity (no orphaned rows; spot-check large tables).
    →  Restore test: run a few org-scoped queries for known invoice numbers; match responses against snapshot of prior API output.

Step 6 — Repoint application.
    → Update DATABASE_URL via secret rotation.
    → Start a single canary app server; run smoke test suite.
    → Gradually re-enable traffic via load balancer weights (5%, 25%, 100%).

Step 7 — Post-incident.
    → Validate billing jobs, webhook retries, and notification retries have caught up.
    → Write incident report within 48 hours.
```

### 6.2 Single-Tenant Recovery (Organization)

Used when only one organization's data is corrupted (e.g., a buggy import, a misbehaving support agent, or accidental purge). Steps:

1. Restore the most recent valid snapshot into an isolated **restore cluster** (never touch production).
2. Run `mysqldump` on that cluster with the `--where` filter per table scoped to the single `organizationId`:

   ```bash
   mysqldump restore_cluster mytenant_invoice \
     --tables Invoice InvoiceItem Payment PaymentAllocation Refund CreditNote ... \
     --where="organizationId = 'org_abc123xyz'" \
     > org_restore.sql
   ```

3. Dry-run the import into a staging copy of production.
4. In a transaction on production, soft-delete (mark `deletedAt` or equivalent) the current corrupted rows for that org and import the restored rows. Write an `AuditLog` with `action = "TENANT_RECOVERY"` and the incident ID.
5. Notify the organization owner and the DRI.

---

## 7. Object Storage Layout

```
s3://mytenant-backups-prod/
├── snap/
│   ├── weekly/
│   │   └── 2026-09-20T02-00-00Z/
│   │       ├── manifest.json            (checksums, GTID set, schema version, tool version)
│   │       └── volume-snapshot-id       (opaque reference to the provider snapshot)
│   └── hourly/
│       └── 2026-09-20T14-00-00Z/ ...
├── binlog/
│   └── 2026/09/20/
│       └── mysql-bin.001234
├── mysqldump/
│   └── 2026/09/20/
│       ├── full-20260920-031501.sql.gpg
│       └── full-20260920-031501.sql.manifest  (row counts, sha256, schema hash)
├── restores/
│   └── DR-2026-09-20/
│       ├── restore-plan.md
│       └── integrity-report.json
└── metadata/
    └── backup-inventory.jsonl
```

Every backup object has:
- SHA-256 checksum stored in `manifest.json`.
- Mtime + size logged.
- Encrypted with envelope encryption (DEK per backup, KMS-wrapped).
- Object lock for the compliance retention window.

---

## 8. Backup Validation

A backup that cannot be restored is worse than no backup (because it gives a false sense of safety).

### 8.1 Automated Weekly Restore Test

Every Sunday at 06:00 UTC a non-production job:

1. Picks last Saturday's full snapshot.
2. Restores it into a disposable MySQL cluster.
3. Replays the subsequent 24 hours of binlogs.
4. Runs the full data-integrity test suite (see §8.3).
5. Exports a pass/fail report to the #ops-alerts channel.
6. On failure: pages the on-call DRI immediately.

### 8.2 Monthly Live-Fire DR Drill

First Tuesday of every month, the on-call engineer + an observer run §6.1 in staging against the production-like dataset:

- Staging is wiped, restored from backup, and measured against RTO.
- Result: signed off in DR runbook log.
- Any objective missed → backlog ticket created before the meeting ends.

### 8.3 Integrity Checks

| Check | Example |
|---|---|
| **Schema hash** | Compare `SHOW CREATE TABLE` per table against expected `schema.prisma` hash |
| **Prisma validate** | `prisma validate` against the restored DB |
| **Prisma deploy dry-run** | `prisma migrate deploy` should report "all migrations applied" |
| **Row count** | `COUNT(*)` per table within 1% of pre-backup metric |
| **Financial control totals** | `SUM(total)` of all invoices grouped by month of last 6 runs vs archived ledger |
| **Balances reconcile** | For each org: `SUM(invoice.balance) == SUM(invoice.total) - SUM(payment.allocated)` (sample 100 orgs) |
| **FK integrity** | `SELECT COUNT(*) FROM child WHERE parentId NOT IN (SELECT id FROM parent)` = 0 for each FK column |
| **Uniqueness** | No duplicate rows on any `@@unique` constraint |
| **CUID format** | `id` columns match CUID regex (`^c[a-z0-9]{24}$`) |
| **Tenant isolation** | Cross-org join queries produce zero rows; run the isolation test battery |

---

## 9. Secrets and Access

| Secret | Location | Access |
|---|---|---|
| MySQL backup-user password | Secret Manager / Vault | Only the backup service account |
| GPG backup passphrase | Secret Manager / Vault | Only restore job + incident commander |
| KMS key (envelope encryption) | Cloud KMS with key rotation | Encrypt only for backup service; decrypt only for restore job + incident commander |
| Snapshot restore permissions | IAM role | Restricted to disaster-recovery role; requires MFA for console use |

Backup access is logged to a separate immutable audit trail, not the application's `AuditLog` table (to prevent a bad actor from covering tracks by deleting log rows from the same database).

---

## 10. Data-in-Transit & Data-at-Rest

| Aspect | Standard |
|---|---|
| MySQL backup channel | TLS 1.3 enforced on all client/server links |
| Object storage uploads | HTTPS TLS 1.2+; use bucket policies rejecting plain HTTP |
| Logical dump files | AES-256-GPG encrypted before upload (application-layer encryption, not just S3-SSE) |
| Snapshots | Encrypted at rest by provider + customer-managed KMS key |
| Binlog offload | Encrypted in flight and at rest by same KMS envelope strategy as dumps |

---

## 11. Testing Deployment Rollbacks

Immediately before every `prisma migrate deploy` in production, the deploy pipeline takes an on-demand full snapshot plus an immediately preceding schema-only `mysqldump`. If the deployment fails validation:

1. Pipeline automatically rolls back code to the previous release.
2. The DRI decides (within 10 minutes) whether a schema rollback is required.
3. If required, roll forward to a new migration in most cases; roll back via snapshot only if the new migration corrupted data and a forward-fix would be riskier.

Rollbacks by restore are the **least-preferred** option because they lose writes that happened after the snapshot. In most cases a forward-fix migration (e.g., re-adding a dropped column and backfilling) is preferred. See [rollback](../09-devops/rollback.md).

---

## 12. Escalation

| Event | Action |
|---|---|
| Automated weekly restore test fails | Page DRI within 1 business hour; do not approve further prod deployments until root cause identified |
| Monthly DR drill misses RPO/RTO | Action items in backlog within 24 hours; next drill scheduled within 2 weeks |
| Production restore actually required | P1 incident; notify all stakeholders; use the runbook rather than improvising |
| Backup encryption key lost or rotated incorrectly | Security incident; trigger key-recovery ceremony documented in [Secrets Management](../05-security/secrets-management.md) |
