# Rate Limits

## Philosophy

Rate limits protect platform stability, prevent abuse, and ensure fair resource allocation across tenants. myTenant Invoice enforces rate limits at multiple layers using a **token bucket + sliding log hybrid** algorithm enforced at the edge API Gateway with service-layer per-endpoint overrides.

Limits are **soft where possible**: you will receive warning headers before hitting hard 429 responses, giving you time to adaptively throttle client-side.

## Limits by Authentication Context

All limits are expressed per time window (minute / hour / day).

### Standard (Free / Pro Tiers)

| Identity Class                  | Per-Minute | Per-Hour | Per-Day | Burst Allowance |
|---------------------------------|-----------:|---------:|--------:|----------------:|
| User session (JWT)              |       500  |   10,000 | 100,000 |             100 |
| API key (per organization)      |     1,000  |   40,000 | 500,000 |             250 |
| Service account / M2M           |     2,000  |   80,000 | 1M      |             500 |
| Personal Access Token           |       250  |    5,000 |  50,000 |              50 |
| Unauthenticated (health, oas)   |        60  |    1,000 |  10,000 |              20 |
| Webhook receiver (outbound, retries counted per subscription) | — | — | — | 20 concurrent deliveries per webhook

### Enterprise Tier

Enterprise clients receive custom quotas by contract. Typical uplift:

| Identity Class                  | Per-Minute | Per-Hour | Per-Day  |
|---------------------------------|-----------:|---------:|---------:|
| API key                         |    10,000  |  400,000 | 5,000,000 |
| Service account                 |    20,000  |  800,000 | 10M      |

Contact enterprise-support@cromstel.com to raise limits with 48h SLA.

## Per-Endpoint Overrides

Certain expensive endpoints have tighter, dedicated quotas regardless of global bucket. These are deducted FROM the global bucket AND checked against their own limit.

| Endpoint                                           | Limit Per Org
|----------------------------------------------------|---------------------------|
| `POST /v1/organizations/*/reports`                 | 20 / hour, 100 / day
| `POST /v1/organizations/*/invoices/batch-generate` | 12 / day (one per billing cycle typically)
| `POST /v1/organizations/*/meters/readings/batch`   | 60 / hour, 10,000 rows per call
| `GET  /v1/invoices/*/pdf`                          | 1,000 / hour
| `POST /v1/webhooks/*/test`                         | 10 / minute per webhook
| `POST /v1/payments/intent`                         | 500 / minute (staggering PSP calls)
| `POST /v1/auth/token` (API key → JWT)              | 60 / minute per key (cache your JWT!)
| `POST /v1/auth/login`                              | 10 / minute per IP (anti-brute force)
| `GET  /v1/security/audit-logs`                     | 100 / minute

## Concurrency Limits

| Dimension                     | Limit
|-------------------------------|----------------------
| In-flight requests per JWT subject | 20
| In-flight per org (all identities combined) | 200
| Long-running requests (>10s)  | Max 10 concurrent per org

Exceeding concurrency returns `429 rate_limit_concurrent` with `Retry-After: 2`.

## Response Headers

Every API response carries these headers regardless of status code:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 842
X-RateLimit-Reset: 1710506400
X-RateLimit-Window: 60
X-RateLimit-Scope: org:org_01HF92B6T7XN578Q5WV9QNBG0
X-RateLimit-Warning-Remaining: 0
```

| Header                              | Meaning
|-------------------------------------|----------------------------------
| `X-RateLimit-Limit`                 | Quota for current window
| `X-RateLimit-Remaining`             | Calls left in window
| `X-RateLimit-Reset`                 | Unix epoch (seconds) when window resets
| `X-RateLimit-Window`                | Duration in seconds of current window
| `X-RateLimit-Scope`                 | Entity the limit applies to: `ip:*`, `sub:*`, `org:*`, `endpoint:*`
| `X-RateLimit-Warning-Remaining`     | When remaining drops to ≤ 10%, number of warning responses left before 429s start

### Warning Thresholds

When you've used **90%** of a window's quota, the response carries header:
```
X-RateLimit-Warning: true
X-RateLimit-Warning-Remaining: 47
```

This is NOT an error (HTTP 200 continues) but a signal to begin client-side adaptive throttling. At **100%**, the response becomes `429 Too Many Requests`.

## 429 Response Details

```
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 18
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1710506418
```

```json
{
  "error": {
    "code": "rate_limit_per_minute",
    "message": "Per-minute quota exhausted for org:org_01HF92B6T7XN578Q5WV9QNBG0. 18 seconds remain in the window.",
    "type": "rate_limit",
    "status": 429,
    "request_id": "req_01HF93P1J7M0K7R5N4V8Z1",
    "details": [
      {
        "scope": "org:org_01HF92B6T7XN578Q5WV9QNBG0",
        "window_seconds": 60,
        "limit": 1000,
        "used": 1000,
        "retry_after_seconds": 18,
        "per_endpoint_overrides": [
          { "endpoint": "POST /v1/organizations/*/reports", "used_in_window": 4, "limit": 20 }
        ]
      }
    ]
  }
}
```

## Enforcement Layers

1. **Cloudflare Edge** — IP-based blanket DoS protection and geo filtering (blocklist).
2. **Kong Gateway (Token Bucket)** — per-org/per-subject minute/hour/day quotas using Redis cluster for coordination (1ms average add overhead).
3. **Service Middleware (Sliding Log)** — per-endpoint overrides (e.g. 20 reports/hour) using per-org sorted sets in Redis.
4. **Database Statement Timeouts** — absolute execution-time cap regardless of rate limit status: 30s for reads, 10s for writes, 5m for async batch jobs only.

## Best Practices

### 1. Cache JWTs Locally

`POST /v1/auth/token` has its own small quota (60/min/key). **Reuse JWTs for their full 15-minute lifetime** instead of fetching a new one per request.

```python
# Recommended: cached JWT client
class AuthenticatedClient:
    def __init__(self, api_key):
        self.api_key = api_key
        self._jwt = None
        self._jwt_exp = 0

    def _get_jwt(self):
        if self._jwt and time.time() < self._jwt_exp - 60:
            return self._jwt
        resp = requests.post(AUTH_URL, data={...api_key exchange...})
        self._jwt = resp.json()["access_token"]
        self._jwt_exp = time.time() + resp.json()["expires_in"]
        return self._jwt
```

### 2. Respect Retry-After

On 429, sleep `Retry-After` seconds (in response header OR error.details[0].retry_after_seconds). NEVER spin without sleep.

### 3. Jittered Exponential Backoff

Generic retry pattern for 429/5xx:

```
delay = min(max_backoff, base * (2 ** attempt)) + random_uniform(-base/2, +base/2)
```

Default parameters we test against:
- base = 0.5s
- max_backoff = 60s
- jitter = ±50% of base
- max_attempts = 8

### 4. Batch Requests

Use the documented batch endpoints (e.g. `POST /v1/.../batch`) where available instead of N individual calls:
- 1 batch call for 1,000 meter readings counts as **1** request, not 1,000.
- Batch endpoints have their own larger quotas.

### 5. Webhooks Over Polling

Polling `GET /invoices` every minute uses 1,440 calls/day per org. A webhook subscription to `invoice.issued` uses **0** polling requests and is more timely.

### 6. Parallelism Cap

Even if you have headroom in per-minute quota, running > 20 parallel requests often hits concurrency caps or downstream database bottlenecks. Cap HTTP connection pool to **10-20** for standard tier integrations.

## Idempotency and Rate Limits

When you receive a 429 or 5xx response, **the request was NOT charged to any state mutation** (transaction rolled back). Retrying with the same `Idempotency-Key` is safe and will return the original cached result if a previous attempt did eventually succeed (within 24h).

## Monitoring Rate Limit Usage

### Dashboard

**Developer → Rate Limits** in the dashboard shows realtime charts per identity:
- Current window consumption
- 7-day trend (to plan quota increases)
- Top offenders (by endpoint)
- Recent 429 events (last 1,000)

### Events

Subscribe to webhook event `security.rate_limit.exceeded` to trigger on-call alerts on FIRST 429 (configurable threshold percent).

### Metrics Endpoint

Enterprise clients: pull JSON time-series from:
```
GET /v1/organizations/{org_id}/metrics/rate-limits?window=last_24h&granularity=5m
Authorization: Bearer <jwt with audit:read scope>
```

```json
{
  "data": {
    "series": [
      {
        "timestamp": "2024-03-15T14:00:00Z",
        "window_seconds": 60,
        "limit": 1000,
        "used": 842,
        "429_count": 0
      }
    ]
  }
}
```

## Abuse / Misuse

Patterns we consider abusive and may result in **temporary IP/key ban** (24h) without warning:
- Evading rate limits via rotation of multiple API keys or IPs
- Scraping with the intent to reconstruct a full tenant dataset via pagination without using the Reports export API
- Rapid-fire probing with invalid credentials (brute force) → see auth-rate-limits below
- Attempting cache-busting random query params to bypass CDN protections
- Deliberately ignoring `Retry-After` headers

For legitimate workload spikes (e.g. migration, seasonal billing run), open a support ticket **48h in advance** to request a temporary quota uplift — we're happy to approve.

## Auth-Specific Throttles (Anti-Brute Force)

Even before API-wide rate limits, identity endpoints enforce strict controls:

| Action                      | Limit                                | Lockout on Exceed
|-----------------------------|--------------------------------------|------------------
| `/auth/login` failure per user | 5 per 10 minutes                 | 30 min account lock
| `/auth/login` per IP        | 100 per hour                         | 4h IP ban
| TOTP validation failures    | 3 per user per 5 minutes             | MFA reset required via email
| Password reset emails       | 3 per email per hour                 | Silent drop
| API key exchange failures   | 10 per key per minute                | 1h key freeze

All lockouts fire security events visible in audit logs.
