# API Endpoints Reference (v1)

All endpoints live under the versioned prefix: `https://api.mytenant-invoice.cromstel.com/v1/`

Authentication required on every endpoint except `/v1/auth/*` and `/health`.

---

## 0. System & Health

| Method | Path                                          | Description                                   | Scope Required |
|--------|-----------------------------------------------|-----------------------------------------------|----------------|
| GET    | `/health`                                     | Liveness + readiness probe                    | None           |
| GET    | `/v1/health/detailed`                         | Service dependencies, DB pool, Redis, queue   | None (rate-limited by IP) |
| GET    | `/v1/oas.json`                                | OpenAPI 3.1 spec for v1                       | None           |
| GET    | `/v1/auth/.well-known/jwks.json`              | Public keyset for JWT validation              | None           |

---

## 1. Organizations (Orgs / Tenants)

| Method | Path                                                        | Description                                               | Scope            |
|--------|-------------------------------------------------------------|-----------------------------------------------------------|------------------|
| POST   | `/v1/organizations`                                         | Provision new org (partner/self-serve signup)             | `organizations:write` |
| GET    | `/v1/organizations`                                         | List orgs (admin/multi-org service accounts)              | `organizations:read` |
| GET    | `/v1/organizations/{org_id}`                                | Get org profile + plan + billing status                   | `organizations:read` |
| PATCH  | `/v1/organizations/{org_id}`                                | Update org name, locale, currency, timezone, branding     | `organizations:write` |
| DELETE | `/v1/organizations/{org_id}`                                | Schedule org deletion (30-day soft delete)                | `org:owner` role |
| POST   | `/v1/organizations/{org_id}/billing`                        | Manage subscription plan, seat count (billing portal)     | `org:owner` role |
| GET    | `/v1/organizations/{org_id}/billing/invoices`               | List platform invoices (CromStel charges to the org)      | `org:owner` role |
| GET    | `/v1/organizations/{org_id}/members`                        | List org users + roles                                    | `organizations:read` |
| POST   | `/v1/organizations/{org_id}/members`                        | Invite user by email + role assignment                    | `organizations:write` |
| PATCH  | `/v1/organizations/{org_id}/members/{user_id}`              | Change role, MFA enforcement                              | `organizations:write` |
| DELETE | `/v1/organizations/{org_id}/members/{user_id}`              | Remove org member; transfer ownership if last owner       | `org:owner` role |

## 2. Properties & Units

| Method | Path                                                         | Description                                                   | Scope             |
|--------|--------------------------------------------------------------|---------------------------------------------------------------|-------------------|
| POST   | `/v1/organizations/{org_id}/properties`                      | Create property (residential/commercial/industrial mix)       | `properties:write`|
| GET    | `/v1/organizations/{org_id}/properties`                      | List properties (filter by type, status, region)              | `properties:read` |
| GET    | `/v1/organizations/{org_id}/properties/{property_id}`        | Get property detail, address, floor count, square footage     | `properties:read` |
| PATCH  | `/v1/organizations/{org_id}/properties/{property_id}`        | Update property metadata                                      | `properties:write`|
| DELETE | `/v1/organizations/{org_id}/properties/{property_id}`        | Archive property (soft-delete; blocks new leases)             | `properties:write`|
| GET    | `/v1/properties/{property_id}/units`                         | List units in property                                        | `properties:read` |
| POST   | `/v1/properties/{property_id}/units`                         | Add unit (apt, suite, floor, commercial bay)                  | `properties:write`|
| GET    | `/v1/units/{unit_id}`                                        | Unit detail: sqft, rooms, rent_default, amenities             | `properties:read` |
| PATCH  | `/v1/units/{unit_id}`                                        | Update unit config                                            | `properties:write`|
| DELETE | `/v1/units/{unit_id}`                                        | Archive unit                                                  | `properties:write`|

## 3. Customers (Tenants / Occupants)

| Method | Path                                                         | Description                                                      | Scope            |
|--------|--------------------------------------------------------------|------------------------------------------------------------------|------------------|
| POST   | `/v1/organizations/{org_id}/customers`                       | Create customer (person or company) + contact info               | `customers:write`|
| GET    | `/v1/organizations/{org_id}/customers`                       | List/filter/search customers (by name, unit, status)             | `customers:read` |
| GET    | `/v1/customers/{customer_id}`                                | Customer profile, contact details, tax IDs, payment methods      | `customers:read` |
| PATCH  | `/v1/customers/{customer_id}`                                | Update customer data                                             | `customers:write`|
| DELETE | `/v1/customers/{customer_id}`                                | Archive customer (preserves invoices)                            | `customers:write`|
| POST   | `/v1/customers/{customer_id}/contacts`                       | Add secondary contact (spouse, guarantor, property manager)      | `customers:write`|
| GET    | `/v1/customers/{customer_id}/leases`                         | Active + historical leases for customer                          | `customers:read` |
| POST   | `/v1/leases`                                                 | Create lease: customer + unit, rent schedule, term, deposit, fees| `customers:write`|
| GET    | `/v1/leases/{lease_id}`                                      | Lease terms, charges, renewal options                            | `customers:read` |
| PATCH  | `/v1/leases/{lease_id}`                                      | Amend lease (rent change, early termination addendum)            | `customers:write`|
| POST   | `/v1/leases/{lease_id}/renew`                                | Renew lease (creates new lease record linked to previous)        | `customers:write`|
| POST   | `/v1/leases/{lease_id}/terminate`                            | Schedule end-of-lease; compute final charges                     | `customers:write`|

## 4. Invoices

| Method | Path                                                         | Description                                                       | Scope            |
|--------|--------------------------------------------------------------|-------------------------------------------------------------------|------------------|
| POST   | `/v1/organizations/{org_id}/invoices`                        | Create DRAFT invoice (manual or from lease schedule)              | `invoices:write` |
| POST   | `/v1/organizations/{org_id}/invoices/batch-generate`         | Async: generate invoices for all active leases in billing cycle   | `invoices:write` |
| GET    | `/v1/organizations/{org_id}/invoices`                        | List invoices; filter status/issue_date/due_date/amount/customer  | `invoices:read`  |
| GET    | `/v1/invoices/{invoice_id}`                                  | Full invoice: line items, totals, tax breakdown, history          | `invoices:read`  |
| PATCH  | `/v1/invoices/{invoice_id}`                                  | Edit DRAFT invoice (add/remove line items, discounts)             | `invoices:write` |
| POST   | `/v1/invoices/{invoice_id}/issue`                            | Finalize + send via email/post + mark ISSUED                      | `invoices:write` |
| POST   | `/v1/invoices/{invoice_id}/send`                             | Resend invoice via channel (email/sms/post/multi)                 | `invoices:write` |
| POST   | `/v1/invoices/{invoice_id}/remind`                           | Trigger manual overdue reminder                                   | `invoices:write` |
| POST   | `/v1/invoices/{invoice_id}/void`                             | Void invoice (with reason; creates contra entry)                  | `invoices:write` |
| POST   | `/v1/invoices/{invoice_id}/credit`                           | Issue credit note against invoice (full/partial)                  | `invoices:write` |
| POST   | `/v1/invoices/{invoice_id}/write-off`                        | Write off uncollectable balance                                   | `billing:admin`  |
| GET    | `/v1/invoices/{invoice_id}/pdf`                              | Download rendered PDF (signed, watermarked)                       | `invoices:read`  |
| GET    | `/v1/invoices/{invoice_id}/line-items`                       | Line items + tax detail                                           | `invoices:read`  |
| POST   | `/v1/invoices/{invoice_id}/line-items`                       | Add line item to DRAFT                                            | `invoices:write` |
| PATCH  | `/v1/invoices/{invoice_id}/line-items/{item_id}`             | Update line item                                                  | `invoices:write` |
| DELETE | `/v1/invoices/{invoice_id}/line-items/{item_id}`             | Remove line item from DRAFT                                       | `invoices:write` |
| GET    | `/v1/customers/{customer_id}/invoices`                       | All invoices for one customer                                     | `invoices:read`  |
| GET    | `/v1/leases/{lease_id}/invoices`                             | Invoices generated from specific lease                            | `invoices:read`  |

## 5. Payments

| Method | Path                                                         | Description                                                            | Scope            |
|--------|--------------------------------------------------------------|------------------------------------------------------------------------|------------------|
| POST   | `/v1/invoices/{invoice_id}/payments`                         | Record manual payment (cash/check/bank transfer)                      | `payments:write` |
| POST   | `/v1/payments/intent`                                        | Create PaymentIntent (Stripe/Adyen/Mollie/PayPal/ACH/BACS via PM)      | `payments:write` |
| POST   | `/v1/payments/{payment_id}/confirm`                          | Confirm 3DS/SCA challenged payment                                     | `payments:write` |
| GET    | `/v1/organizations/{org_id}/payments`                        | List/filter payments; export CSV                                       | `payments:read`  |
| GET    | `/v1/payments/{payment_id}`                                  | Payment detail, allocation to invoices, fees, auth code               | `payments:read`  |
| POST   | `/v1/payments/{payment_id}/refund`                           | Refund (partial/full); links to credit note when appropriate           | `payments:write` |
| GET    | `/v1/payments/{payment_id}/refunds`                          | Refund history                                                         | `payments:read`  |
| POST   | `/v1/payments/reconcile/batch`                               | Async: reconcile statement rows vs. expected payments                 | `billing:admin`  |
| POST   | `/v1/customers/{customer_id}/payment-methods`                | Store/tokenize payment method (vaulted PCI-DSS SAQ-A compliant)        | `payments:write` |
| GET    | `/v1/customers/{customer_id}/payment-methods`                | List stored payment methods (masked)                                   | `payments:read`  |
| DELETE | `/v1/customers/{customer_id}/payment-methods/{pm_id}`        | Remove stored payment method                                           | `payments:write` |
| POST   | `/v1/auto-pay/configure`                                     | Configure autopay rules per customer or lease                          | `payments:write` |
| GET    | `/v1/payments/deposits`                                      | List expected deposit batches to org bank account (reconciliation)    | `billing:admin`  |

## 6. Meters & Readings

| Method | Path                                                         | Description                                                          | Scope           |
|--------|--------------------------------------------------------------|----------------------------------------------------------------------|-----------------|
| POST   | `/v1/units/{unit_id}/meters`                                 | Register meter (electric, gas, water, solar, HVAC)                  | `meters:write`  |
| GET    | `/v1/units/{unit_id}/meters`                                 | List meters on a unit                                                | `meters:read`   |
| GET    | `/v1/meters/{meter_id}`                                      | Meter configuration, serial number, tariff, multiplier              | `meters:read`   |
| PATCH  | `/v1/meters/{meter_id}`                                      | Update meter config, replace end-of-life meter                       | `meters:write`  |
| DELETE | `/v1/meters/{meter_id}`                                      | Decommission meter (preserves history)                               | `meters:write`  |
| POST   | `/v1/meters/{meter_id}/readings`                             | Submit single meter reading (manual/AMR import)                      | `meters:write`  |
| POST   | `/v1/organizations/{org_id}/meters/readings/batch`           | Bulk import 1-10,000 readings (CSV multipart or JSON array)         | `meters:write`  |
| GET    | `/v1/meters/{meter_id}/readings`                             | Paginated reading history                                            | `meters:read`   |
| GET    | `/v1/meters/{meter_id}/readings/{reading_id}`                | Single reading detail with anomaly score                             | `meters:read`   |
| PATCH  | `/v1/meters/{meter_id}/readings/{reading_id}`                | Correct reading (adjustments recorded in audit + invoice recompute) | `meters:write`  |
| DELETE | `/v1/meters/{meter_id}/readings/{reading_id}`                | Delete erroneous reading (supervised; audited)                       | `meters:write`  |
| GET    | `/v1/meters/{meter_id}/billing-calculation/{period}`         | Preview charge calculation for period (rate * usage)                 | `meters:read`   |
| GET    | `/v1/organizations/{org_id}/meters/anomalies`                | Flagged readings: unexpected delta, rollback, leak detection        | `meters:read`   |

## 7. Reports

| Method | Path                                                         | Description                                                           | Scope            |
|--------|--------------------------------------------------------------|-----------------------------------------------------------------------|------------------|
| GET    | `/v1/organizations/{org_id}/reports/definitions`             | Catalog of 40+ report templates + parameters                         | `reports:read`   |
| POST   | `/v1/organizations/{org_id}/reports`                         | Generate report (async); returns `rpt_*`                              | `reports:read`   |
| GET    | `/v1/reports/{report_id}`                                    | Report status, progress % (0-100), size, download URLs               | `reports:read`   |
| GET    | `/v1/reports/{report_id}/download`                           | Download: CSV / XLSX / PDF / JSON-Lines (choice via `?format=`)      | `reports:read`   |
| DELETE | `/v1/reports/{report_id}`                                    | Cancel in-progress; delete completed                                  | `reports:read`   |
| GET    | `/v1/organizations/{org_id}/reports/scheduled`               | Scheduled recurring report definitions                                | `reports:read`   |
| POST   | `/v1/organizations/{org_id}/reports/scheduled`               | Create scheduled report (daily/weekly/monthly; email/API/webhook)    | `reports:read`   |
| PATCH  | `/v1/reports/scheduled/{sched_id}`                           | Edit schedule; pause/resume                                           | `reports:read`   |

### Common Report Types

| Slug                               | Description
|------------------------------------|------------------------------------------
| `accounts-receivable-aging`      | AR aging buckets (0-30, 31-60, 61-90, 90+)
| `income-statement`             | Revenue, expenses, net for period
| `balance-sheet`                | Assets, liabilities, equity snapshot
| `cash-flow`                    | Operating/investing/financing cash flow
| `rent-roll`                    | All active leases + scheduled rent
| `occupancy-rate`               | % occupied by property/region
| `meter-usage-trend`            | Utility consumption by unit/meter
| `late-fees-summary`            | Late fees assessed + waived
| `payment-method-mix`           | CC / ACH / cash / check distribution
| `tenant-churn`                 | Move-in / move-out / retention cohort
| `tax-liability`                | Accrued tax by jurisdiction for filing
| `bad-debt-provision`           | Estimated write-off risk

## 8. Webhooks

| Method | Path                                                         | Description                                                          | Scope             |
|--------|--------------------------------------------------------------|----------------------------------------------------------------------|-------------------|
| POST   | `/v1/organizations/{org_id}/webhooks`                        | Create webhook subscription (endpoint, events, signing secret)       | `webhooks:write`  |
| GET    | `/v1/organizations/{org_id}/webhooks`                        | List subscriptions                                                  | `webhooks:read`   |
| GET    | `/v1/webhooks/{webhook_id}`                                  | Subscription detail, health status, last delivery, next retry       | `webhooks:read`   |
| PATCH  | `/v1/webhooks/{webhook_id}`                                  | Update endpoint URL, events, signature secret, enable/disable       | `webhooks:write`  |
| DELETE | `/v1/webhooks/{webhook_id}`                                  | Remove subscription                                                  | `webhooks:write`  |
| POST   | `/v1/webhooks/{webhook_id}/test`                             | Send test event (ping) to endpoint                                   | `webhooks:write`  |
| GET    | `/v1/webhooks/{webhook_id}/deliveries`                       | Recent delivery attempts + response codes / latency (last 30 days)  | `webhooks:read`   |
| GET    | `/v1/webhooks/{webhook_id}/deliveries/{delivery_id}`         | Single delivery full request/response payload (redacted)           | `webhooks:read`   |
| POST   | `/v1/webhooks/deliveries/{delivery_id}/replay`               | Manually replay a failed/successful delivery                        | `webhooks:write`  |

---

## Request / Response Examples (Key Endpoints)

### Create Invoice

**Request**
```http
POST /v1/organizations/org_01HF92B6T7XN578Q5WV9QNBG0/invoices HTTP/1.1
Authorization: Bearer <jwt>
Content-Type: application/json
Idempotency-Key: 8b4e1e9a-3f7c-4a2d-9b1e-5c3f8a7d2b1e

{
  "customer_id": "cust_01HF92CP9D7FXRK1P5Q4MX8",
  "lease_id": "lease_01HF92Z99X2401V32MTV1L1T77",
  "issue_date": "2024-04-01",
  "due_date": "2024-04-15",
  "currency_code": "USD",
  "line_items": [
    {
      "description": "Monthly Rent - Unit 3B - April 2024",
      "quantity": 1,
      "unit_amount": 185000,
      "tax_rate_id": "tax_01HF92F3K2098ZY8Q99V529",
      "ledger_account": "4100-RENT-INCOME"
    },
    {
      "description": "Water Usage - Meter mtr_01HF92DR2F03KQNR2W5V6S (Mar 1-31)",
      "quantity": 1,
      "unit_amount": 7825,
      "tax_rate_id": "tax_01HF92F3K2098ZY8Q99V529"
    }
  ],
  "memo": "Thank you for your tenancy. Payment portal: https://pay.mytenant-invoice.cromstel.com/u/cust_01HF92CP9D7FXRK1P5Q4MX8",
  "send_on_issue": true,
  "send_channels": ["email", "sms"]
}
```

**Response (201 Created)**
```json
{
  "data": {
    "id": "inv_01HF938M4X9Z2K7N3P5Q7S9T1",
    "org_id": "org_01HF92B6T7XN578Q5WV9QNBG0",
    "customer_id": "cust_01HF92CP9D7FXRK1P5Q4MX8",
    "number": "INV-2024-04-000123",
    "status": "issued",
    "issue_date": "2024-04-01",
    "due_date": "2024-04-15",
    "currency_code": "USD",
    "subtotal": 192825,
    "tax_total": 15426,
    "grand_total": 208251,
    "amount_due": 208251,
    "amount_paid": 0,
    "line_items": [
      { "id": "li_01HF938...", "description": "Monthly Rent - Unit 3B - April 2024", "total": 185000 },
      { "id": "li_01HF938...", "description": "Water Usage...", "total": 7825 }
    ],
    "pdf_url": "https://assets.mytenant-invoice.cromstel.com/invoices/inv_01HF938M4X9Z2K7N3P5Q7S9T1.pdf?signed=1",
    "created_at": "2024-03-15T14:30:00.452Z"
  },
  "meta": { "request_id": "req_01HF938A7T3Y9N5V1S7G4R8K9Y" }
}
```

### Submit Meter Reading

```http
POST /v1/meters/mtr_01HF92DR2F03KQNR2W5V6S/readings HTTP/1.1
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "reading_value": 482345.7,
  "reading_date": "2024-03-31T23:59:00Z",
  "source": "manual",                     // manual | amr_api | import_csv | estimated
  "read_by_user_id": "user_01HF932V88E2XWVVSBD9TMNQN2",
  "notes": "Read by on-site staff. No leaks observed.",
  "attachments": [
    {
      "filename": "meter_photo_20240331.jpg",
      "content_type": "image/jpeg",
      "data_base64": "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAkGBwgHBgk..."
    }
  ]
}
```

---

## Idempotency

All `POST`, `PUT`, `PATCH`, `DELETE` accept `Idempotency-Key: <UUID v4>` header. Replayed requests within **24 hours** with the same key + same authenticated subject return the original cached response without re-executing side effects. Keys are stored per organization.

Example cached replay response includes header `X-Idempotent-Replay: true`.
