# Errors

## HTTP Status Codes

| HTTP Status | Category                        | Typical Cause
|-------------|---------------------------------|------------------------------------------------------------------
| 200 OK      | Success                         | GET/DELETE/PUT/PATCH succeeded
| 201 Created | Resource created                | POST created a new resource; Location header set
| 202 Accepted| Async processing                | Request queued for async processing (e.g. batch invoice generation
| 204 No Content | Delete succeeded             | Body empty
| 301/308     | Redirect                        | URL moved; update your client
| 400 Bad Request | Client validation           | Invalid JSON, missing required fields, bad enum
| 401 Unauthorized | Authentication            | Bad/missing/expired token, MFA challenge
| 403 Forbidden | Authorization                 | Insufficient role/scope/ABAC, org mismatch
| 404 Not Found | Missing resource              | ID doesn't exist, or caller lacks permission to see it (no 403 leakage)
| 405 Method Not Allowed | Wrong verb              | e.g. PUT on collection
| 406 Not Acceptable | Content negotiation       | Accept header unsupported; we only return application/json
| 409 Conflict | State conflict                | Optimistic lock version mismatch, duplicate unique key, state transition invalid (e.g. void already-paid invoice)
| 410 Gone | Resource deleted               | Previously existed, now hard-deleted
| 413 Payload Too Large | Body exceeds limit          | Max 10MB per request
| 415 Unsupported Media | Content-Type not JSON         | application/json required unless multipart
| 422 Unprocessable Entity | Semantic validation      | Syntactically OK but business rule violation
| 426 Upgrade Required | HTTPS required             | Sent when HTTP used; must use TLS
| 428 Precondition Required | Idempotency key missing   | Required on some POST endpoints (dual-write safety)
| 429 Too Many Requests | Rate limit exceeded       | See rate-limits.md
| 451 Unavailable For Legal Reasons | Legal block              | Region-sanctioned IP / data-blocked by court order
| 500 Server Error | Platform bug                  | Unexpected error; X-Request-ID included for support
| 502 Bad Gateway | Upstream issue                | Load balancer; auto-retry with backoff
| 503 Service Unavailable | Degraded / maintenance      | Retry after Retry-After header seconds
| 504 Gateway Timeout | Long-running query timeout    | Paginate or reduce scope; or retry

## Error Response Body (Standard Format)

**Always** application/json, envelope style:

```json
{
  "error": {
    "code": "invoice_already_paid",
    "message": "Cannot void an invoice that has been paid in full.",
    "request_id": "req_01HF93G4A9920Q434Z4D9579M2",
    "type": "business_logic",
    "status": 409,
    "doc_url": "https://docs.mytenant-invoice.cromstel.com/errors#invoice_already_paid",
    "details": [
      {
        "field": "invoice.status",
        "value": "paid",
        "reason": "expected status draft or issued",
        "suggestion": "Issue a refund + credit note instead."
      }
    ],
    "links": {
      "refund_invoice": "https://api.mytenant-invoice.cromstel.com/v1/invoices/inv_01HF92D4T9X0WF51P7HN15Q/refund",
      "create_credit": "https://api.mytenant-invoice.cromstel.com/v1/invoices/inv_01HF92D4T9X0WF51P7HN15Q/credit"
    }
  }
}
```

### Top-Level Fields

| Field         | Always Present | Type    | Description
|---------------|----------------|---------|---------------------------------
| `error.code`       | Yes            | string  | Stable, machine-readable snake_case identifier. Program against this, NOT `message`.
| `error.message`    | Yes            | string  | Human-readable English message. Do NOT parse for logic.
| `error.request_id` | Yes            | string  | Correlation ID for support tickets / log lookup
| `error.type`       | Yes            | enum    | `validation` \| `authentication` \| `authorization` \| `business_logic` \| `rate_limit` \| `network` \| `internal`
| `error.status`     | Yes            | int     | Echo of HTTP status
| `error.doc_url`    | Yes            | url     | Deep-link to error code documentation page
| `error.details`    | No             | array   | Validation/business rule field-level errors (0..N)
| `error.links`      | No             | object  | HATEOAS-style remedial action URLs (safe follow)

## Error Code Catalog

### Validation Errors (type=validation, status 400 / 422)

| Code                          | Message Pattern                                                                      |
|-------------------------------|--------------------------------------------------------------------------------------|
| `validation_required`         | "Field '{field}' is required"                                                        |
| `validation_type`             | "Field '{field}' expected type '{expected}', got '{actual}'"                         |
| `validation_format`           | "Field '{field}' format invalid: {pattern}"                                          |
| `validation_min_length`       | "Field '{field}' must be at least {n} characters"                                    |
| `validation_max_length`       | "Field '{field}' must be at most {n} characters"                                     |
| `validation_min`              | "Field '{field}' must be >= {n}"                                                     |
| `validation_max`              | "Field '{field}' must be <= {n}"                                                     |
| `validation_enum`             | "Field '{field}' must be one of {values}"                                            |
| `validation_pattern`          | "Field '{field}' does not match pattern {regex}"                                     |
| `validation_email`            | "Field '{field}' is not a valid email address"                                       |
| `validation_unique`           | "A resource with '{field}={value}' already exists in this organization"              |
| `validation_reference`        | "Referenced {resource} '{id}' does not exist or is outside scope"                    |
| `validation_date_order`       | "{field_a} must precede {field_b}"                                                    |
| `validation_currency_mismatch`| "All line items must use invoice currency '{currency_code}'"                          |
| `validation_unsupported_country` | "Country '{cc}' not supported for {feature}"                                      |

### Authentication Errors (type=authentication, status 401)

| Code                        | Meaning
|-----------------------------|------------------------------------------------------------------
| `auth_missing`              | Authorization header missing
| `auth_bad_scheme`           | Expected 'Bearer' scheme
| `auth_token_malformed`      | JWT structural decode failure
| `auth_token_expired`        | exp claim elapsed; use /auth/refresh
| `auth_token_not_yet_valid`  | nbf claim still future
| `auth_invalid_signature`    | Bad EdDSA signature or alg != EdDSA
| `auth_token_revoked`        | JTI on revoked bloom list
| `auth_aud_mismatch`         | aud claim doesn't match API audience
| `auth_iss_mismatch`         | Unknown issuer
| `auth_locked`               | User/API key disabled by admin or brute-force lock
| `auth_mfa_required`         | MFA challenge required for this login
| `auth_mfa_invalid`          | TOTP code wrong/replay
| `auth_sso_required`         | Org policy: SSO only, password login disabled
| `auth_device_expired`       | Device cookie stale; full re-login needed
| `auth_ip_rejected`          | Source IP not in token allowlist

### Authorization Errors (type=authorization, status 403)

| Code                             | Meaning
|----------------------------------|------------------------------------------------------------------
| `authz_role_denied`              | User's role lacks permission
| `authz_scope_denied`             | Token scope insufficient for operation
| `authz_constraint_violation`     | ABAC policy rejected (see details[].policy for rule name)
| `authz_org_mismatch`             | Resource belongs to different org_id
| `authz_tenant_isolation`         | Cross-tenant access blocked by RLS (security event)
| `authz_classification_denied`    | Data classification level exceeds clearance
| `authz_step_up_required`         | Sensitive operation: re-authenticate (links.step_up_url)
| `authz_geo_blocked`              | GeoIP policy disallowed region
| `authz_impersonation_denied`     | Impersonation not allowed for this target/action

### Business Logic Errors (type=business_logic, typically 409/422)

| Code                               | Scenario
|------------------------------------|------------------------------------------------------------------
| `invoice_already_paid`             | Void/delete attempted on fully paid invoice
| `invoice_not_editable`             | Modify line item on non-draft
| `invoice_issue_future_date`        | issue_date > 90 days in future
| `invoice_payment_overpayment`      | Payment(s) exceed grand_total
| `invoice_due_before_issue`         | due_date before issue_date
| `invoice_already_voided`           | Double void
| `lease_overlap`                    | New lease dates collide with existing on same unit
| `lease_not_active`                 | Generate invoice against terminated lease
| `meter_reading_rollback`           | New reading < last reading (requires allow_rollback:true flag)
| `meter_reading_delta_excessive`    | Usage > 10x mean (blocked; flag override for anomaly)
| `payment_insufficient_balance`     | Customer stored balance not enough
| `payment_method_expired`           | Card on file expired
| `payment_refund_over_limit`        | Refund amount exceeds captured amount
| `payment_dispute_already_filed`    | Duplicate dispute
| `customer_has_unpaid_invoices`     | Archive customer blocked by open balances
| `property_has_active_leases`       | Cannot delete/archive with active occupancy
| `report_too_large`                 | Report exceeds 1M rows / 500MB; refine filters
| `webhook_url_unreachable`          | Create/test fails: URL not 2xx from our probes
| `webhook_signature_invalid`        | (outbound webhook delivery) your endpoint reported invalid sig?
| `idempotency_mismatch`             | Same idempotency_key reused with DIFFERENT payload body

### Rate Limits (type=rate_limit, status 429)

| Code                          | Meaning
|-------------------------------|--------------------------------------
| `rate_limit_per_minute`       | Subject/IP minute quota
| `rate_limit_per_hour`         | Subject hourly quota
| `rate_limit_per_day`          | Subject daily quota
| `rate_limit_burst`            | Burst bucket exceeded
| `rate_limit_concurrent`       | Too many in-flight requests (50 default)
| `rate_limit_per_resource`     | Endpoint-specific throttle (e.g. report generation 10/hr)

### Internal Errors (type=internal, status 5xx)

| Code                             | Meaning
|----------------------------------|------------------------------------------------------------------
| `internal_error`                 | Generic unexpected error; open support ticket with request_id
| `db_timeout`                     | Database query timed out (>30s) — reduce filter scope
| `queue_full`                     | Async queue saturated (maintenance incident)
| `upstream_psp_timeout`           | Payment provider Stripe/Adyen timeout (idempotent retry safe)
| `encryption_kms_unavailable`     | KMS region outage; retry after Retry-After
| `feature_disabled_for_plan`      | Plan downgrade removed feature availability

## Error Details Structure (for validation)

When `type=validation` the `details[]` array enumerates every failing field:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "4 validation error(s) prevented request completion.",
    "type": "validation",
    "status": 422,
    "request_id": "req_01HF93KP62R5M6043B9H1159",
    "details": [
      {
        "code": "validation_required",
        "field": "line_items[1].description",
        "value": null,
        "message": "required"
      },
      {
        "code": "validation_min",
        "field": "line_items[0].unit_amount",
        "value": -1200,
        "message": "must be >= 0",
        "path_pointer": "/line_items/0/unit_amount"
      },
      {
        "code": "validation_email",
        "field": "customer.email",
        "value": "not-an-email",
        "message": "invalid email"
      },
      {
        "code": "validation_enum",
        "field": "status",
        "value": "cancelled",
        "message": "expected one of: draft, issued, paid, void",
        "allowed_values": ["draft", "issued", "paid", "void"]
      }
    ]
  }
}
```

`field` uses JS dot-notation; `path_pointer` provides an RFC 6901 JSON Pointer.

## Examples by Scenario

### Duplicate Unique Constraint

```json
{
  "error": {
    "code": "validation_unique",
    "message": "An invoice with number 'INV-2024-04-000123' already exists.",
    "status": 409,
    "request_id": "req_01HF93L1R2X5K8J7N0M9V4B6C2",
    "details": [
      {
        "code": "validation_unique",
        "field": "number",
        "value": "INV-2024-04-000123"
      }
    ],
    "links": {
      "list_invoices": "https://api.mytenant-invoice.cromstel.com/v1/organizations/org_01HF92B6T7XN578Q5WV9QNBG0/invoices?filter[number]=INV-2024-04-000123"
    }
  }
}
```

### State Transition Conflict

```json
{
  "error": {
    "code": "invoice_not_editable",
    "message": "Invoice is 'paid' — line items cannot be modified.",
    "status": 409,
    "request_id": "req_01HF93LCK50K49QJ2Z6T14W11X",
    "details": [
      {
        "field": "invoice.status",
        "value": "paid",
        "expected_values": ["draft"],
        "reason": "state machine disallows mutation from 'paid' via line_item add"
      }
    ],
    "links": {
      "create_credit": "https://api.mytenant-invoice.cromstel.com/v1/invoices/inv_01HF92D4T9X0WF51P7HN15Q/credit"
    }
  }
}
```

### Rate Limit Exceeded

```
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 42
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1710505000
```
```json
{
  "error": {
    "code": "rate_limit_per_minute",
    "message": "Per-minute rate limit of 1,000 requests exceeded. Retry after 42 seconds.",
    "type": "rate_limit",
    "status": 429,
    "request_id": "req_01HF93LL41Y7G3P0M6V2T7W4",
    "details": [
      {
        "scope": "subject:api_key:apk_01HF93LZ995B0E1Y5R6K2N1",
        "window_seconds": 60,
        "limit": 1000,
        "used": 1000,
        "retry_after_seconds": 42
      }
    ]
  }
}
```

## Handling Errors in Client Code (Pseudo-code)

```typescript
async function callApi<T>(method, url, body): Promise<T> {
  const resp = await fetch(BASE + url, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (resp.ok) return resp.json() as Promise<T>;

  let errPayload: any;
  try { errPayload = await resp.json(); } catch { errPayload = null; }

  const err = new MyTenantApiError(resp.status, errPayload?.error);

  // Handle specific retriable codes
  if ([429, 500, 502, 503, 504].includes(resp.status)) {
    const retryAfter = resp.headers.get('Retry-After')
      ? parseInt(resp.headers.get('Retry-After')!, 10)
      : (resp.status === 429 ? (errPayload?.error?.details?.[0]?.retry_after_seconds ?? 30) : jitter(5));
    if (attempt < MAX_RETRIES) {
      await sleep(retryAfter * 1000);
      return callApi<T>(method, url, body, attempt + 1); // idempotency key unchanged
    }
  }
  throw err;
}
```

## Opening a Support Case

When emailing support@cromstel.com, include:
1. The `request_id` from the error payload
2. Timestamp (UTC) of the request
3. Endpoint + HTTP verb
4. The `error.code` you received
5. Expected behavior vs actual

We retain full trace logs for 30 days by request_id.
