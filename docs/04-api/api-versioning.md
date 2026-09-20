# API Versioning

## Versioning Strategy

myTenant Invoice uses **dual-axis versioning**:

1. **URL path version** for breaking changes to the resource model (`/v1/`, `/v2/`).
2. **API version header / webhook api_version field** for date-stamped micro-versions controlling non-structural-but-incompatible behavior changes (e.g. default sort order, currency rounding semantics, validation strictness).

This dual strategy gives us:
- Predictable stable URLs (you can hard-code `/v1/organizations/...`).
- Fine-grained opt-in to new default behaviors without forcing bulk migration work.

All breaking changes are announced via the CromStel Developer Changelog (changelog@cromstel.com mailing list, dashboard RSS, Slack Developer Community) **no less than 12 months before the prior version is sunset**.

---

## URL Path Version (Major Versions)

The path prefix `/v1/` indicates the current major version. Upcoming `/v2/` (roadmap ETA Q1 2026) will introduce:
- Native ISO 20022 payment initiation support
- Revised invoice model supporting consolidated (multi-tenant) invoices
- gRPC + Protocol Buffers transport alongside REST/JSON

### Version Support Matrix

| Version  | Released       | Deprecation Announced | End of Life      | Status
|----------|----------------|-----------------------|------------------|-----------
| v0 (Beta)| 2022-11-01     | 2024-01-15            | 2024-07-15       | Retired
| **v1**   | **2024-03-01** | —                     | ≥ 2027-03-01     | **Current (GA)**
| v2       | Q1 2026        | (on release)          | ≥ 2029-Q1        | Roadmap

During the 12-month deprecation window, deprecated endpoints still work but return a warning response header:
```
X-Deprecated: true
X-Deprecation-Message: Endpoint POST /v0/charges will be removed 2024-07-15. Use /v1/payments/intent instead.
X-Sunset-Date: Mon, 15 Jul 2024 00:00:00 GMT
Link: <https://docs.mytenant-invoice.cromstel.com/migrations/v0-to-v1>; rel="deprecation"
```

If you see `X-Deprecated: true`, schedule migration before the `Sunset-Date`.

---

## Date-Stamped API Versions (Micro-Versions)

Use the request header `API-Version: YYYY-MM-DD` to pin behavior to a specific release date. If omitted, your organization defaults to the API version configured in **Developer Settings → Default API Version** (set when the org was created, unless an admin changed it).

### Currently Supported Date Versions

| Date Version | Key Changes Introduced
|--------------|------------------------------------------------------------------
| `2024-03-01`   | v1 GA launch baseline — original default behaviors
| `2024-05-15`   | **Breaking:** New customers created with `status=active` (was `pending`); use `?api_version=2024-03-01` for old behavior
| `2024-07-01`   | **Breaking:** Invoices created without `send_on_issue` default to `false` (was `true`)
| `2024-09-30`   | **Breaking:** `payment.method` enum splits `card` → `card_credit`, `card_debit`, `card_prepaid`; legacy callers see unified `card` only on older versions
| `2024-12-01`   | **Breaking:** Invoice `grand_total` now includes rounding adjustment at line-item level (sums match to mill); legacy version rounds at total only
| `2025-03-01`   | **Current default for new orgs** (stable as of this doc revision)

### How to Pin

Every request you make to CromStel should include the header:
```
API-Version: 2025-03-01
```

This guarantees that when we roll out a new date-version default for new orgs, **your existing code does NOT change behavior**.

### Request Example

```http
POST /v1/organizations/org_01HF92B6T7XN578Q5WV9QNBG0/customers HTTP/1.1
Authorization: Bearer <jwt>
API-Version: 2024-03-01
Content-Type: application/json

{ "name": "Acme Corp", "email": "finance@acme.example" }
```

Response includes the effective API version for debugging:
```
API-Version: 2024-03-01
X-API-Version-Effective: 2024-03-01
```

If you request a date-version we don't recognize, response is:
```
400 Bad Request
{
  "error": {
    "code": "api_version_unknown",
    "message": "API version '2027-99-99' is not supported",
    "details": [{ "known_versions": ["2024-03-01", "2024-05-15", "..."] }]
  }
}
```

---

## Webhook API Versions

Webhook behavior is pinned per-subscription at the time you create the webhook:

```json
{
  "url": "https://erp.example.com/mytenant/webhook",
  "events": ["invoice.paid"],
  "api_version": "2024-09-30"
}
```

The payload schema and event field names are **frozen** to that date-version. CromStel will continue to POST in that format for the lifetime of your subscription, even when we ship v2 and later versions with a revised default payload.

**To upgrade webhooks** to new payload shapes, update the subscription:
```
PATCH /v1/webhooks/wh_01HF93B7X5K7N9P1Q3S5T7V9X1
{ "api_version": "2025-03-01" }
```

We recommend upgrading one subscription at a time in staging, then production, to avoid all event shape changes hitting simultaneously.

---

## Definition of "Breaking Change"

We consider the following **breaking changes** and therefore only introduce them in a new URL path version or new date-version (never silently rolled out without opt-in):

### Structural / Contract Breaks

1. **Removing** or **renaming** a documented field, endpoint, HTTP verb, query parameter, header.
2. **Narrowing** a field type (e.g. integer → string of digits is non-breaking; string of digits → pure integer is breaking if you had non-digit values).
3. **Adding required** request parameters or JSON fields (always add optional-only in existing versions).
4. **Changing HTTP status code** for success cases (e.g. 201 → 200 is breaking).
5. **Changing error code** strings (we may add new codes, but never rename existing ones within a version).
6. **Tightening validation:** previously-accepted inputs now rejected (e.g. new email regex pattern that rejects some legacy edge cases).
7. **Changing default sort order** on paginated endpoints (will cause different page boundaries).
8. **Changing enum values:** shrinking the set of accepted values for `status`, `method`, etc.

### Non-Breaking Changes

These can be deployed to existing versions at any time:

1. **Adding optional** request fields, query params, headers.
2. **Adding fields** to response JSON (clients must ignore unknown fields — parse strictly for known schema only).
3. **Adding values to enums** (e.g. new payment method `method=bank_transfer_uk_fps`).
4. **Extending max limits** (e.g. raising page size from 500 to 1000).
5. **Loosening validation** (accepting longer strings or more flexible formats).
6. **New endpoints** or **new webhook event types** (you won't receive new events unless you subscribe to them).
7. **Cosmetic:** improving human-readable `message` strings (you should program against `error.code`, not `message`).
8. **Performance/caching:** adding CDN layers, adjusting ETag / Last-Modified.

---

## Migration Guides

### v0 → v1 Migration Summary

Top 5 breaking changes retired from `/v0/` July 2024:

| Item               | v0 (Old)                               | v1 (Current)                                           |
|--------------------|----------------------------------------|--------------------------------------------------------|
| Auth               | `Authorization: Bearer <long-lived-api-key>` directly | Exchange key for short JWT via `/auth/token`       |
| Charges endpoint   | `POST /v0/charges` flat model          | `POST /v1/payments/intent` + `POST /v1/payments/{id}/confirm` (PSD2/SCA-ready) |
| Currency units     | Floats `1850.50` (JSON number)         | Minor-unit integers `185050` + `currency_code`        |
| Pagination         | Offset `page=2&per_page=50` only       | Cursor-based default + optional offset page[number]   |
| Error envelope     | Flat `{code,message}`                  | Nested `{error:{code,message,details[],links{}}}`     |

### v1 → v2 Migration (Preview / Draft — expected Q1 2026)

Planned changes:

| Concern                 | v1 (Behavior)                              | v2 (Target)
|-------------------------|--------------------------------------------|--------------------------------------
| Transport               | REST JSON only                             | REST JSON + gRPC Protobuf (binary, higher throughput)
| Invoices model          | 1 invoice = 1 customer + 1 lease default   | Consolidated invoices (multiple customers/units per invoice) supported natively
| Payments                | PSP adapters via REST calls                | ISO 20022 pain.001/pacs.008 native messages for bank rails
| Line items              | Flat `description` string                  | Structured `charge_component` (rent, utilities, taxes, fees, amortization split) for GL accounting
| Async jobs              | Poll status endpoint                       | Bi-directional webhooks + Server-Sent Events stream

A full migration script + OpenAPI diff tool will ship 90 days before v2 GA.

---

## SDK Version Handling

Official CromStel SDKs (Node, Python, Go, Ruby, Java) pin by default to the date-version they were released with, and expose a configuration option:

```typescript
// Node SDK
import { MyTenantClient } from '@cromstel/mytenant-invoice';
const client = new MyTenantClient({
  apiKey: process.env.MYTENANT_API_KEY,
  apiVersion: '2025-03-01',    // Explicit pin (RECOMMENDED)
  // If unset: SDK ships with tested default; may be newer than your org default
});
```

When upgrading SDK versions in your `package.json`/`requirements.txt`, always check the GitHub Release Notes for changes to the default api-version the SDK pins to — you may need to explicitly keep your existing pin value.

---

## Deprecation & Sunset Communication Cadence

For any URL-path version or date-version deprecation:

| Event                              | Timing                                | Channel
|------------------------------------|---------------------------------------|------------------------------------
| Pre-announcement                   | T-18 months (roadmap blog post)       | Blog, Dev Community Slack
| Official deprecation announcement  | T-12 months                           | Email (all org owners + dev contacts), changelog entry, dashboard banner
| First auto-warning in responses    | T-9 months (X-Deprecated headers start appearing on deprecated endpoints) | HTTP headers (visible to integrators)
| Webinar / office hours             | T-6 months, T-3 months                | Invite to all affected orgs
| Rate-limit tightening on deprecated version | T-1 month                  | 50% quota reduction to encourage migration
| SUNSET — hard 410 Gone responses   | T-0                                   | All calls return `error: version_retired` with migration link
| Emergency bypass (Enterprise only) | T+0 — T+3 months                      | Open support ticket for 90-day extension (one-time)

---

## Testing Future Versions

To prepare integrations before a date-version becomes the default, test in Sandbox by simply setting `API-Version: <upcoming-date>` header against sandbox API. We expose upcoming date versions in Sandbox **60 days before GA** so you can regression test safely.

```bash
# Example: test upcoming 2025-06-01 behavior in sandbox
curl https://sandbox-api.mytenant-invoice.cromstel.com/v1/invoices \
  -H "Authorization: Bearer $SANDBOX_JWT" \
  -H "API-Version: 2025-06-01" \
  -H "X-Experimental: true"
```

`X-Experimental: true` grants access to WIP date versions that are not yet finalized (responses may still change — not for production).
