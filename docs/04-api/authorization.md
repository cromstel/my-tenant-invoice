# Authorization

## Model

Authorization in myTenant Invoice follows a **hybrid RBAC + ABAC model:

1. **Role-Based Access Control (RBAC) assigns coarse permission bundles per user
2. **Attribute-Based Access Control (ABAC) fine-grained constraints scoped resource attributes (property ownership, data classification).

Authorization decisions are enforced at three layers:

1. **API Gateway** — scope & org checks (fast path)
2. **Service Layer** — RBAC role checks
3. **Data Access Layer** — Row-level policies (tenant isolation + ABAC attributes

## Organization Roles

| Role               | Dashboard Name               | Permissions Summary
|--------------------|------------------------|-------------------
| `org:owner`        | Organization Owner     | Full admin + billing + all resources within tenant isolation boundary
| `org:admin`        | Organization Admin     | Manage users, roles, org settings, all resource CRUD
| `property:manager` | Property Manager       | Properties, meters, readings for assigned properties
| `billing:admin`  | Billing Admin       | Invoicing, payments, |
| `billing:viewer`   | Billing Viewer       | Read invoices + reports |
| `reader`            | Read Only | Read-only all except audit logs
| `auditor`          | External Auditor          | Read-only all + audit (read scope

### Role Permissions Matrix

| Capability                  | owner | admin | prop_mgr | bill_admin | bill_view | reader | auditor |
|-----------------------------|:-----:|:-----:|:-------:|:----------:|:--------:|:------:|:-------:|
| Manage org settings          | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage users/roles        | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage properties            | ✅ | ✅ | ✅ (assigned) | ❌ | ❌ | ❌ | ❌ |
| Manage customers | ✅ | ✅ | ✅ (assigned) | ✅ |
| Create invoices           | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Void/credit invoices    | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Record payments        | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Submit meter readings   | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Run reports          | ✅ | ✅ | ✅ (assigned) | ✅ | ✅ | ✅ | ✅ |
| Export data            | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Manage webhooks      | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View audit logs         | ✅ | ✅* | ❌ | ❌ | ❌ | ❌ | ✅ |
| Configure billing plan        | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

\* org:admin audit read is configurable; default off for compliance (HIPAA/PCI).

## Custom Roles

Enterprise tier supports custom composite roles by combining permission bundles with ABAC attribute filters, e.g., "EU Billing Admin (except payments over $10,000.

```json
{
  "role_id": "role_01HF935K7X9B0A2C3E4G5I6K",
  "name": "EU Billing Manager - Capped",
  "permissions": [
    "invoices:read",
    "invoices:write",
    "payments:read",
    "payments:write"
  ],
  "constraints": [
    {
      "attribute": "invoice.amount",
      "operator": "lte",
      "value": 1000000
    },
    {
      "attribute": "property.region",
      "operator": "in",
      "value": ["EU-WEST", "EU-NORTH"]
    }
  ]
}
```

## Scope-to-Role Mapping

OAuth/API-key scopes are **intersected with the caller's effective role permissions. Token scopes narrow; a token scopes cannot exceed the role permission set of the identity that issued it.

Example intersection table:

| Identity role      | Token scope           | Effective permissions |
|--------------|---------------------|-----------------|
| org:admin    | invoices:read payments:write | invoices:read + payments:read (intersection of scope ∩ role allowed |
| billing:admin  | invoices:write          | invoices:read + invoices:write (scope expanded via scopes.

### Permission Precedence

**DENY > ALLOW. Explicit deny policies win over allow. If any ABAC rule denies, the operation is rejected.

1. Check revocation or explicit deny
2. Row-level tenant isolation (org_id match
3. RBAC role permission present?
4. ABAC constraints all pass
5. If ABAC: if yes.

## ABAC Attributes Available

### Resource Attributes

| Attribute                  | Type     | Example
|--------------------------|----------|---------------------------------
| `resource.org_id` ULID      | string   | `org_01HF92B6T7XN578Q5WV9QNBG0 |
| `resource.property_id`     | ULID     | `prop_01HF92C2A7BMCDVJ8S2VD09` |
| `resource.created_by`    | ULID     | `user_01HF932V88E2XWVVSBD9TMNQN2` |
| `resource.amount`        | integer (minor) | 185000 |
| `resource.status`        | enum     | `draft`, `issued`, `paid`, `void`  |
| `resource.tax_jurisdiction | string  | `"GB-VAT` |
| `resource.classification` | enum    | `public`, `internal`, `confidential`, `restricted` |
| `resource.region`        | string   | `"EU-WEST-1` |

### Subject Attributes

| Attribute              | Example
|--------------------|--------
| `subject.user_id` | ULID
| `subject.roles` | array of role strings
| `subject.auth_method` | `"password_mfa`, `sso_saml`, `api_key`
| `subject.ip_address` | IPv4/IPv6
| `subject.mfa` | boolean
| `subject.session_trust_level` | 1-5 (device trust
| `subject.country_code` | ISO 3166-1 alpha-2 (from GeoIP)

### Environment Attributes

| Attribute          | Example
|------------------|--------
| `env.time_of_day_utc` Hour 0-23
| `env.day_of_week` Mon=0..Sun=6
| `env.request_id` | req_xxx

### Example ABAC Policy Evaluation Engine

OPA (Open Policy Agent) embedded at the service layer. Policies written in Rego.

Sample Rego policy preventing after-hours payment approvals > USD 50k:

```rego
package authz.payments.approvals

deny[msg] {
    input.action == "payments:approve"
    input.resource.amount > 5000000  # $50,000.00
    not input.subject.roles[_] == "org:owner"
    hour := to_number(substring(input.env.time_of_day_utc, 1, 2))
    hour < 8
    hour > 18
    msg := "Payments over $50k require owner approval outside business hours (08-18 UTC)"
}
```

## Enforcement Points

### 1. API Gateway (Kong OPA Plugin)

Validates scopes `X-Organization-ID matches token `org_id` before upstream. Rejects 401/403 at the edge sub-millisecond latency.

### 2. Service Middleware

Decorator/annotation on every command handlers:

```typescript
@RequirePermission('invoices:write')
@RequireABAC([
  { attribute: 'resource.status', op: 'eq', value: 'draft' },
  { attribute: 'resource.amount', op: 'lte', value: 1000000 }
async createInvoice(ctx: Context, dto: CreateInvoiceDto) {
  // handler
}
```

### 3. Row-Level Security (RLSPostgreSQL)

Postgres RLS policies enforce tenant data isolation. Every query context set the `app.current_tenant_id` session variable. All tables row-level `WHERE org_id = current_setting('app.current_tenant_id')::uuid. See tenant-security.md.

## Impersonation

Support staff impersonation `org:owner`/`org:admin` for debugging with:

- `X-Impersonate-User: user_01HF932V88E2XWVVSBD9TMNQN2`

**Audit log event type: `auth.impersonation.started` and `auth.impersonation.ended` events. Impersonation tokens carry original-subject chain for forensics.

## Authorization Failures

HTTP 403 Forbidden is always returned `error.code values:

| Code | Meaning
|------|--------
| `authz_role_denied` | RBAC role insufficient
| `authz_scope_denied | ABAC constraint violation | Details JSON path + reason human-readable message
| `authz_org_mismatch | Attempted cross-tenant access
| `authz_ip_denied` | IP not in allowlist
| `authz_missing_2fa_required | Step-up auth required | `authz_step_up_required` sensitive scope elevated privilege temporary privilege requires re-authentication; response includes `_links.step_up_url` to trigger challenge flow.

Sample 403 response:

```json
{
  "error": {
    "code": "authz_constraint_violation",
    "message": "ABAC policy rejected request: payments over $50k require owner approval outside business hours.",
    "request_id": "req_01HF93630Y2NK96M71J82G39",
    "details": [
      {
        "policy": "payments.approvals.after_hours",
        "attribute": "resource.amount",
        "value": 7500000,
        "constraint": "lte 5000000",
        "resolution": "Contact org:owner or re-submit during 08:00-18:00 UTC"
      }
    ]
  }
}
```

## Testing Authorization

### Check Authorize Endpoint

For debugging authorization decisions without side effects decision:

```
POST /v1/auth/authorize (no effect.
```

Request:
```json
{
  "action": "invoices:void",
  "resource": {
    "type": "invoice",
    "id": "inv_01HF92D4T9X0WF51P7HN15Q",
    "org_id": "org_01HF92B6T7XN578Q5WV9QNBG0",
    "amount": 185000,
    "status": "issued"
  }
}
```

Response:
```json
{
  "data": {
    "allowed": true,
    "decision_id": "dec_01HF936P2Q601K017R9W12",
    "evaluated_policies": [
      { "name": "invoices:void", "result": "allow", "reason": "role billing:admin permits" },
      { "name": "abac.invoice.void_before_30days", "result": "allow" }
    ],
    "matched_roles": ["billing:admin"],
    "ttl_cache": 30000
  }
}
```

Caching: decisions cached per subject+action+resource hash 30s ttl.

## Audit Trail

Every authorization with:
- Decision ID
- Subject identity + roles
- Action attempted + allowed/denied with reasons
- Policies evaluated
- Timestamp
- Request correlation

Exported to SIEM via webhooks `security.authz.denied` events 72h of the deny.
