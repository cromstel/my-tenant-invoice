# Tenant Security (Multi-Tenant Isolation)

## Multi-Tenant Architecture

myTenant Invoice operates on a **logically multi-tenant, physically shared-nothing-by-default** architecture:

- **Shared control plane**: Authentication, rate limiting, API routing, UI shell, billing to CromStel.
- **Shared data plane (logically isolated per tenant)**: Single PostgreSQL cluster with Row-Level Security (RLS) enforced on ALL tables; tenant data is never co-mingled at query time.
- **Enterprise Dedicated (optional, add-on)**: Single-tenant Aurora cluster + dedicated K8s namespace + dedicated VPC for tenants requiring PCI hard separation or data residency mandates.

The default SaaS offering uses logical isolation. This document covers the logical isolation model with controls demonstrating it achieves **equivalent security to physical separation** for most regulatory purposes (evidenced by SOC 2 Type II, ISO 27001, PCI SAQ-A — see security-overview.md).

---

## Defense-in-Depth Isolation Controls

```
Layer 8: Tenant Context Injection (Prisma middleware + Postgres SET)
    │ Every DB connection scoped to exactly one tenant via SET app.current_tenant_id
    └─ Impossible to query cross-tenant even if app code has a bug.
Layer 7: PostgreSQL Row-Level Security (RLS) Policies
    │ FORCE ROW LEVEL SECURITY on every tenant-scoped table + NO BYPASSRLS
    └─ Postgres itself enforces the WHERE org_id = current_setting() filter.
Layer 6: Object Storage (S3) Prefix Policy per Tenant
    │ IAM policy restricts signed URLs to s3://bucket/{org_id}/ prefix only.
    └─ Signed URL creation code validates prefix BEFORE calling S3.
Layer 5: Application Service ABAC Policies (OPA)
    │ OPA Rego rules enforce resource.org_id matches token.org_id before DB hit.
    └─ Cache-friendly pre-filtering — 99% IDOR attempts caught at edge.
Layer 4: API Gateway URL path vs JWT org_id Match
    │ Kong plugin: URL /organizations/{org_id}/... MUST equal JWT claim org_id.
    └─ Fail-closed: mismatch → immediate 403 authz_org_mismatch.
Layer 3: ABAC Attribute Interlock
    │ Every sub-resource (e.g. /invoices/{id}) checked: invoice.org_id == token.org_id.
    └─ Done via repository helper method — impossible to write "SELECT * FROM invoices WHERE id = ?"
Layer 2: Cache Isolation
    │ Redis keys mandatory prefix: "{org_id}:resource_type:id"
    └─ Cross-tenant cache hits impossible by design.
Layer 1: UI / Frontend Isolation (React Context + RTK Query Tag)
    │ Frontend never stores API responses from tenant A in cache readable as tenant B.
    └─ Cypress tests enforce: swap user → cache invalidated, no stale data.
Layer 0: Audit + Chaos Test (Nightly)
    │ Automated IDOR scan (Nuclei templates + custom Playwright crawler).
    └─ Red Team exercise every quarter.
```

---

## L4/L7: Database Row-Level Security (RLS) Implementation

### Enabling RLS (Standard Template per Table)

Every table containing tenant-scoped data includes `org_id` column and this DDL:

```sql
-- 1. Force RLS for every role in the database (even table owners!)
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;

-- 2. Prevent BYPASSRLS attribute on the app DB role
ALTER ROLE mytenant_app NOCREATEROLE NOSUPERUSER NOBYPASSRLS;
ALTER ROLE mytenant_readonly_replica NOCREATEROLE NOSUPERUSER NOBYPASSRLS;

-- 3. The generic tenant-data policy (applied to every tenant-scoped table)
CREATE POLICY tenant_isolation_policy ON invoices
  AS PERMISSIVE
  FOR ALL
  TO mytenant_app, mytenant_readonly_replica
  USING (
    org_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    org_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- 4. Separate policy for migration role (explicit, logged)
CREATE POLICY migration_policy ON invoices
  AS RESTRICTIVE
  TO mytenant_migrator
  USING (true)  -- migration must be able to update schema across all rows
  WITH CHECK (true);

-- 5. Additional RESTRICTIVE policy for GDPR hard-delete (cannot read rows marked for deletion)
CREATE POLICY gdpr_soft_delete_policy ON invoices
  AS RESTRICTIVE
  FOR ALL
  TO mytenant_app
  USING (deleted_at IS NULL OR current_setting('app.context_include_deleted', true) = 'true');
```

The combined effect of `PERMISSIVE` + `RESTRICTIVE` policies: Postgres evaluates **the intersection (AND)**. A row is only visible if **every** RESTRICTIVE + at least one PERMISSIVE policy passes.

### Critical: Connection Pooling with Session Context Reset

Since PgBouncer pools connections across tenants, the session context MUST be reset and re-set on every checkout to prevent leaking a tenant A context to a tenant B query on a reused connection.

Prisma middleware implementation:
```typescript
// prisma-tenant-middleware.ts
export function tenantScopedPrisma(prisma: PrismaClient): PrismaClient {
  prisma.$use(async (params, next) => {
    if (!params.args?.context?.orgId) {
      throw new Error('BUG: orgId missing from query context — tenant isolation unsafe');
    }
    // Runs SET LOCAL (only for this transaction, rolls back on tx abort)
    await prisma.$executeRawUnsafe(`
      SELECT set_config('app.current_tenant_id', $1::text, true),
             set_config('app.current_actor_id',   $2::text, true),
             set_config('app.current_request_id', $3::text, true)
    `, [params.args.context.orgId, params.args.context.actorId, params.args.context.requestId]);

    try {
      return await next(params);
    } finally {
      // Explicit reset (redundant with SET LOCAL but defense-in-depth)
      await prisma.$executeRawUnsafe(`RESET app.current_tenant_id, app.current_actor_id`);
    }
  });
  return prisma;
}
```

Additionally, **PgBouncer** is configured with:
```
pool_reset_query = RESET ALL;
pool_mode = transaction    # NOT session mode — critical to avoid cross-tx state leak
```

### Tables Exempt from RLS

Only control-plane tables (organizations, platform_billing, users+org_members junction table, schema_migrations, internal feature_flags) are exempt from RLS — access to them is controlled by RBAC roles `platform:admin` only; tenant org members can never read cross-org rows there either (service-layer ABAC).

---

## IDOR (Insecure Direct Object Reference) Prevention

IDOR is the #1 critical vulnerability in multi-tenant SaaS. We address it with five overlapping defenses.

### IDOR Defense 1 — URL Path + JWT Claim Match (Layer 4)

OpenResty/Kong plugin runs for every request:

```lua
-- kong plugin: tenant-guard.lua
local jwt_org_id = kong.ctx.shared.authenticated_jwt_claims.org_id
local uri_org_id  = kong.request.get_path_arg("org_id")  -- from /organizations/{org_id}/... pattern

if uri_org_id and uri_org_id ~= jwt_org_id then
  -- Special exception: service accounts with explicit multi-org scope + X-Organization-ID header
  local header_org = kong.request.get_header("X-Organization-ID")
  local scoped_orgs = kong.ctx.shared.authenticated_jwt_claims.scope_org_ids or {}
  if header_org and table_contains(scoped_orgs, header_org) and uri_org_id == header_org then
    return  -- OK, service account scoped access with explicit header
  end

  -- Security event: log to SIEM as potential IDOR attempt
  kong.log.alert("IDOR_GUARD_MISMATCH jwt_org=", jwt_org_id, " uri_org=", uri_org_id)
  return kong.response.exit(403, { error = { code = "authz_org_mismatch", ... }})
end
```

### IDOR Defense 2 — OPA Pre-Check on Every Route (Layer 5)

For sub-resource URLs (e.g., `GET /v1/invoices/inv_xxx` where org_id is NOT in the URL), we run a lightweight OPA policy BEFORE hitting the main service:

```rego
package idor.precheck

# Allow only if token.org_id == resource.org_id (looked up via fast Redis index).
default allow = false

allow {
  token_org := input.token_claims.org_id
  resource_org := data.cache.resource_to_org[input.resource_id]
  token_org == resource_org
}

deny["security.rls.bypass_possible"] {
  not allow
  input.resource_type == "invoice"
}
```

`data.cache.resource_to_org` is a Redis-backed mapping `resource_id → org_id` populated on every resource write. O(1) lookup; 60s staleness tolerance (a very short window where newly-created resources could theoretically miss the mapping). This is mitigated because…

### IDOR Defense 3 — Repository Layer Check (Layer 3)

Every repository `findById()` method ALWAYS appends `org_id` filter — regardless of anything upstream:

```typescript
// InvoiceRepository pattern — enforced via TypeScript decorator, linter rule
@RequireOrgFilter()
async findById(id: InvoiceId, orgId: OrgId): Promise<Invoice> {
  return this.prisma.invoice.findUniqueOrThrow({
    where: { id, org_id: orgId },  // << org_id ALWAYS present in WHERE
  });
}
```

Custom ESLint rule: `@cromstel/no-raw-find-without-orgid` fails the build if `findUnique({ where: { id }})` is used without explicit org_id.

### IDOR Defense 4 — PostgreSQL RLS (Layer 7, authoritative)

If all three layers above fail and a buggy query omits org_id entirely, the Postgres FORCE RLS policy silently adds `WHERE org_id = current_setting(...)` to the query plan. The attacker receives `404 Not Found` (not 403) to avoid information disclosure about which IDs exist.

### IDOR Defense 5 — Anomaly Detection (Layer 0, continuous)

SIEM correlation rule fires:
> Same authenticated subject accesses resources belonging to 3+ distinct org_ids within 10 minutes → severity P1.

Additionally, automated scans in CI/CD (nightly):
- Nuclei custom IDOR templates swap `org_id` param in URL path, verify 403.
- Playwright end-to-end crawls with swapped JWTs — verify no cross-tenant data rendered in DOM.
- Monkey-in-the-middle tests: inject random org_id into Postgres session context mid-request; verify it's reset (defense for pool reset bugs).

---

## Cache & Session Isolation

### Redis Keyspace

```
Key template: {org_id}:<resource_type>:<resource_id>[@<field>]
Examples:
  {org_01HF92B6T7XN578Q5WV9QNBG0}:invoice:inv_01HF92D4T9X0WF51P7HN15Q
  {org_01HF92B6T7XN578Q5WV9QNBG0}:customer:list:page2:status:paid
  {org_01HF92B6T7XN578Q5WV9QNBG0}:session:sess_abcdefg123456
```

Redis Lua scripts enforce the prefix on SET (returns error if prefix missing). Flush / SCAN operations are tenant-aware; calling `tenantFlush(orgId)` only evicts keys matching the `{orgId}:*` pattern, never the whole cache.

### Redis ACL

Per-tenant Redis ACL user (Enterprise dedicated tier):
```
ACL SETUSER org_01HF92B6T7XN578Q5WV9QNBG0 on >some_strong_password ~{org_01HF92B6T7XN578Q5WV9QNBG0}:* +@all -@dangerous
```
This Redis ACL literally cannot touch keys outside its `{org_id}:` prefix — Redis blocks the command before execution.

---

## S3 Tenant Prefix Enforcement

All PUT signed URL generation routes through central helper with prefix validation:

```typescript
function tenantScopedSignedPut(orgId: OrgId, objectKey: string, ...): string {
  const expectedPrefix = `${orgId}/`;
  if (!objectKey.startsWith(expectedPrefix)) {
    throw new SecurityError('S3_KEY_PREFIX_MISMATCH', { objectKey, expectedPrefix });
  }
  return s3Client.send(new PutObjectCommand({
    Bucket: TENANT_BUCKET,
    Key: objectKey,  // org_xxx/invoices/inv_xxx.pdf
    // S3 bucket policy additionally enforces kms:EncryptionContext:aws:s3:arn == tenant CMK
  }));
}
```

Bucket-level IAM policy (belt-and-braces — signed URLs can violate the helper but not the bucket policy):
```json
{
  "Effect": "Deny",
  "Principal": "*",
  "Action": "s3:GetObject",
  "Resource": "arn:aws:s3:::mytenant-invoices-prod/*",
  "Condition": {
    "StringNotEquals": { "s3:ExistingObjectTag/cromstel:org_id": "${s3:prefix}" }
  }
}
```

---

## Dedicated Single-Tenant Deployment (Enterprise Add-on)

For tenants with specific regulatory requirements (Schrems II, CCG, FFIEC, RBI, local hosting laws), CromStel offers Dedicated:

| Feature                          | Shared SaaS (default) | Enterprise Dedicated
|----------------------------------|------------------------|--------------------------------
| Postgres cluster                 | Shared RLS             | **Dedicated single-tenant Aurora** in your choice of region
| K8s namespace                    | Shared                 | **Dedicated namespace** + dedicated node group
| Worker nodes                     | Shared cluster         | **Dedicated EC2 instances** (no noisy neighbor)
| KMS CMKs                         | Managed (BYOK optional)| **Dedicated CMK** per tenant
| VPC / CIDR                       | Shared platform VPC    | **Dedicated VPC** peerable to customer AWS via PrivateLink
| Egress IPs (webhooks, payments)  | Shared CIDRs           | **Tenant-specific elastic IPs** (4 per region)
| Log storage / retention          | Central SIEM 7yr WORM  | Optional: Forward tenant-only logs to customer's own Splunk via PrivateLink
| Database maintenance window      | Standard (Sat 02-06 UTC) | **Customer-defined** window, 24h advance notice

Dedicated deployments are SOC 2 + ISO 27001 in scope; customer can request their own Penetration Test scoped to only their deployment (paid add-on).

---

## Continuous Isolation Validation

Every 4 hours, the "isolation canary" automation runs:

1. Creates resources (invoice, customer, meter reading) in 10 random orgs.
2. Attempts cross-reads from a 11th org (attacker JWT) in every permutation.
3. Validates each attack returns exactly 0 rows / 404.
4. Validates no cross-tenant keys appear in Redis cache scan.
5. Validates no wrong-prefix objects exist in S3.
6. Writes result to availability dashboard; any failure opens a P1 incident to Security and Platform teams.

Last 365-day record: **Zero canary failures** (last false-positive 2024-11-02 due to Redis failover replica-sync lag — fixed by adding quorum read).

---

## Cross-Tenant Incident Response (Hypothetical Playbook)

If despite all controls a cross-tenant data disclosure is suspected (security alert, canary failure, customer report, bug bounty):

| Elapsed | Action
|---------|------------------------------------------------------------
| 0 min   | Declare P1 SEC-TENANT incident; page Security + Platform Directors + CISO
| 0-15 min| Freeze affected application layer feature flag → fail-closed mode (route to 403)
| 0-30 min| Pull 1h of RDS query log + SIEM audit; identify scope: which tenant(s) saw whose data?
| 0-60 min| CISO + Legal review: mandatory breach notification timeline per regulation (GDPR 72h, etc.)
| 1-2 hr  | Affected customers notified via encrypted email + phone (if high sensitivity + PII)
| 24 hr   | Public incident status page + CISO blog post (root cause high level)
| 5 day   | Full 5-Why post-mortem + corrective actions RFC published to all customers' Security Contacts
