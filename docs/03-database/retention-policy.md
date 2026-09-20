# Retention Policy — myTenant Invoice

## Document Status

- **Version:** 1.0.0
- **Scope:** Database rows, object-storage documents, backups, logs
- **Compliance:** Aligns with GDPR Article 5(1)(e), SOX, and common landlord/tenant statutory retention windows

## Related Documentation

- [Backup & Restore](./backup-restore.md)
- [Data Model](./data-model.md)
- [Tenant Isolation](./tenant-isolation.md)
- [Disaster Recovery](../09-devops/disaster-recovery.md)
- [Security Overview](../05-security/security-overview.md)

---

## 1. Policy Principles

1. **Purpose limitation.** Data is kept only as long as necessary for the purpose it was collected for.
2. **Soft delete before hard delete.** User-visible deletion is soft-delete for financial records; hard delete is a separate background job running after the regulatory retention window expires.
3. **Financial records are retained longer than operational records.** Invoices, payments, and audit logs have statutory retention obligations.
4. **Per-tenant overrides.** Organizations on regulated plans can request longer retention; requests are recorded in a compliance ledger and applied on a per-org basis via a `retentionOverrideJson` column on the Organization (future).
5. **Deletion is verifiable.** Every run of the retention job writes an `AuditLog` with counts per table, a signed manifest, and a SHA-256 of the set of deleted IDs. Regulators and data subjects can request this manifest.

---

## 2. Row Retention Schedule

The retention window starts from the row's terminal lifecycle timestamp:

- Soft-deletable rows: `deletedAt` (when set)
- Financial terminal rows: status-change timestamp (`VOID`, `CANCELLED`, paid invoice date, refund processed)
- Time-series rows: `createdAt`
- Log-style rows: `createdAt`

All values below are the default. Longer legal windows per jurisdiction override.

### 2.1 Financial Ledger (Statutory Retention)

| Entity | Retention (Default) | Deletion Method | Legal Basis (illustrative) |
|---|---|---|---|
| `Invoice`, `InvoiceItem` | **7–10 years** after invoice is terminal (PAID, VOID, CANCELLED) or fiscal year closes | Immutable; never hard-deleted before window. After window: export to immutable archive → hard delete. | Accounting/tax records (varies: UK 6y, DE 10y, US 7y for tax) |
| `CreditNote`, `CreditNoteItem` | **7–10 years** same as invoice | Same as above | Tax documentation |
| `Payment`, `PaymentAllocation` | **7–10 years** from `transactionDate` | Same as above | Anti-money laundering, tax |
| `Refund` | **7–10 years** from `processedAt` | Same as above | Consumer protection, AML |
| `BillingCycle` | **7–10 years** from `completedAt` | Same as above | Audit trail of billing runs |
| `MeterReading` | **10 years** from `readingDate` | Export + hard delete after window | Utility regulatory requirements vary; default to long |
| `TariffVersion` | **10 years** from `effectiveTo` + 7y last-invoice-using-version | Never hard-delete while referenced by an invoice; follow invoice retention after | Invoices must be reproducible |
| `Meter` (historical) | **10 years** after `removalDate` | Soft → archive → delete | Regulatory history |

### 2.2 Operational Records

| Entity | Retention (Default) | Deletion Method |
|---|---|---|
| `Customer`, `CustomerContact` | **Last interaction + 5 years** if no active lease/invoice; while active: retain. | Soft delete first (`deletedAt`). After window + no financial linkage, hard delete per GDPR erasure. |
| `Lease` | **End of lease term + 7 years** or last invoice using the lease, whichever is later | Soft → archive → delete |
| `Property`, `Building`, `Unit` | **Last lease + 7 years**; if reactivated, retention resets | Soft → archive → delete |
| `Portfolio` | While has properties; empty portfolio deletion: immediate soft + 90 days then hard | Soft → delete |
| `Service`, `Tariff` (current) | Retained while `isActive = true`; inactive services: **3 years** after last use | Soft → delete |
| `Notification` | **90 days** sent/read; 7 days for failed+abandoned | Hard delete by job |
| `WebhookEvent` | **30 days** delivered; **7 days** after terminal failure | Hard delete by job |
| `Session` | `expiresAt` + 24 hours; force logout sessions deleted on logout | Hard delete by job |
| `Document` (generated PDFs) | Same retention as the parent entity (invoice, receipt). Uploads (photos/contracts): per-parent entity. | Soft delete + purge object storage after window |
| `Document` (support attachments) | **Ticket closure + 3 years** then delete | Same |
| `SupportTicket`, `SupportTicketMessage` | **Ticket closure + 3 years** | Soft → delete |
| `ApiKey` (revoked) | Revocation + **90 days** then hard delete; last-used audit kept longer | Hard delete of key material |
| `Integration` (disconnected) | Disconnect + **180 days** delete credentials; metadata kept per org lifetime | Delete encrypted tokens after 180d |
| `WebhookEndpoint` (disabled + `consecutiveFailures > threshold` stale) | **6 months idle** → notify, then soft delete + 30d → hard delete | Soft → delete |

### 2.3 Audit and Security Logs

| Entity | Retention |
|---|---|
| `AuditLog` (financial actions) | **7–10 years** matching the financial record it describes |
| `AuditLog` (auth/admin actions: login, role change, permission change, impersonation) | **12 months minimum; 2 years recommended**; platform security team can request longer |
| `AuditLog` (general UI actions) | **90 days** |
| HTTP access logs (WAF / edge / app) | **90 days hot**; **12 months warm archive**; **7 years cold if SOX scope** |
| Database query log / slow log | **30 days hot only**; not archived unless an incident is open |

Regulated tenants override: `AuditLog` 10 years; access logs 7 years.

---

## 3. Backup Retention

Separate from row retention: backups hold *snapshots* of the database at points in time. Backup retention is layered:

| Backup Type | Retention | Storage Class |
|---|---|---|
| Hourly incremental snapshots | Last **48 hours** | Hot |
| Daily incremental snapshots | Last **14 days** | Hot → Standard-IA after 2d |
| Weekly full snapshots | Last **8 weeks** online; thereafter moved to cold archive | Warm → Glacier/Archive after 30d |
| Monthly full snapshots | **12 months** warm + **7 years** cold archive (compliance lock) | Cold, Object Lock Compliance mode enabled |
| Binlog continuous | **30 days online**; replay archived to cold storage for 7 years | Hot → Cold |
| Nightly logical `mysqldump` | Last **14 nights** online; monthly dumps retained **12 months warm** + 7 years cold archive | Mixed |
| Pre-release on-demand dumps | Retain **2 successful releases** after the release passes; archive any release referenced in an incident permanently | Mixed |

Backups older than the 7-year cold archive window are **cryptographically erased** by destroying the KMS key that wrapped the DEK, after a signed management decision and 30-day notice to the compliance officer.

---

## 4. Deletion Implementation

### 4.1 Background Retention Job

```mermaid
flowchart TD
    A[Cron: daily 04:00 UTC] --> B[For each retention class]
    B --> C[SELECT id FROM <table> WHERE <terminal_condition> AND created_at < NOW() - INTERVAL <window> LIMIT 1000]
    C --> D{Result rows?}
    D -- No --> B
    D -- Yes --> E[Write AuditLog: RETENTION_PURGE_START {table, ids, count}]
    E --> F[Export manifest to compliance bucket: JSON + SHA256]
    F --> G[Begin batched transaction]
    G --> H[DELETE rows in batches of 100 with NOWAIT]
    H --> I[Commit]
    I --> J[Write AuditLog: RETENTION_PURGE_DONE {table, count, manifest_hash}]
    J --> C
```

Key properties:
- **Idempotent.** Running the job twice on the same day produces no duplicate deletes and no errors.
- **Non-blocking.** Batches of 100 rows, 500ms sleep between batches, reads from a read replica to pick candidates, deletes on primary with low priority.
- **Pause switch.** An organization-level `retentionFreezeUntil DateTime?` pauses the job for a tenant (litigation hold, SAR in progress).
- **Skip rule.** Any row referenced by an open legal hold record is skipped with a `legal_hold=true` tag in the manifest.

### 4.2 Soft vs Hard Delete

```text
User "Delete" in UI
    ↓
Application sets `deletedAt = NOW()` or transitions to terminal status
    ↓
Entity no longer appears in listings / APIs / reports
    ↓
[Wait retention window per §2]
    ↓
Retention job:
  1. Verifies no FK references still alive (e.g., invoice must not be referenced by unpaid PaymentAllocation)
  2. Writes signed manifest
  3. Hard DELETEs the row
```

Financial entities **never** pass step 3 before the full regulatory window has elapsed, even if a user pressed delete. Financial deletions are a myth in the UI; the record is simply removed from normal listings.

### 4.3 GDPR Right to Erasure ("Right to be Forgotten")

Flow when a data subject submits a valid erasure request:

1. Validate identity per [incident response](../05-security/incident-response.md).
2. Open a **litigation hold** to prevent the normal retention job from touching the data during the review.
3. Classify the request:
   - **Personal data (non-financial):** name, email, phone, avatar, etc. → delete or pseudonymize within 30 days.
   - **Financial data (invoices, payments, meter readings):** retain until statutory window closes; inform the requester with the legal basis and the deletion date.
   - **Data required for contract/potential litigation:** retain with documented legal basis.
4. Write an `AuditLog (action = GDPR_ERASURE_COMPLETED)` with a signed manifest of affected records.
5. Notify the requester in writing.
6. Lift the litigation hold.

### 4.4 Tenant Churn

When an organization cancels and does not renew:

| Phase | What happens |
|---|---|
| Suspend (day 0) | `Organization.status = SUSPENDED`; write-only API disabled; read-only UI |
| Retain (days 0–90) | Full row data retained in warm storage; organization admin can re-activate |
| Soft archive (day 90) | `status = CANCELLED`; UI access removed; all user sessions revoked; API keys rotated |
| Cold retention (day 90 → end of retention) | Export immutable copy to compliance archive; all rows remain in DB with `deletedAt` set for most operational data, but financial data untouched |
| Final purge (end of retention window, default 7y post-cancellation) | Hard delete of all rows per [tenant purge flow](./tenant-isolation.md#10-data-purging), plus signed manifest, plus deletion of exported cold archive's encryption key envelope |

All phases emit platform-level `AuditLog` events.

---

## 5. Object Storage Retention (Documents)

Files stored in object storage (PDF invoices, receipts, property photos, support attachments) follow the retention of their parent entity:

| Document type | S3 lifecycle |
|---|---|
| Invoice/Credit Note PDF | Immediately → Standard-IA after 30d → Glacier after 2 years → delete 10 years after PDF generated |
| Receipts/Payment PDFs | Same as payment row (7–10 years) |
| Property photos/lease agreements | Same as property/lease row |
| Support ticket attachments | Ticket closed + 3 years, then delete |
| Generated exports (CSV, Excel) | 14 days then delete; tenant can download or extend once to 30 days |
| Backups and manifests | See §3 |

Object storage lifecycle rules automatically transition classes and delete at the window. No human has permission to delete compliance-locked objects before the lock expires.

---

## 6. Audit and Reporting

### 6.1 Retention Run Manifest

Every run of the retention job writes:

```json
{
  "runId": "ret_20260920_040011_abc",
  "startedAt": "2026-09-20T04:00:11Z",
  "completedAt": "2026-09-20T04:15:33Z",
  "batches": [
    {
      "entity": "Notification",
      "window": "90 days",
      "count": 128541,
      "idsHash": "sha256:deadbeef...",
      "skippedLegalHold": 0,
      "skippedFrozen": 42
    }
  ],
  "totalHardDeletedRows": 145902,
  "totalExportedBytes": 1838744521,
  "manifestSignedBy": "retention-job@mytenant",
  "manifestSignature": "ed25519:..."
}
```

### 6.2 Quarterly Reporting

Compliance officer receives:
1. Storage growth per table (bytes, row count) from the last 4 quarters.
2. Top 10 organizations by data volume.
3. Deletion volume per entity for the quarter.
4. Open legal holds / SARs count and their ages.
5. Successful and failed backup restore test results.

---

## 7. Implementation Checklist

The following items must be implemented before the system processes production data:

- [ ] `deletedAt DateTime?` column present on every soft-deletable table per schema.
- [ ] Repository layer always filters `deletedAt IS NULL` unless `includeDeleted=true` is explicitly passed.
- [ ] Financial tables have application guardrails rejecting `DELETE` on rows that are within the retention window.
- [ ] Daily retention job deployed, idempotent, rate-limited.
- [ ] `retentionFreezeUntil` + litigation-hold ledger in the Organization (or a sibling `ComplianceHold` table).
- [ ] S3/object-storage lifecycle rules match §5.
- [ ] Backup retention policies per §3 are configured.
- [ ] Automatic weekly restore test exercises retained backups across the retention window (not just the latest one).
- [ ] GDPR erasure workflow documented in security runbook.
- [ ] Organization cancellation / suspension / archival flow (§4.4) is automated.
- [ ] Tenant purging per [tenant-isolation.md §10](./tenant-isolation.md#10-data-purging) is implemented and tested.

---

## 8. Per-Jurisdiction Override Reference

These are illustrative guidance only. The legal counsel of record must confirm the retention window for each jurisdiction the SaaS operates in.

| Jurisdiction | Accounting/Tax | Utility Metering | Employment-style docs | Access logs |
|---|---|---|---|---|
| United States (IRS/SOX scope) | 7 years | Varies by PUC | 4 years | 12 months minimum |
| United Kingdom (HMRC) | 6 years from end of tax year | Statutory instrument varies | 6 years | 12 months (GDPR default) |
| Germany (Finanzamt / HGB) | 10 years (GoBD) | 10+ years | 6 years | 4 weeks max (§28 BDSG-new) |
| France (DGFiP) | 10 years | 10 years | 5 years | 12 months |
| Sweden (Skatteverket) | 7 years | 10 years | 5 years | 12 months |
| Netherlands (Belastingdienst) | 7 years | Per utility | 7 years | 12 months |
| EU-wide (GDPR floor) | No later than necessary for purpose | No later than necessary for purpose | Same | Not exceeding necessary; default 12m, justified only longer |

For international tenants, the default system rule is: **retention = longest applicable retention window among jurisdictions declared on the Organization record, with a floor of 7 years for financial rows, 10 years for utility/metering rows.**
