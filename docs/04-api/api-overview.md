# API Overview

## Introduction

Welcome to the **myTenant Invoice API** (v1), the programmatic interface for CromStel IT Group's multi-tenant billing and invoicing platform. This RESTful API enables organizations to automate tenant billing workflows, integrate with external accounting systems, manage properties and customers, generate invoices, process payments, read utility meters, extract reporting data, and receive real-time event notifications via webhooks.

Base URL (Production): `https://api.mytenant-invoice.cromstel.com/v1`
Base URL (Sandbox): `https://sandbox-api.mytenant-invoice.cromstel.com/v1`

All API access occurs exclusively over TLS 1.3. Unencrypted HTTP requests are rejected with HTTP 426 Upgrade Required.

## Design Principles

1. **RESTful Architecture**: Resource-oriented URLs, standard HTTP verbs (GET, POST, PUT, PATCH, DELETE), and predictable resource identifiers.
2. **JSON Everywhere**: All request and response bodies use `application/json` content type, including error payloads. Binary attachments use `multipart/form-data` only where documented.
3. **Idempotency**: Mutating requests (POST, PUT, PATCH, DELETE) support the `Idempotency-Key` header to guarantee exactly-once semantics across retries.
4. **Multi-Tenant First**: Every authenticated request scopes to exactly one organization (tenant). Cross-tenant access is never permitted at the API layer.
5. **Versioned**: Stable, date-stamped releases via URL path (`/v1/`) with explicit deprecation windows of not less than 12 months.
6. **Observability**: Every response includes `X-Request-ID` and `X-Trace-ID` headers for support correlation.

## Core Resource Hierarchy

```
Organization (Tenant)
├── Properties
│   ├── Units
│   ├── Meters
│   │   └── Meter Readings
│   └── Customers (Tenants / Occupants)
│       ├── Contacts
│       └── Leases
├── Invoices
│   ├── Line Items
│   ├── Credits & Adjustments
│   └── Payments
├── Reports (Generated Reports
└── Webhook Subscriptions
    └── Deliveries & Attempt Logs
```

## Conventions

### Identifiers

All entity identifiers are **ULID v1.2) for sortable time-ordered uniqueness (26-character Crockford base32 strings.

| Prefix conventions:

| Resource           | Prefix | Example                          |
|----------------|--------|----------------------------------|
| Organization   | org_   | `org_01HF92B6T7XN578Q5WV9QNBG0K |
| Property       | prop_  | `prop_01HF92C2A7BMCDVJ8S2VD09` |
| Customer       | cust_  | `cust_01HF92CP9D7FXRK1P5Q4MX8` |
| Invoice        | inv_   | `inv_01HF92D4T9X0WF51P7HN15Q` |
| Payment        | pay_   | `pay_01HF92DK42GZPZ79WV8X8W0` |
| Meter          | mtr_   | `mtr_01HF92DR2F03KQNR2W5V6S` |
| Webhook        | wh_    | `wh_01HF92E1K5100Y89YWR8D58` |
| Report         | rpt_   | `rpt_01HF92E99B089X8Z5Z4B5` |

### Timestamps

All timestamps use **ISO 8601 UTC with millisecond precision `2024-03-15T14:30:00.452Z` and fields ending in `_at` for clarity.

### Monetary Values

All currency amounts as minor-unit integers (cents/pence) in the denomination's `currency` field. Never transmit or store currency_code` three-letter ISO 4217 code per organization default, e.g. "USD", "GBP", "EUR"). Floats are rejected at the validation layer to avoid IEEE-754 drift.

Example invoice line item:
```json
{
  "description": "Monthly Rent - Unit 3B",
  "amount": 185000,
  "currency_code": "USD",
  "quantity": 1,
  "tax_rate_id": "tax_01HF92F3K2098ZY8Q99V529"
}
```

$1,850.00 USD == 185000 minor units.

## Request/Response Envelope

### Request Headers

| Header                     | Required | Description
|----------------------------|----------|------------
| `Authorization: Bearer <token> | Yes      | JWT access token or API key prefix)
| `Content-Type: application/json` | Yes (for bodies)
| `Accept: application/json`     | Recommended
| `Idempotency-Key: <uuid>   | POST/PUT/PATCH/DELETE recommended | V4 UUID, stored 24h window |
| `X-Organization-ID: org_*  | Yes (service accounts only) | Explicit org scope for cross-org service tokens
| `X-Request-ID: <idempotency> | auto-generated | For idempotency (POST only

### Response Headers

| Header                | Description
|-----------------------|----------------------------------------
| `X-Request-ID         | Unique request correlation ID for support tickets
| `X-Trace-ID         | OpenTelemetry Trace ID (64-bit hex)
| `X-RateLimit-Limit     | Quota per window
| `X-RateLimit-Remaining | Remaining calls
| `X-RateLimit-Reset   | Unix epoch reset seconds

### Standard Response Envelope (non-error)

```json
{
  "data": { ... single resource object or array
  "meta": {
    "request_id": "req_01HF930044G0",
    "timestamp": "2024-03-15T14:30:00.452Z"
  },
  "links": {
    "self": "https://api.mytenant-invoice.cromstel.com/v1/organizations/org_01HF92B6T7XN578Q5WV9QNBG0/properties?page[number]=2&page[size]=25",
    "first": "...",
    "last": "...",
    "prev": null,
    "next": "..."
  }
}
```

For collection endpoints `data` contains an array; `links` provides pagination navigation (see pagination-filtering.md).

## Getting Started Checklist

1. Create a Sandbox organization at https://dashboard.sandbox.mytenant-invoice.cromstel.com
2. Issue API keys under **Developer → API Keys
3. Exchange credentials for a short-lived JWT (POST /auth/token)
4. Call `GET /v1/organizations/{org_id to confirm connectivity
5. Register a test property and customer via POST endpoints
6. Subscribe to webhook events for asynchronous flows (e.g. `invoice.created`, `payment.succeeded
7. Migrate your integration to production keys when validated.

## Support Channels

- API Status: https://status.mytenant-invoice.cromstel.com
- Developer Slack Community: developers@cromstel.com
- Security Disclosure: security@cromstel.com (PGP signed)
- Enterprise SLA: 99.95% uptime credits per contract
