# Pagination & Filtering

## Pagination Strategy

All collection endpoints (GET returning arrays) use **cursor-based pagination by default** for stable, consistent reads even as the underlying dataset is mutated. **Offset-based pagination is additionally supported** for simple tooling/BI use cases where absolute page numbers are required.

Clients should prefer cursor pagination for any production integration, as offset pagination degrades linearly with page offset for very large datasets.

---

## Cursor Pagination (Recommended)

### Request Parameters

| Parameter       | Type        | Default | Description
|-----------------|-------------|---------|----------------------------------
| `page[size]`    | integer 1-500 | 25     | Items per page (max 500)
| `page[after]`   | ULID cursor | null    | Forward pagination: return items after this cursor
| `page[before]`  | ULID cursor | null    | Reverse pagination: return items before this cursor
| `sort`          | string      | `-created_at` | Sort expression: `+field` or `-field` (asc/desc). Supported: `created_at`, `updated_at`, `id`, natural keys (e.g. `number`, `due_date`, `amount`)

### Response Pagination Links

Collection responses always include `links`:

```json
{
  "data": [
    { "id": "inv_01HF93M7A1B2C3D4E5F6", "number": "INV-2024-04-000126", "due_date": "2024-04-15", ... },
    { "id": "inv_01HF93M7B2C3D4E5F6A7", "number": "INV-2024-04-000125", "due_date": "2024-04-14", ... },
    { "id": "inv_01HF93M7C3D4E5F6A7B8", "number": "INV-2024-04-000124", "due_date": "2024-04-13", ... }
  ],
  "meta": {
    "page": {
      "size": 25,
      "has_prev": true,
      "has_next": true,
      "start_cursor": "inv_01HF93M7A1B2C3D4E5F6G7H8",
      "end_cursor": "inv_01HF93M8D4E5F6A7B8C9D0"
    },
    "total_count": 18429,     // only if include_total=true (expensive)
    "approx_count_upper": 20000 // fast HLL estimate (default)
  },
  "links": {
    "self":  "https://api.mytenant-invoice.cromstel.com/v1/organizations/org_01HF92B6T7XN578Q5WV9QNBG0/invoices?page[size]=25&page[after]=inv_PREV_PAGE_END_CURSOR",
    "first": "https://api.mytenant-invoice.cromstel.com/v1/organizations/org_01HF92B6T7XN578Q5WV9QNBG0/invoices?page[size]=25",
    "last":  null,             // only provided when include_total=true
    "prev":  "https://api.mytenant-invoice.cromstel.com/v1/organizations/org_01HF92B6T7XN578Q5WV9QNBG0/invoices?page[size]=25&page[before]=inv_01HF93M7A1B2C3D4E5F6G7H8",
    "next":  "https://api.mytenant-invoice.cromstel.com/v1/organizations/org_01HF92B6T7XN578Q5WV9QNBG0/invoices?page[size]=25&page[after]=inv_01HF93M8D4E5F6A7B8C9D0"
  }
}
```

### Cursor Stability Guarantee

Cursors encode `(sort_key_value, resource_id)` pairs using URL-safe base64. They are **stable for 7 days** even if the resource is updated mid-traversal. If you need 100% consistency (e.g. for financial reconciliation export), pass `page[consistency]=snapshot` which binds to a database transaction snapshot token (good for 1 hour).

```http
GET /v1/organizations/{org_id}/invoices?page[consistency]=snapshot&page[size]=500
```

Response includes `meta.page.snapshot_id` which is echoed on subsequent pages to guarantee MVCC-based read consistency.

### Pagination Walkthrough

1. First page: `GET /v1/organizations/org_xxx/invoices?page[size]=100&sort=-due_date`
2. Use `links.next` URL directly (do not construct cursors manually).
3. Stop when `links.next === null` or `meta.page.has_next === false`.
4. For reverse iteration (e.g. newest to oldest is natural; want oldest first): use `sort=+due_date` and page forward.

---

## Offset Pagination (Simple/BI)

| Parameter         | Type        | Default | Limits
|-------------------|-------------|---------|----------------
| `page[number]`    | integer 1+  | 1       | Max page 500 (we do not allow deep offsets for performance reasons)
| `page[size]`      | integer 1-500 | 25    | Max 500/request

If `page[number]` > 500, `409 pagination_offset_too_deep` error returned — switch to cursor pagination.

The two pagination styles are mutually exclusive: if both `page[after]` and `page[number]` are present, the request returns 400.

---

## Sorting

Multiple sort fields can be combined with comma:

```
GET /v1/organizations/{org_id}/invoices?sort=status,-due_date,number
```

Rules:
- Prefix `+` (ascending, default if omitted) or `-` (descending).
- Max 3 sort fields per request.
- Composite sort is always rewritten to append a unique tiebreaker (typically `id`) for deterministic ordering.
- Allowed sort fields per endpoint are listed in the OpenAPI schema; invalid fields → `400 validation_sort_field_invalid`.

Common sortable fields by resource:

| Resource | Allowed Sort Keys
|----------|--------------------------------------------
| Invoices | `created_at`, `updated_at`, `due_date`, `issue_date`, `number`, `grand_total`, `status`, `paid_at`
| Payments | `created_at`, `captured_at`, `amount`, `status`, `method`
| Customers | `created_at`, `name`, `email`, `external_id`
| Properties | `created_at`, `name`, `region`, `type`
| Meters | `created_at`, `serial_number`, `type`, `last_reading_date`

---

## Filtering

### Filter Syntax: RHS Bracket Notation

Use `filter[field][operator]=value` pattern. Multiple `filter[]` params are AND'ed together.

```
GET /v1/organizations/{org_id}/invoices
    ?filter[status][eq]=paid
    &filter[due_date][gte]=2024-01-01
    &filter[due_date][lte]=2024-12-31
    &filter[grand_total][gt]=100000
    &filter[customer_id][in]=cust_01HF92CP9D7FXRK1P5Q4MX8,cust_01HF92Z1X9Y8W7V6T5S4R3
```

### Operators

| Operator      | Meaning              | Example                                            |
|---------------|----------------------|---------------------------------------------------|
| `eq`          | Equals               | `?filter[status][eq]=issued`                      |
| `ne`          | Not equal            | `?filter[status][ne]=void`                        |
| `gt`          | Greater than         | `?filter[grand_total][gt]=50000`                  |
| `gte`         | >=                   | `?filter[created_at][gte]=2024-01-01T00:00:00Z`   |
| `lt`          | <                    | `?filter[due_date][lt]=2024-04-01`                |
| `lte`         | <=                   | `?filter[updated_at][lte]=2024-03-15`             |
| `in`          | One of list          | `?filter[id][in]=inv_A,inv_B,inv_C` (max 100 ids) |
| `nin`         | Not in list          | `?filter[status][nin]=draft,void`                 |
| `like`        | Contains substring   | `?filter[customer_name][like]=%25Acme%25` (% = wildcard, URL-encoded as %25) |
| `ilike`       | Case-insensitive contains | `?filter[email][ilike]=%25@acme.com`          |
| `prefix`      | String prefix match  | `?filter[number][prefix]=INV-2024`                 |
| `suffix`      | String suffix        | `?filter[email][suffix]=@gmail.com`               |
| `between`     | Inclusive range `a,b` | `?filter[due_date][between]=2024-04-01,2024-04-30` |
| `null`        | Is null / not null   | `?filter[paid_at][null]=true` (null) or `=false`  |
| `has`         | Tag array contains   | `?filter[tags][has]=portfolio-a`                  |

### Special Filter Parameters

| Query Parameter | Resource              | Description
|-----------------|-----------------------|------------------------------------------------------------
| `q`             | customers, properties | Full-text search (name, email, address, phone; case-insensitive, fuzzy)
| `period`        | invoices, payments    | Predefined relative period: `today`, `yesterday`, `this_week`, `last_week`, `this_month`, `last_month`, `this_quarter`, `last_quarter`, `this_year`, `last_year`, `mtd`, `ytd`, `trailing_30d`, `trailing_90d`, `trailing_365d`
| `overdue`       | invoices              | `true` → only invoices with `amount_due>0 AND due_date<now`
| `archived`      | properties, customers, meters | `include` (default `exclude`): show archived + active
| `status_group`  | invoices              | `open` = draft+issued+partial, `closed` = paid+void, `receivable` = issued+partial

### Filter Examples

**Overdue invoices for a region, sorted by age:**
```
GET /v1/organizations/org_xxx/invoices
  ?filter[property.region][eq]=EU-WEST
  &overdue=true
  &sort=+due_date
  &page[size]=100
```

**Payments captured in Q1 2024 > $1,000 USD via card:**
```
GET /v1/organizations/org_xxx/payments
  ?filter[captured_at][between]=2024-01-01T00:00:00Z,2024-03-31T23:59:59Z
  &filter[amount][gt]=100000
  &filter[method][eq]=card
  &filter[currency_code][eq]=USD
```

**Find customers via fuzzy search "smith" in name/email:**
```
GET /v1/organizations/org_xxx/customers?q=smith
```

**Meter readings for a specific quarter:**
```
GET /v1/meters/mtr_01HF92DR2F03KQNR2W5V6S/readings
  ?filter[reading_date][between]=2024-01-01,2024-03-31
  &sort=+reading_date
```

---

## Field Selection (Sparse Fieldsets)

Reduce payload size by selecting only required fields:

```
GET /v1/organizations/{org_id}/invoices
  ?fields[invoices]=id,number,status,due_date,grand_total,customer_id
  &include=customer
  &fields[customers]=id,name,email
```

- `fields[resource_type]` = comma-list of attributes/relationships for that type
- `include` = comma-list of related resources to side-load (saves N+1 calls)

Supported includes:

| Resource      | Available Includes
|---------------|--------------------------------------------
| invoices      | `customer`, `line_items`, `payments`, `lease`, `property`, `tax_breakdown`
| payments      | `invoice`, `customer`, `refunds`
| customers     | `leases`, `contacts`, `primary_unit`
| properties    | `units`, `meters`
| meters        | `unit`, `property`, `readings` (latest 10)

**Example response with includes:**
```json
{
  "data": [
    {
      "id": "inv_01HF93M7A1B2C3D4E5F6",
      "type": "invoices",
      "attributes": { "number": "INV-2024-04-000126", "status": "paid", "due_date": "2024-04-15", "grand_total": 208251 },
      "relationships": {
        "customer": { "data": { "type": "customers", "id": "cust_01HF92CP9D7FXRK1P5Q4MX8" } }
      }
    }
  ],
  "included": [
    {
      "type": "customers",
      "id": "cust_01HF92CP9D7FXRK1P5Q4MX8",
      "attributes": { "name": "Acme Corp", "email": "finance@acme.example" }
    }
  ]
}
```

---

## Export Endpoints (Full Dataset Export)

For bulk exports (> 5,000 records) use the async report generation endpoints rather than paginating through the list API, which is capped at approximately 50,000 items per single crawl (and will take many requests).

```
POST /v1/organizations/{org_id}/reports
  {
    "report_slug": "invoices-full-export",
    "params": { "period": "2023", "format": "csv.gz", "filters": { "status": "paid" } }
  }
```

Returns async report task (see endpoints.md → Reports). Generates CSV / JSON-L / Parquet files up to 500MB with pre-signed S3 download URLs.

---

## Limits Summary

| Cap                              | Limit              |
|----------------------------------|--------------------|
| Default page size                | 25 items
| Max page size                    | 500 items
| Max offset page number           | 500 pages
| Cursor lifetime                  | 7 days
| Snapshot consistency window      | 1 hour
| IDs in `filter[id][in]`          | Max 100
| Sort fields                      | Max 3
| Concurrent paginated crawls per org | 5 (to prevent DB overload)
