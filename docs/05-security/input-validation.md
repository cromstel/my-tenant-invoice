# Input Validation & Output Encoding

## Defense-in-Depth Strategy

```
Input → Layer 1 (API Gateway JSON Schema + WAF rules)
      → Layer 2 (Global HTTP Request sanitizer: strip null bytes, normalize Unicode)
      → Layer 3 (Zod DTO validation per endpoint — strict mode)
      → Layer 4 (Domain invariants in aggregate command handlers — business rules)
      → Layer 5 (Prepared statements / parameterized DB queries — Prisma)
      → Layer 6 (Output sanitization before HTML/PDF rendering or serialization — DOMPurify + response templates)
```

**Golden Rule:** Never trust anything coming from outside the trust boundary. Validate inputs as close to the edge as possible, and encode/escape outputs immediately before rendering in a different context (HTML, PDF, CSV, SQL, shell, JSON, XML).

---

## Zod Validation Schema Examples

Every API DTO uses the **Zod v3** validation library in strict mode. The backend fails the build if a route handler exists without an associated Zod DTO (enforced via decorator `@UseZodPipe()` + lint rule).

### Global Config

```typescript
// zod-config.ts
import { z } from 'zod';

// Strict mode: extra keys in objects → error (fail-closed)
z.setErrorMap((issue, ctx) => ({
  message: issue.code === 'unrecognized_keys'
    ? `Unexpected fields: ${issue.keys.join(', ')}. Remove them.`
    : ctx.defaultError,
}));

// Helper: export strict object factory (default strict)
export const StrictObject = <T extends z.ZodRawShape>(shape: T) =>
  z.object(shape).strict();
```

### Example 1: Create Customer DTO

```typescript
// create-customer.dto.ts
export const CreateCustomerDto = StrictObject({
  name: z.string()
    .min(2, 'Customer name must be at least 2 characters')
    .max(200)
    .regex(/[\p{L}\p{N}\s',.\-&()]/u, 'Name may only contain letters, numbers, spaces, and basic punctuation')
    .trim(),

  display_name: z.string().min(1).max(200).optional(),

  customer_type: z.enum(['individual', 'company', 'trust', 'government']),

  registration_number: z.string()
    .max(50)
    .regex(/^[A-Z0-9-]+$/)
    .optional()
    .describe('Company registration / EIN / VAT ID. Uppercase alphanumeric + hyphen.'),

  tax_id: z.union([
    StrictObject({
      country: z.enum(['US', 'GB', 'DE', ...allCountries]),
      type: z.enum(['SSN', 'EIN', 'VAT', 'UEN', 'ABN', 'TIN']),
      value: z.string().max(32),  // value is encrypted before DB — we just check length here
    }),
    z.null(),
  ]).optional(),

  primary_contact: StrictObject({
    first_name: z.string().min(1).max(100).trim(),
    last_name:  z.string().min(1).max(100).trim(),
    email:      z.string().email({ message: 'Invalid email address format' }).toLowerCase(),
    phone:      z.string()
                   .max(30)
                   .regex(/^\+?[1-9]\d{1,14}$/)  // E.164 format
                   .optional(),
    locale:     z.enum(supportedLocales).default('en-US'),
  }),

  billing_address: StrictObject({
    line1: z.string().min(2).max(200).trim(),
    line2: z.string().max(200).trim().optional(),
    city:  z.string().min(1).max(120),
    region: z.string().max(120).optional(),
    postal_code: z.string().min(3).max(20).regex(/^[A-Z0-9\- ]+$/i),
    country_code: z.enum(allCountryCodes),
  }),

  currency_preference: z.enum(supportedCurrencies).default('USD'),

  tags: z.array(z.string().min(1).max(40)).max(20).default([]),

  metadata: z.record(z.string().max(100), z.union([z.string(), z.number(), z.boolean()]).nullish())
             .max(50, 'Maximum 50 custom metadata keys')
             .default({}),

  source: z.enum(['manual', 'api', 'import_csv', 'xero_sync', 'quickbooks_sync', 'lease_onboarding']),
});

export type CreateCustomerDto = z.infer<typeof CreateCustomerDto>;
```

### Example 2: Create Invoice DTO

```typescript
// create-invoice.dto.ts
export const CreateInvoiceDto = StrictObject({
  customer_id:  z.string().regex(/^cust_[0-9A-Z]{26}$/, 'Invalid customer ULID prefix'),
  lease_id:     z.string().regex(/^lease_[0-9A-Z]{26}$/).optional(),
  property_id:  z.string().regex(/^prop_[0-9A-Z]{26}$/).optional(),

  issue_date:   z.coerce.date().min(new Date('2000-01-01')).max(new Date('2100-01-01')),
  due_date:     z.coerce.date(),

  currency_code: z.enum(allCurrencies),

  payment_terms: z.enum(['net_0', 'net_7', 'net_14', 'net_30', 'net_45', 'net_60', 'net_90']).default('net_30'),

  line_items: z.array(StrictObject({
    description: z.string().min(1).max(500).trim(),
    quantity:    z.number().positive().lte(1_000_000).multipleOf(0.0001),
    unit_amount: z.number().int().min(0).max(9_999_999_999),  // minor units (cents)
    discount_amount: z.number().int().min(0).max(9_999_999_999).default(0),
    tax_rate_id: z.string().regex(/^tax_[0-9A-Z]{26}$/).optional(),
    ledger_account: z.string().regex(/^[0-9A-Z-]{2,40}$/).optional()
                       .describe('GL account code, e.g. 4100-RENT-INCOME'),
    service_period: StrictObject({ start: z.coerce.date(), end: z.coerce.date() })
                      .refine(p => p.end >= p.start, 'End must be >= start')
                      .optional(),
  })).min(1, 'At least one line item required').max(500),

  discounts: z.array(StrictObject({
    code:      z.string().min(2).max(40).regex(/^[A-Z0-9_-]+$/),
    amount:    z.number().int().min(0).max(9_999_999_999),
    apply_to:  z.enum(['subtotal', 'tax', 'grand_total']).default('subtotal'),
  })).max(5).default([]),

  memo: z.string().max(1000).optional(),

  send_on_issue: z.boolean().default(false),
  send_channels: z.array(z.enum(['email','sms','post','customer_portal'])).max(4).default(['email']),

  custom_fields: z.record(z.string().min(1).max(50), z.string().max(500)).max(20).default({}),
}).refine(
  (data) => data.due_date.getTime() >= data.issue_date.getTime(),
  { message: 'Due date cannot be earlier than issue date', path: ['due_date'] }
).refine(
  (data) => data.line_items.reduce((sum, li) => sum + li.unit_amount * li.quantity, 0) <= 99_999_999_999,
  { message: 'Invoice total cannot exceed $999,999,999.99', path: ['line_items'] }
);

export type CreateInvoiceDto = z.infer<typeof CreateInvoiceDto>;
```

### Example 3: Meter Reading Submission DTO

```typescript
// submit-meter-reading.dto.ts
export const SubmitMeterReadingDto = StrictObject({
  meter_id:        z.string().regex(/^mtr_[0-9A-Z]{26}$/),
  reading_value:   z.number().finite().min(0).max(9_999_999_999.999),
  reading_unit:    z.enum(['kwh','m3','ft3','gal','l','therm','btu']),
  reading_date:    z.coerce.date().max(new Date()),  // No future-dated readings without flag
  allow_future:    z.boolean().default(false),
  source:          z.enum(['manual','amr_api','amr_mbus','import_csv','estimated','inspector_app']),
  read_by_user_id: z.string().regex(/^user_[0-9A-Z]{26}$/).optional(),
  notes:           z.string().max(500).optional(),
  delta_override:  z.boolean().default(false)
                     .describe('Submit true to ignore anomaly guard (meter reading rollback / >10x avg spike'),
  attachments:     z.array(StrictObject({
    filename: z.string().min(1).max(200).regex(/^[\w \-()\\.]+\.(jpg|jpeg|png|pdf)$/i),
    content_type: z.enum(['image/jpeg','image/png','application/pdf']),
    size_bytes: z.number().int().positive().max(10*1024*1024, 'Attachment max 10MB'),
    data_base64: z.string().base64('Attachment must be valid base64'),
  })).max(5).default([]),
}).superRefine((data, ctx) => {
  if (data.reading_date > new Date() && !data.allow_future) {
    ctx.addIssue({ code: 'custom', message: 'Future-dated readings require allow_future flag', path: ['reading_date'] });
  }
  // Attachment base64 size sanity (base64 size ~= 1.33 * binary size)
  for (const [i, att] of data.attachments.entries()) {
    const binaryEstimate = Math.ceil(att.data_base64.length * 0.75);
    if (binaryEstimate > att.size_bytes * 1.1 + 100) {
      ctx.addIssue({ code: 'custom', message: 'size_bytes does not match actual base64 payload size', path: ['attachments', i, 'size_bytes'] });
    }
  }
});
```

### Example 4: User Login DTO

```typescript
// login.dto.ts
export const LoginDto = StrictObject({
  email:    z.string().email().max(254).toLowerCase().trim(),
  password: z.string().min(8).max(128),
  otp_code: z.string().regex(/^\d{6,10}$/).optional()
              .describe('6-digit TOTP, or longer WebAuthn signature (handled separately, but format pre-filtered)'),
  remember_device: z.boolean().default(false),
  captcha_token:   z.string().min(1).max(2048)
                      .describe('Cloudflare Turnstile / hCaptcha token, validated at gateway'),
  return_to:       z.string().url().refine(
                     u => /^https:\/\/[a-z0-9-]+\.cromstel\.com(\/|$)/i.test(new URL(u).hostname),
                     'Return URL must be within *.cromstel.com domain'
                   ).optional(),
});
```

---

## Injection Attack Mitigations

### SQL Injection (SQLi)

| Mitigation                                             | Location
|--------------------------------------------------------|----------------------------------------------
| Prisma parameterized queries everywhere                | Repository layer
| `Raw SQL allowlist` — only 12 audited raw queries exist; each PR touching raw SQL requires Security review | Repository modules
| Postgres `search_path` locked to single schema `app` — no cross-schema queries | DB role configuration
| RLS + `NOCREATEROLE`, `NOSUPERUSER`, `NOBYPASSRLS` on app role | Database DDL
| Libinjection / SQLMap signatures detected at WAF | Cloudflare managed ruleset + custom rule

### NoSQL Injection (Mongo-like filter query params)

When parsing `filter[field][op]=value`, we validate field names against an explicit allowlist:

```typescript
function parseFilter<T>(raw: Record<string, any>, allowedFields: readonly (keyof T)[]): FilterClause[] {
  const clauses: FilterClause[] = [];
  for (const key of Object.keys(raw)) {
    const [field, operator] = parseFilterSyntax(key);
    if (!allowedFields.includes(field as keyof T)) {
      throw new ValidationError(`Filter field not allowed: ${field}. Allowed: ${allowedFields.join(',')}`);
    }
    if (!ALLOWED_OPERATORS.includes(operator)) {
      throw new ValidationError(`Unknown filter operator: ${operator}`);
    }
    clauses.push({ field, operator, value: raw[key] });
  }
  return clauses;
}
```

### OS Command Injection

- No shelling out (`child_process.exec`) from application code.
- All image processing (thumbnail generation) done via isolated Lambda function with no shell, no filesystem write, read-only container root.
- PDF generation via dedicated microservice (Puppeteer Lambda, read-only FS, network egress blocked).

### Server-Side Request Forgery (SSRF) — see threat-model TH-06

- Webhook URLs validated: HTTPS only, no RFC1918 / metadata IPs (169.254.169.254, fd00::/8, etc.)
- Webhook egress via dedicated NAT + Squid proxy with allowlisted IPs; DNS resolution happens on the proxy (rebinding attack defense by checking resolved IP against blocklist after connect).
- Report data-source URLs (e.g. "fetch this XLSX from customer-hosted URL") → isolated Lambda in VPC with no route to metadata service + VPC endpoint S3 only.

### XSS — see session-security.md CSP section, plus:

- React auto-escapes string interpolation (`{userInput}`) by default.
- Places that intentionally render raw HTML (rich-text invoice memo) use `DOMPurify.sanitize(html, DOMPURIFY_CONFIG)` with a strict allowlist.

```typescript
// dompurify-config.ts
export const DOMPURIFY_CONFIG = {
  USE_PROFILES: { html: true },
  ADD_ATTR: ['target'],     // allow target="_blank" only
  FORBID_TAGS: ['iframe','script','form','object','embed','style','base','link','meta','video','audio'],
  FORBID_ATTR: ['onclick','onerror','onload','style','onmouseover','href^="javascript:"'],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|#)/i,
  SANITIZE_DOM: true,
};
```

- CSP headers with nonces enforce even if DOMPurify is bypassed (CSP Report-URI logs → SIEM alert).

### Path Traversal

Uploaded filenames passed through strict sanitizer:
```typescript
function sanitizeFilename(original: string): string {
  // Whitelist only alphanumeric + dot + dash + underscore
  const sanitized = original.replace(/[^\w.\- ]+/g, '_').replace(/\s+/g, '_');
  if (sanitized.startsWith('.') || sanitized.includes('..')) {
    return `unsafe_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }
  return sanitized;
}
```
Also: S3 object keys never derived directly from user-supplied filenames; always use ULID + sanitized suffix.

---

## Unicode & Encoding Normalization

All string inputs are normalized to Unicode NFC form using `String.prototype.normalize('NFC')` before any validation. This prevents homograph attacks and confusable identifier attacks (e.g. the Cyrillic "а" vs Latin "a" in email addresses).

For email addresses specifically:
```typescript
function canonicalizeEmail(email: string): string {
  let [localPart, domain] = email.toLowerCase().trim().split('@');
  // Unicode normalization both parts
  localPart = localPart.normalize('NFC');
  domain    = domain.normalize('NFC');
  // Remove catch-all delimiters (+ suffix) to identify duplicate accounts on gmail etc.
  localPart = localPart.split('+')[0].replace(/\./g, '');
  // Punycode IDN domains
  try { domain = new URL(`http://${domain}`).hostname; } catch {}
  return `${localPart}@${domain}`;
}
```

---

## Output Encoding by Context

Context-aware escaping before rendering data in a different format:

| Output Context          | Encoding Method                                                   | Library / Implementation
|-------------------------|-------------------------------------------------------------------|------------------------------
| JSON API response       | JSON.stringify is safe by design for application/json responses  | Native
| HTML body (React apps)  | React auto-escape text interpolation by default                  | React 18
| HTML attribute          | Escape `& < > " ' /` as entities                                  | he.encode(str, {useNamedReferences: true})
| PDF rendering (invoice) | PDF-lib text operator escapes automatically                      | @pdf-lib + custom regex for raw operators
| CSV export              | RFC 4180 quoting + escape formula injections (`=`,`+`,`-`,`@`) prefixed with single quote | csv-stringify with escape formula option
| XML / UBL invoice       | XML escape `&<>'"` + CDATA only for strings without `]]>`         | fast-xml-parser: true
| Email body (Plain text) | Strip all HTML via DOMPurify textContent output                   | sanitize-html with text filter
| URLs (redirects, links) | encodeURIComponent on each query parameter, validate allowlisted hostnames for redirects | Node querystring + allowlist
| Shell commands          | N/A — no shell execution; see injection mitigation above         | —
| Logging                 | Replace newlines in user-supplied fields to prevent log injection | Pino redact rules + `\n` → `\\n` in custom field formatter

### CSV Formula Injection Example Handler

```typescript
function escapeCsvCell(value: string): string {
  if (typeof value !== 'string') return String(value);
  const dangerous = /^[=+\-@\t\r]/;  // OWASP recommended prefix detection
  if (dangerous.test(value)) {
    // Single quote prefix — spreadsheet apps treat as literal, not formula
    return `'${value}`;
  }
  return value;
}
```

---

## File Upload Validation

### Accepted File Types (Customer Uploads)

| Purpose                  | Allowlisted Content-Types                                       | Max Size |
|--------------------------|-----------------------------------------------------------------|----------|
| Customer avatar          | image/jpeg, image/png, image/webp                               | 2 MB
| Meter reading attachment | image/jpeg, image/png, application/pdf                          | 10 MB (per file, 5 per reading)
| Import data              | text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet | 100 MB
| Invoice attachments (inbound, customer upload to portal) | application/pdf, image/*, application/vnd.ms-excel (.xlsx), text/csv, text/plain | 25 MB per file, 10 per invoice

### Validation Steps Per Upload

1. `Content-Type` header matches allowlist.
2. **Magic-byte sniffing** via `file-type` (not trusting filename or Content-Type header). JPEGs must start with `FF D8 FF`, PNGs with `89 50 4E 47`, PDFs with `%PDF-`.
3. File extension matches detected MIME.
4. Size check against limits.
5. **Re-encoding for images:** uploaded JPEG/PNG images are re-processed through Sharp (libvips) with `rotate()` → strips EXIF metadata (geo, camera info, XMP, thumbnail which might contain webshell payloads).
6. Scanned with ClamAV daemon (Clamd TCP socket) — all uploads go through virus scan before user-accessible storage.
7. MD5/SHA-256 hash checked against MalwareBazaar threat intel feed (for executables mis-suffixed as .pdf).

---

## GraphQL (Admin Internal Only)

For the internal admin GraphQL API (not exposed to customers; used by CromStel support only):
- GraphQL-specific mitigations: `graphql-armor`: maximum depth 10, query cost limit 1000, allowlist of persisted queries (only known queries accepted).
- Introspection disabled in production.
- All resolvers go through the same Zod DTO + OPA ABAC as REST endpoints.
- Batched operations limited to max 50 mutations / request.
