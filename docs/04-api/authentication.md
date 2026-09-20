# Authentication

## Authentication Models

myTenant Invoice uses three complementary authentication mechanisms are supported:

1. **User Session JWTs (interactive users via dashboard logins)
2. **API Key → JWT Exchange (server-to-server integrations)
3. **OAuth 2.0 Client Credentials (M2M / service accounts)
4. **Personal Access Tokens (PATs, non-expiring for admin automation)

All mechanisms ultimately produce signed **short-lived JWT access tokens valid for **15 minutes** maximum lifetime. Refresh tokens (where issued) live 7 days rolling windows.

## Token Types Summary

| Flow                | Lifetime     | Use Case                              | Scoped to |
|---------------------|------------|---------------------------------------|------------|
| User Session JWT   | 15 min     | Dashboard UI, embedded widgets               | User + Org  |
| API Key Exchange   | 15 min / 7d refresh | Backend server integrations | Org       |
| OAuth Client Credentials | 15 min     | M2M, scheduled jobs        | Service Account + Org(s) |
| Personal Access Token (PAT) | 90 days (configurable) | CI/CD, scripts | User + Org |

---

## 1. User Session Authentication (Sessions)

### Password + TOTP MFA Login Flow

```
POST /v1/auth/login
```

Request:

```json
{
  "email": "property.manager@cromstel.com",
  "password": "correct horse battery staple",
  "otp_code": "842917",
  "remember_device": true
}
```

Successful Response (200 OK):
```json
{
  "data": {
    "access_token": "<your-access-token>",
    "token_type": "Bearer",
    "expires_in": 900,
    "refresh_token": "refresh_01HF932HhM8Df4aWQv8Q5X7kQqXz",
    "user": {
      "id": "user_01HF932V88E2XWVVSBD9TMNQN2",
      "email": "property.manager@cromstel.com",
      "org_id": "org_01HF92B6T7XN578Q5WV9QNBG0",
      "roles": ["org:admin"],
      "mfa_enabled": true
    },
    "session_id": "sess_01HF932J9N8J3QZ5X9W2R4T6Y"
  }
}
```

### Refresh Token

```
POST /v1/auth/refresh
```

```json
{
  "refresh_token": "refresh_01HF932HhM8Df4aWQv8Q5X7kQqXz",
  "rotate": true
}
```

Response issues a new access token + refresh token; the previous refresh token is invalidated (rotation).

### Logout

```
POST /v1/auth/logout
Authorization: Bearer <access_token>
```

Invalidates both access and refresh tokens (replay-prevention record stored in Redis for remaining TTL).

---

## 2. API Key Exchange (Server Integrations)

API keys are long-lived secrets issued per **Organization** → Developer Settings → API Keys page. They are prefixed `mtk_live_` (production) or `mtk_test_` (sandbox), formatted as:

```
mtk_live_48charsHex16chars
└─ prefix   └─ entropy └─ checksum
```

API keys are shown only at creation. Store them securely; lost keys must be rotated.

### Exchange API Key for JWT

```
POST /v1/auth/token
Content-Type: application/x-www-form-urlencoded
```

Body (form-encoded, not JSON):

```
grant_type=urn:cromstel:params:oauth:grant-type:api-key
&client_assertion_type=urn:ietf:params:oauth:client-assertion-type:api-key
&client_assertion=mtk_live_a7f3c9d2e1b0a8f6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2
&scope=invoices:read invoices:write payments:write
```

Response (200 OK):
```json
{
  "access_token": "<your-access-token>",
  "token_type": "Bearer",
  "expires_in": 900,
  "scope": "invoices:read invoices:write payments:write"
}
```

Subsequent API calls include:

```
Authorization: Bearer <your-access-token>
```

### API Key Scopes (comma or space-delimited requested)

| Scope                     | Permissions                                                 |
|-------------------------|---------------------------------------------------------|
| `organizations:read`  | View org profile, billing settings              |
| `properties:read`     | List/show properties, units, meters                |
| `properties:write`    | Create/update/archive properties, units       |
| `customers:read`     | Read customer records, contacts, leases       |
| `customers:write`    | Create/update customers, leases        |
| `invoices:read`      | List/download invoices, line items       |
| `invoices:write`     | Draft/send/void/credit invoices       |
| `payments:read`       | View payment history          |
| `payments:write`     | Record payments, refunds               |
| `meters:read`        | List meter configurations, readings  |
| `meters:write`       | Submit meter readings        |
| `reports:read`        | Generate/export reports      |
| `webhooks:write`      | Manage subscriptions, deliveries |
| `webhooks:read`       | View subscription delivery logs       |
| `audit:read`           | Read audit logs (org:admin only)     |

---

## 3. OAuth 2.0 Client Credentials (M2M)

For enterprise integrations that require machine identities independent of human users, or that may span organizations (multi-org portfolios).

### Obtain Token

```
POST /v1/auth/oauth2/token
Authorization: Basic <base64(client_id:client_secret)>
Content-Type: application/x-www-form-urlencoded
```

```
grant_type=client_credentials
&scope=invoices:read reports:read
&audience=https://api.mytenant-invoice.cromstel.com/v1
```

The `Authorization` claim `org_ids: ["org_A","org_B"] in the JWT — service account may operate on multiple orgs if the service account is provisioned. Use `X-Organization-ID` header to select the target org per request.

---

## 4. Personal Access Tokens (PAT)

PATs bearer tokens that bypass JWT exchange. Use for CI/CD pipelines, one-off scripts, local developer tools. They do not require refresh token.

Issued per user; user revocation is user (1-365 days (default 90). Scoped to user's role subset.

### Using a PAT
```
Authorization: Bearer mpt_01HF933Z2S9K4VJFQ34567890ABCDEF1234567890ABCDEF1234567890ABCDEF
```

PATs bypass refresh. PAT subject type: `typ=pat` claim in validated.

---

## JWT Structure & Validation

### Algorithm

Access tokens use **EdDSA (Ed25519)** asymmetric signing. Keys rotated every 24h active key plus 2 previous keys cached for clock skew tolerance.

### Public Keys Endpoint

```
GET https://auth.mytenant-invoice.cromstel.com/.well-known/jwks.json
```

Standard JWKS format; kid rotates; `alg: "EdDSA".

### Standard Claims

```json
{
  "iss": "https://auth.mytenant-invoice.cromstel.com",
  "aud": "https://api.mytenant-invoice.cromstel.com",
  "sub": "user_01HF932V88E2XWVVSBD9TMNQN2",
  "org_id": "org_01HF92B6T7XN578Q5WV9QNBG0",
  "type": "user_session" | "api_key" | "client_credentials" | "pat",
  "roles": ["org:admin", "property:manager"],
  "scopes": ["invoices:read", "invoices:write"],
  "iat": 1710503800,
  "exp": 1710504700,
  "jti": "jti_01HF932H7NPXF3ZWKCXWYGPZJR4Y",
  "sid": "sess_01HF932J9N8J3QZ5X9W2R4T6Y"
}
```

### Client-Side Validation Checklist

1. **alg**: `EdDSA` only; reject tokens with `alg: "HS256` or `none`
2. **iss**: exact match expected issuer
3. **aud**: matches your expected audience
4. **exp**: current time < exp (allow 5s leeway)
5. **nbf** if present: current time > nbf
6. **org_id**: present and matches the organization you expect
7. **scopes**: contains required scope for the action
8. **jti**: check against token revocation list (for critical operations)

### Revocation

Tokens revoked via logout, key rotation, or admin action. For stateless + distributed revocation is implemented via:
- Short token lifetime (15m) for blast-radius
- Redis bloom filter of revoked jti (populated on logout/explicit revoke) for realtime revocation (<10ms check penalty; misses accepted within 15m window for non-critical reads.

## Security Best Practices

1. **Never embed tokens in client-side browser code (SPA) or mobile apps. Prefer backend proxy with short-lived session cookies + CSRF tokens.
2. **Transmit only over TLS 1.3; enable HSTS.
3. **Rotate API keys every 90 days; use key rotation without zero-downtime dual-key window.
4. **Do not log Authorization headers in application logs, request bin, or crash dumps.
5. **Bind tokens to specific IP ranges for service accounts where possible via dashboard allowlisting.
6. **MFA mandatory for all human users org-wide via SSO enforcement policy.
7. **Use least-privilege scopes; start read-only for read operations.
8. **Validate JWT locally on the JWKS, never offline-verify locally; refresh JWKS cached 1h max.

## Failure Modes

| Scenario | HTTP Status | Error Code |
|----------|-------------|------------|
| Missing/ malformed auth | 401 | `auth_missing`
| Expired token | 401 | `auth_token_expired`
| Invalid signature | 401 | `auth_invalid_signature`
| Revoked token | 401 | `auth_token_revoked`
| Wrong org scope | 403 | `auth_org_mismatch`
| Insufficient scope | 403 | `auth_insufficient_scope`
| Locked user / disabled API key | 401 | `auth_locked`
| MFA required | 401 | `auth_mfa_required`
| Device cookie expired; re-login required | 401 | `auth_device_expired`

Error payload:
```json
{
  "error": {
    "code": "auth_token_expired",
    "message": "Access token expired at 2024-03-15T14:35:00Z. Use the refresh_token grant to obtain a new access token.",
    "request_id": "req_01HF93450J6042P30G0444R5H",
    "details": [{"field":"Authorization header","hint":"POST /v1/auth/refresh to renew"]
  }
}
```
