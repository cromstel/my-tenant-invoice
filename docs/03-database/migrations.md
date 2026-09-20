# Migrations — myTenant Invoice

## Document Status

- **Version:** 1.0.0
- **Tool:** Prisma Migrate (`prisma migrate`)
- **Database:** MySQL 8.0+ (InnoDB)

## Related Documentation

- [Data Model](./data-model.md)
- [Schema Reference](./schema-reference.md)
- [Indexing Strategy](./indexing-strategy.md)
- [CI/CD](../09-devops/cicd.md)
- [Environments](../09-devops/environments.md)
- [Rollback](../09-devops/rollback.md)

---

## 1. Migration Rules

| Rule | Value |
|---|---|
| No manual schema changes in prod | Enforced by CI and DB user permissions |
| Every schema change is a Prisma migration | `prisma/migrations/<timestamp>_<name>/migration.sql` |
| No destructive changes in patch releases | Follow §7 |
| Migration scripts are reviewed | Two engineers sign off; one of them senior |
| Prisma schema = source of truth | Never modify `migration.sql` directly without updating `schema.prisma` |
| Migrations are immutable once merged | If a migration is wrong, write a *new* migration that fixes it |

---

## 2. Prisma Migrate Configuration

### 2.1 Environment

```env
# .env.example — placeholders only
DATABASE_URL="mysql://app_user:changeme@127.0.0.1:3306/mytenant_invoice"
SHADOW_DATABASE_URL="mysql://app_user:changeme@127.0.0.1:3306/mytenant_invoice_shadow"
MIGRATE_DATABASE_URL="mysql://migrate_user:changeme@127.0.0.1:3306/mytenant_invoice"
```

- `DATABASE_URL` is used by the application (minimum privileges).
- `MIGRATE_DATABASE_URL` is used only during migration runs (`ALTER`, `CREATE`, `DROP` privileges).
- `SHADOW_DATABASE_URL` is used by Prisma Migrate to diff and generate SQL; it is never used by the application.

### 2.2 MySQL Connection Parameters

```env
# Append to DATABASE_URL or set via server configuration
connect_timeout=10
pool_timeout=30
wait_timeout=28800
mysql_connection_attributes=app=mytenant_invoice
```

### 2.3 package.json scripts

```json
{
  "scripts": {
    "db:generate": "prisma generate",
    "db:migrate:dev": "prisma migrate dev",
    "db:migrate:create": "prisma migrate dev --create-only",
    "db:migrate:deploy": "prisma migrate deploy",
    "db:migrate:resolve": "prisma migrate resolve --applied",
    "db:migrate:status": "prisma migrate status",
    "db:push:safe": "prisma db push --skip-generate",
    "db:seed": "ts-node prisma/seed.ts",
    "db:studio": "prisma studio",
    "db:reset": "prisma migrate reset --force"
  }
}
```

---

## 3. Workflows

### 3.1 Development Flow

```text
1. Edit prisma/schema.prisma
2. npx prisma migrate dev --name <descriptive-name>
   → Generates prisma/migrations/<timestamp>_<name>/migration.sql
   → Applies it to the local dev database
   → Runs seeding if prisma/seed.ts exists
3. Review generated SQL in ./migrations/.../migration.sql
4. Add a data backfill / post-migration step (see §5) when required
5. Commit schema.prisma + migration folder together
```

Always use `--name` so the migration folder carries a human-readable slug. Avoid auto-generated `migration_name` defaults.

### 3.2 Deployment Flow

```text
1. CI builds image (no DB access here)
2. Deploy pipeline runs:
   npx prisma migrate deploy \
     --schema=./prisma/schema.prisma
3. Step fails the pipeline on any migration failure
4. On success, proceed with app deploy
5. Post-deploy: run any backfill scripts (see §5)
```

`prisma migrate deploy` is idempotent. It only runs migrations whose checksum is not already recorded in the `_prisma_migrations` table.

### 3.3 Migration Failure Recovery

```text
Failed state:
  _prisma_migrations has a row with `started_at` set but `finished_at` NULL.

Resolution:
  1. Inspect logs, understand which step failed.
  2. If the migration SQL ran partially (MySQL DDL is partially transactional in 8.0+),
     determine the applied sub-steps manually.
  3. Roll forward — fix the schema with a NEW migration (never edit a committed one).
  4. Mark the broken migration resolved:
       prisma migrate resolve --rolled-back <migration_name>   # if it didn't apply at all
       prisma migrate resolve --applied <migration_name>      # if it partially applied and we patched manually
  5. Document every manual intervention in CHANGELOG and runbook.
```

Never edit a migration `.sql` file after it has been merged. Migrations that shipped to any environment (including staging) are immutable artifacts.

---

## 4. Baseline Migration — Initial Schema

The first migration bootstraps all tables, indexes, enums, and seed catalog rows described in [data-model.md](./data-model.md). Generated checksum: `[recorded by Prisma at migration time]`.

Baseline migration contents summary:

```sql
-- 0000_init/
-- 1. Enums (MySQL translates Prisma enum → VARCHAR + CHECK in older versions; in 8.0+ uses native ENUM)
-- 2. Core tables: User, Session, SubscriptionPlan, Role, Permission, RolePermission
-- 3. Organization + OrganizationMember
-- 4. Property hierarchy: Portfolio, Property, Building, Unit
-- 5. CRM: Customer, CustomerContact
-- 6. Billing catalog: Lease, Service, Tariff, TariffVersion
-- 7. Metering: Meter, MeterReading
-- 8. Financial: BillingCycle, Invoice, InvoiceItem, CreditNote, CreditNoteItem,
--              Payment, PaymentAllocation, Refund
-- 9. Operational: Notification, Document, AuditLog
-- 10. Integrations: WebhookEndpoint, WebhookEvent, ApiKey, Integration
-- 11. Support: SupportTicket, SupportTicketMessage
-- 12. All @@unique, @@index definitions
-- 13. Foreign keys with ON DELETE behaviour per schema-reference.md §9
```

---

## 5. Backfill / Multi-step Migrations

Any change that requires a data transformation in addition to DDL must be split into at least two migrations so that the code and data can be deployed without downtime.

### 5.1 Safe Refactor (example: rename column with backfill)

```
Migration 1 (deploy 1):
  ADD new_column (nullable, no index yet)
  + Application code dual-writes old and new columns on every write

Release 1 → app server now populates both columns for all new writes.

Post-release script (runs after deploy 1 green):
  UPDATE table SET new_column = old_column WHERE new_column IS NULL;
  (batched, low-concurrency, see §6)

Migration 2 (deploy 2):
  SET new_column NOT NULL
  ADD indexes on new_column
  + Application code reads from new_column, drops old column writes

Migration 3 (deploy 3, after a cool-off period):
  DROP old_column
```

### 5.2 When Backfills Run

- After the migration deploying the new columns, but BEFORE the migration making them required.
- Never inside a migration SQL file itself for more than 1,000 rows; use a separate backfill job.
- Batched: `LIMIT 500` per loop, 250ms sleep between batches, monitor replication lag.

```ts
// prisma/backfills/<ticket>_backfill_<entity>.ts
export async function backfillInvoiceCurrency(batchSize = 500) {
  let done = 0;
  while (true) {
    const batch = await prisma.organization.findMany({
      where: { /* paginate */ },
      take: batchSize,
      orderBy: { id: "asc" },
      select: { id: true, currency: true, invoices: { take: batchSize, where: { currency: null } } },
    });
    if (!batch.length) break;
    for (const org of batch) {
      await prisma.invoice.updateMany({
        where: { organizationId: org.id, currency: null },
        data: { currency: org.currency },
      });
    }
    done += batch.length;
    await new Promise((r) => setTimeout(r, 250));
  }
  return { done };
}
```

---

## 6. Large-Table Considerations

MySQL uses instant `ADD COLUMN` for most new nullable non-indexed columns in 8.0+. Adding indexes on existing tables still rebuilds the table in many cases. For tables over 1,000,000 rows, prefer the following strategy:

1. Create the index with `ALTER TABLE ... ADD INDEX ... ALGORITHM=INPLACE, LOCK=NONE`.
2. Confirm with `SHOW PROCESSLIST` that the operation is running online.
3. Schedule during a maintenance window or low-traffic hours; monitor replica lag.
4. Never run an index creation on the primary that exceeds 30 minutes without failing over writes.

Prisma Migrate's generated SQL usually picks the correct DDL for the schema change. When it does not, edit the generated `migration.sql` **before committing** to insert the algorithm hints:

```sql
-- migration.sql (after edit)
ALTER TABLE `MeterReading`
  ADD INDEX `MeterReading_meterId_readingDate_idx` (`meterId`, `readingDate`),
  ALGORITHM=INPLACE, LOCK=NONE;
```

---

## 7. Destructive Change Policy

Never deploy a destructive change in the same release as the code that drops compatibility.

### 7.1 Allowed Only After Cool-off

| Change | Cool-off period |
|---|---|
| Drop a column | 2 full releases + 14 days minimum after last read/write removed |
| Drop a table | 2 full releases + 30 days minimum, or permanent soft delete |
| Drop/shorten an index | 1 release; measure query perf first |
| Shrink `@db.VarChar(N)` to a smaller N | Only after proving all rows fit; require code review from 2 people |
| Change `@db.Decimal(P,S)` → smaller precision | Never; always migrate UP in precision |

### 7.2 Never Allowed

- Dropping columns on financial tables: `Invoice`, `InvoiceItem`, `Payment`, `PaymentAllocation`, `Refund`, `CreditNote`, `CreditNoteItem`, `MeterReading`, `AuditLog`. Use terminal statuses / soft deletes instead.
- Decreasing precision of any `@db.Decimal(19, 4)` column (risk of rounding loss; if space is a concern, add a new column, backfill, swap).
- Dropping the `organizationId` column on any scoped table.

### 7.3 Prisma Safety

Prisma Migrate detects destructive changes and asks for confirmation during `migrate dev`. During CI/deploy, destructive changes are blocked via:

```bash
# .github/workflows/pr.yml — fail the pipeline if a migration drops columns
prisma migrate diff \
  --from-url "$PROD_REPLICA_URL" \
  --to-migrations ./prisma/migrations \
  --script > /tmp/diff.sql

if grep -qEi "^(DROP (TABLE|COLUMN)|ALTER TABLE .* DROP COLUMN)" /tmp/diff.sql; then
  echo "::error::Destructive change detected. See docs/03-database/migrations.md §7"
  exit 1
fi
```

---

## 8. MySQL-Specific Caveats

### 8.1 ENUM Additions

Adding a new value to a Prisma `enum` on MySQL 8.0+ is a safe metadata-only change in most scenarios. However, if the enum column is indexed, MySQL may rebuild the index. Rule:

1. Always run the migration against a staging copy of production-sized data.
2. If the table has > 1M rows, consider using a string column instead and validating the enum in TypeScript/Zod.

### 8.2 Foreign Keys

Prisma uses `FOREIGN KEY ... ON DELETE ...` on InnoDB tables. Before MySQL 8.0.29, `ALTER TABLE ... ADD FOREIGN KEY` required a table rebuild; verify the minor version in production.

### 8.3 JSON Columns

`Json?` in Prisma maps to MySQL `JSON` type. Adding a JSON column is instant. Indexing JSON requires generated columns; see [indexing-strategy.md](./indexing-strategy.md) §6.

### 8.4 utf8mb4 Everywhere

The initial migration creates the database as:

```sql
CREATE DATABASE IF NOT EXISTS `mytenant_invoice`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;
```

Never use `utf8` (3-byte MySQL utf8) or `latin1`. The baseline migration includes a check that `SELECT @@character_set_database` returns `utf8mb4`; it fails otherwise.

---

## 9. Migration Testing

Before a migration reaches production, it must pass:

1. **Smoke test on an empty DB.**
   `prisma migrate deploy` against an empty local MySQL; verify `prisma validate` passes.
2. **Test against a dump of production data.**
   Apply migrations to a restored nightly backup; verify each statement succeeds and data integrity holds.
3. **Backfill script unit test.**
   Any backfill script has test coverage on seed data plus an artificially large dataset.
4. **Rollback simulation.**
   Re-run the same migration suite against a restored backup twice; second run must be a no-op (idempotency).

CI automatically runs (1) on every PR. (2) and (3) are nightly pre-release jobs. (4) runs during the release staging run.

---

## 10. CI/CD Integration

### 10.1 Pull Request Checks

```yaml
# .github/workflows/pr-database.yml
name: Database PR checks

on: [pull_request]

jobs:
  migrate:
    runs-on: ubuntu-latest
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: root
          MYSQL_DATABASE: mytenant_test
          MYSQL_USER: test
          MYSQL_PASSWORD: test
        options: >-
          --health-cmd="mysqladmin ping -u root -proot"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=5
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - env:
          DATABASE_URL: mysql://test:test@127.0.0.1:3306/mytenant_test
          SHADOW_DATABASE_URL: mysql://test:test@127.0.0.1:3306/mytenant_test_shadow
        run: |
          npx prisma migrate dev --name ci_test_run || true
          npx prisma validate
          npx prisma migrate status
          npx prisma generate
          npx vitest run tests/migrations/
```

### 10.2 Production Deploy

```bash
# deploy-migrations.sh (runs from bastion / deploy pipeline)
set -euo pipefail

export DATABASE_URL="${MIGRATE_DATABASE_URL}"

STATUS=$(npx prisma migrate status)
echo "Pre-migration status:"
echo "${STATUS}"

# 1. Take a schema-level logical backup (mysqldump --no-data) just before applying
mysqldump --no-data --single-transaction \
  -u migrate_backup_user -p"${BACKUP_PASS}" \
  -h "${DB_HOST}" mytenant_invoice \
  > "./artifacts/pre-migrate-schema-$(date +%Y%m%d-%H%M%S).sql"

# 2. Run migrations via Prisma
npx prisma migrate deploy

echo "Post-migration status:"
npx prisma migrate status
```

If migrations fail, the pipeline must roll **forward** (new patch release) rather than manually editing the applied set. Database-level rollback restores from the pre-deployment snapshot — see [backup-restore.md](./backup-restore.md).

---

## 11. Migration Log

Every migration is recorded here. The list grows over time; this section is append-only.

| Version | Name | Date | Summary | Author |
|---|---|---|---|---|
| 0000 | `init` | (project start) | Bootstrap of all tables, indexes, enums described in data-model.md | (team) |
| 0001 | `add_billing_cycle_foreign_keys` | (TBD) | Example: adds billingCycle FK to Invoice if deferred | — |

All new migrations must update this table before merge.
