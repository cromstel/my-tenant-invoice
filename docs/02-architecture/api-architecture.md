# API Architecture — Next.js Route Handlers + Server Actions

**Document ID:** ARCH-006
**Status:** Approved
**Version:** 1.0.0
**Last Updated:** 2026-09-20
**Author:** CromStel IT Group — Platform Architecture Team

---

## 1. Overview

myTenant Invoice exposes its capabilities through two tightly integrated API surfaces sharing identical service-layer backends:

1. **HTTP API (Next.js Route Handlers `/api/*`)** — for programmatic access, tenant-user payment portals, third-party webhook inbound traffic, and future public API release.
2. **Server Actions (Next.js `"use server"`)** — for same-origin UI mutations (React Server Components + forms). These are preferred for page-initiated actions to benefit from progressive enhancement, smaller client bundles, and implicit `Origin` check.

Both surfaces are layered:

```
Presentation (Route Handler / Server Action)
    ↓ Zod input validation + AuthZ (RBAC permission check)
Service Layer (domain logic, RLS via TenantContext)
    ↓
Repository Layer (Prisma RLS-scoped queries)
    ↓
MySQL 8
```

---

## 2. API Style & URI Conventions

### 2.1 REST-ish Resource Naming
- Nouns, plural kebab-case for collections.
- Nest sub-resources for strongly-owned relationships.
- Actions that don't map to CRUD use a trailing verb under the resource.

```
/api/v1/tenants/:id
/api/v1/properties
/api/v1/properties/:propertyId/buildings
/api/v1/leases/:id/terminate          # action (non-CRUD
/api/v1/invoices/:id/finalize
/api/v1/invoices/:id/send
/api/v1/invoices/:id/download-pdf
/api/v1/payments/:id/refund
/api/v1/reports/rent-roll             # report-style endpoints (not collections
```

### 2.2 Route Taxonomy by Audience

| Prefix | Audience | AuthN | AuthZ | Example |
|---|---|---|---|---|
| `/api/auth/*` | Auth.js managed | N/A | N/A | `/api/auth/callback/google |
| `/api/pay/*` | Anonymous end payer (tenant) | `invoiceId + nonce` | Invoice nonce match | `/api/pay/:invoiceId/intent` |
| `/api/v1/*` | Authenticated tenant users | Session JWT | RBAC per endpoint | `/api/v1/invoices` |
| `/api/platform/*` | Platform superadmins only | Session + PLATFORM_ADMIN claim + IP allow-list | Platform RBAC | `/api/platform/tenants` |
| `/api/webhooks/*` | External systems | HMAC signature + source CIDR | Signature check only | `/api/webhooks/stripe`, `/api/webhooks/email` |
| `/api/files/*` | Authenticated or signed URL | Session or short-lived token | RLS check | `/api/files/tenants/:tid/invoices/:invId.pdf` |
| `/api/internal/*` | Same-origin only (server actions equivalent, e.g. cron triggers) | Internal bearer token | Not exposed outside VPC | `/api/internal/cron/daily` |

### 2.3 Versioning Strategy
- URL path versioning `/api/v1/*`.
- v1 will be supported until v2 is GA + 12 months.
- Backward-compatible additive changes (new optional fields, new endpoints) do NOT bump version.
- Breaking changes → v2; both versions coexist behind feature flag during transition.

---

## 3. HTTP Verbs & Idempotency

| Verb | Purpose | Idempotent? | Typical Body |
|---|---|---|---|
| `GET` | Read single resource or list | Yes | (none; querystring) |
| `POST` | Create new resource / non-idempotent action | **No** | JSON body, `Idempotency-Key` header for writes that must be safe to retry |
| `PUT` | Full replace existing resource | Yes | JSON body |
| `PATCH` | Partial update (JSON Merge Patch semantics) | Yes | JSON body |
| `DELETE` | Delete/soft-delete resource | Yes | (none) |

### 3.1 Idempotency for Client-Safe Retries
All mutations accept the `Idempotency-Key: <client-generated-UUID>` header (recommended for POST). Key stored in Redis for 24 hours; the first response is cached and replayed without re-executing the write.

---

## 4. Request/Response Envelope Standard

### 4.1 Successful Response (2xx)

```jsonc
// GET /api/v1/invoices?page=1&limit=25
{
  "ok": true,
  "data": [ /* array of invoice DTOs */ ],
  "meta": {
    "requestId": "req_01J8KXYZ...",
    "pagination": { "page": 1, "limit": 25, "total": 142, "totalPages": 6 }
  }
}
```

```jsonc
// GET single / POST (create/update action success)
{
  "ok": true,
  "data": { /* single DTO */ },
  "meta": { "requestId": "req_01J8KXYZ..." }
}
```

Rules:
- `data` is always present and never mixed with error fields.
- `meta.requestId` is always returned; customers include it in support tickets.
- `meta.pagination` present only for list responses.

### 4.2 Error Response (4xx / 5xx)

```jsonc
{
  "ok": false,
  "error": {
    "code": "INVOICE_ALREADY_FINALIZED",       // stable machine-readable code
    "message": "Invoice inv_0123 is already finalized and cannot be modified.",
    "details": [                               // optional: field-level errors
      { "path": ["body", "dueDate"], "code": "invalid_date", "message": "Due date cannot be in the past." }
    ],
    "requestId": "req_01J8KXYZ...",
    "retryable": false                         // true for transient failures (5xx)
  }
}
```

### 4.3 Error Code Catalogue (Exemplar)

| HTTP | Code | Meaning |
|---|---|---|
| 400 | VALIDATION_ERROR | Zod schema violation; see `details` for per-field breakdown |
| 401 | UNAUTHENTICATED | Missing or invalid session; clear cookies and redirect to `/login` |
| 403 | PERMISSION_DENIED | Session valid but missing role/permission for this action |
| 403 | TENANT_SUSPENDED | Tenant org is suspended; writes blocked |
| 404 | NOT_FOUND | Resource does not exist (or user cannot see it — RLS makes these indistinguishable) |
| 404 | TENANT_NOT_FOUND | Platform endpoint only; tenant does not exist |
| 409 | CONFLICT | Optimistic lock (version mismatch), unique constraint violation, state transition invalid |
| 409 | OPTIMISTIC_LOCK | Stale version; client must re-read and retry |
| 422 | QUOTA_EXCEEDED | Tenant plan quota exceeded for this resource type |
| 429 | RATE_LIMITED | Too many requests; see `Retry-After` header |
| 500 | INTERNAL_SERVER_ERROR | Unexpected; always retryable=false but platform will investigate |
| 503 | DEPENDENCY_UNAVAILABLE | Upstream (Stripe, Resend, S3) unavailable; retryable=true |

---

## 5. Pagination, Sorting, Filtering

### 5.1 Pagination
All lists support two modes:
- **Offset** — simple; default mode, for lists ≤ 10k items.
- **Cursor** (keyset) — preferred for deep pagination / infinite scroll; uses `cursor=<last-id>` param and returns `meta.nextCursor`.

Defaults: `limit=25`, max `limit=100`.

```
GET /api/v1/invoices?status=OVERDUE&sort=-issueDate&page=2&limit=50
GET /api/v1/invoices?status=OVERDUE&sort=-issueDate&cursor=inv_0123&limit=50
```

### 5.2 Sorting
`sort=fieldName` (ascending) or `sort=-fieldName` (descending). Comma-separated for multi-field: `sort=status,-issueDate`.

### 5.3 Filtering
Query params:
- Scalar equality: `?status=FINALIZED`
- Array `?status=FINALIZED&status=PAID` (OR)
- Range suffixes: `?issueDateGte=2026-01-01&issueDateLt=2026-02-01`
- Full text search: `?q=Smith+Street`

---

## 6. Middleware Pipeline (In Order)

Every Route Handler runs through the following middleware before controller logic:

```mermaid
flowchart LR
    A[1. Correlation ID<br/>(requestId generator<br/>(W3C Trace Context if present else UUID)]
    A --> B[2. Structured Logger<br/>With requestId, route path, method]
    B --> C[3. CORS & Security Headers<br/>CSP, HSTS, X-Frame-Options, Referrer-Policy]
    C --> D[4. Rate Limiting<br/>tenantId or IP sliding window]
    D --> E{Route family}
    E -->|Webhook| F[5a. HMAC Signature Check]
    E -->|Platform| G[5b. Session + PLATFORM_ADMIN claim + IP allow-list]
    E -->|v1| H[5c. Session Cookie or Access Token JWT]
    E -->|Public pay| I[5d. Invoice nonce lookup]
    F --> J[6. Zod Schema Validation — req.body/query/params]
    G --> J
    H --> J
    I --> J
    J --> K[7. RBAC Permission Check — authorize(resource, action)]
    K --> L[8. TenantContext.setId() + UserContext.setId()]
    L --> M[9. Controller / Service Invocation]
    M --> N[10. Envelope Wrapping — ok/data/error]
    N --> O[11. Response Logging — status + latency + error.code]
```

### 6.1 Rate Limiting Details
- Per `tenantId` (authenticated): 500 rpm default, 2000 rpm for enterprise plan (stored in plan table).
- Per IP address (unauthenticated /api/pay/*): 60 rpm sliding window.
- Response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After` when limited.
- Storage backend: Redis `INCR + EXPIRE` + Lua atomic script for accuracy.

---

## 7. Server Actions Architecture

### 7.1 When to Use Server Actions vs Route Handlers

| Scenario | Preferred API |
|---|---|
| Form submission within a Server Component page | **Server Action** (progressive enhancement, no client fetch boilerplate) |
| Programmatic third-party access, inbound webhooks, public anonymous API | **Route Handler** |
| Complex search/filter lists, file download/streaming | **Route Handler** |
| Inline mutations (button click, toggles) | **Server Action** |

### 7.2 Server Action Enforcement

```typescript
// Pattern — every server action follows this flow:
"use server";

import { z } from "zod";
import { authorize } from "@/shared/authorization";
import { invoicingService } from "@/modules/invoicing";
import { action } from "@/shared/api/server-action-wrapper";  // helper

const schema = z.object({ invoiceId: z.string().uuid(), memo: z.string().max(200).optional() });

export const sendInvoiceAction = action(schema, async (input, ctx) => {
  await authorize(ctx, "invoice", "send");
  return invoicingService.sendInvoice(ctx.tenantId, input.invoiceId, { memo: input.memo });
});
// The wrapper handles: session parsing, Zod parsing, tenant context, RBAC, error envelope, audit log.
```

### 7.3 Sharing Types with Client
- Every module exposes a public `types.ts` file with DTO Zod schemas and inferred TypeScript types.
- Client uses same inferred types to build forms; no duplication.
- Input/output DTOs are explicit types; never leak DB entity (never `prisma.invoice.$InferModel` exported).

---

## 8. Endpoint Catalogue — v1 (Summary)

### 8.1 Authentication

| Method | Path | Description | Permission |
|---|---|---|---|
| ANY | `/api/auth/*` | Auth.js v5 managed routes (see auth architecture doc) | N/A |

### 8.2 Tenant & User Management

| Method | Path | Permission |
|---|---|---|
| GET    | `/api/v1/tenants/me` | `tenant:read` — get active tenant profile |
| PATCH  | `/api/v1/tenants/me` | `tenant:update` |
| GET    | `/api/v1/users` | `user:read` — list org users |
| POST   | `/api/v1/invitations` | `user:invite` — invite new member |
| DELETE | `/api/v1/memberships/:id` | `user:remove` — remove member |

### 8.3 Properties, Buildings, Units

| Method | Path | Permission |
|---|---|---|
| CRUD   | `/api/v1/properties[/:id]` | `property:{read,create,update,delete}` |
| CRUD   | `/api/v1/properties/:id/buildings[/:bid]` | `property:update` |
| CRUD   | `/api/v1/buildings/:bid/units[/:uid]` | `unit:*` |

### 8.4 Tenants & Leases

| Method | Path | Permission |
|---|---|---|
| CRUD   | `/api/v1/tenant-users[/:id]` | `tenantUser:*` |
| CRUD   | `/api/v1/leases[/:id]` | `lease:*` |
| POST   | `/api/v1/leases/:id/terminate` | `lease:terminate` |
| GET    | `/api/v1/charge-templates` | `billing:read` |
| CRUD   | `/api/v1/charge-templates[/:id]` | `billing:*` |

### 8.5 Invoicing

| Method | Path | Permission |
|---|---|---|
| GET    | `/api/v1/invoices` | `invoice:read` |
| POST   | `/api/v1/invoices` | `invoice:create` |
| GET    | `/api/v1/invoices/:id` | `invoice:read` |
| PATCH  | `/api/v1/invoices/:id` | `invoice:update` (DRAFT only) |
| POST   | `/api/v1/invoices/:id/finalize` | `invoice:finalize` |
| POST   | `/api/v1/invoices/:id/send` | `invoice:send` |
| POST   | `/api/v1/invoices/:id/void` | `invoice:void` |
| GET    | `/api/v1/invoices/:id/download-pdf` | `invoice:read` — stream PDF |
| GET    | `/api/v1/invoices/generate-number` | `invoice:create` — get next invoice number |
| POST   | `/api/v1/billing-cycles/finalize` | `billing:finalize` — expand + finalize batch |

### 8.6 Payments

| Method | Path | Permission |
|---|---|---|
| GET    | `/api/v1/payments` | `payment:read` |
| POST   | `/api/v1/invoices/:id/pay` | `payment:create` — creates PaymentIntent |
| POST   | `/api/v1/payments/:id/refund` | `payment:refund` |
| GET    | `/api/v1/payment-methods` | `paymentMethod:read` |
| POST   | `/api/v1/payment-methods/setup` | `paymentMethod:create` — SetupIntent |
| DELETE | `/api/v1/payment-methods/:id` | `paymentMethod:delete` |

### 8.7 Reporting

| Method | Path | Permission |
|---|---|---|
| GET    | `/api/v1/reports/dashboard-summary` | `report:read` (small, cached 5min) |
| GET    | `/api/v1/reports/rent-roll` | `report:read` (larger) |
| GET    | `/api/v1/reports/arrears` | `report:read` |
| GET    | `/api/v1/reports/pnl?period=2026-Q1` | `report:read` |
| GET    | `/api/v1/reports/export/:type` | `report:export` — async, returns job ID then download link |

### 8.8 Public Payment Portal (Unauthenticated)

| Method | Path | Auth |
|---|---|---|
| GET    | `/api/pay/:invoiceId/:nonce/view` | Invoice nonce match |
| POST   | `/api/pay/:invoiceId/:nonce/create-intent` | Invoice nonce match, no SCA yet |
| GET    | `/api/pay/:invoiceId/:nonce/receipt` | Same |

### 8.9 Platform (Superadmin Only)

| Method | Path | Permission |
|---|---|---|
| GET    | `/api/platform/tenants` | `platform:tenant:list` |
| POST   | `/api/platform/tenants` | `platform:tenant:create` |
| PATCH  | `/api/platform/tenants/:id` | `platform:tenant:update` |
| POST   | `/api/platform/tenants/:id/suspend` | `platform:tenant:suspend` |
| POST   | `/api/platform/tenants/:id/impersonate` | `platform:tenant:impersonate` |
| GET    | `/api/platform/audit-log` | `platform:audit:read` |

### 8.10 Webhooks (Inbound)

| Method | Path | Auth |
|---|---|---|
| POST   | `/api/webhooks/stripe` | Stripe HMAC-SHA256 signature header + CIDR allow |
| POST   | `/api/webhooks/email` | Resend signing secret + CIDR allow |

### 8.11 Internal

| Method | Path | Auth |
|---|---|---|
| POST   | `/api/internal/cron/daily` | Internal VPC bearer token |
| POST   | `/api/internal/cron/hourly` | Same |

---

## 9. File Upload & Download

### 9.1 Upload Flow (two-legged via presigned)
1. Client → `POST /api/v1/files/presign-upload { filename, contentType, size, purpose }` → receives `{ uploadUrl, key, objectId }`.
2. Client → `PUT` to S3-compatible uploadUrl directly (bypasses app server, no memory bloat).
3. On success client → `POST /api/v1/files { objectId }` registers object in `file` table with tenant scoping + RLS.

### 9.2 Download Flow
1. Client → `GET /api/v1/files/:id` → app validates RLS, fetches metadata.
2. If small file: stream through (content-length limit 20 MB; larger uses redirect to presigned GET URL 24h TTL.

---

## 10. Webhook Outbound (Tenant Integration)

Tenants on ENTERPRISE plan can register webhook endpoints for domain events (see event architecture).
- HMAC-SHA256 signature header `X-MyTenant-Signature`.
- Retry policy: 10 attempts exponential backoff 15 min max.
- Deliveries logged to `webhook_delivery`.

---

## 11. Observability of API Layer

Every request emits:
1. Structured log line (start + finish) with `latencyMs`, `statusCode`, `route`, `tenantId`, `userId`, `error.code`.
2. Prometheus metrics: `http_requests_total{route,method,status}`, `http_request_duration_seconds`.
3. Sentry trace span (if sampled).
4. Slow requests (> 1s) log additional Prisma query count.

Alerts configured:
- `5xx rate > 1%` → Paging
- `p95 latency > 500 ms sustained 5 min` → Warning
- `429 rate > 10% of traffic` → Warning (possible abuse)
