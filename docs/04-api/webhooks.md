# Webhooks

## Overview

Webhooks deliver real-time event notifications from the myTenant Invoice platform to your HTTP(S) endpoints. Use webhooks to trigger downstream automation: sync invoices to your ERP, post paid invoices to Slack, kick off onboarding when a lease starts, or trigger collections workflows when invoices become overdue.

Webhooks are a **push model** — we call your endpoint; polling the API for state changes is discouraged due to rate limits.

## Endpoint Requirements

1. **HTTPS only** (TLS 1.2+; self-signed certs rejected).
2. **Publicly routable URL** (localhost, `.local`, RFC1918 IPs rejected; use tools like ngrok for local dev).
3. **HTTP 2xx response within 10 seconds.** Slow responses trigger retry logic.
4. **Idempotent consumer:** use `event_id` in the payload to deduplicate — we guarantee at-least-once delivery.
5. **Always validate the signature (see below) — do NOT trust the raw payload if signature fails.**

## Creating a Webhook Subscription

```http
POST /v1/organizations/org_01HF92B6T7XN578Q5WV9QNBG0/webhooks HTTP/1.1
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "url": "https://erp.example.com/mytenant/webhook",
  "description": "ERP sync for invoices and payments",
  "events": [
    "invoice.created",
    "invoice.issued",
    "invoice.overdue",
    "invoice.paid",
    "invoice.voided",
    "payment.succeeded",
    "payment.failed",
    "payment.refunded",
    "lease.started",
    "lease.ended",
    "meter.reading.anomaly",
    "customer.created"
  ],
  "api_version": "2024-03-01",
  "enabled": true,
  "metadata": {
    "environment": "production",
    "system": "netsuite-sync"
  },
  "secret_algorithm": "HMAC-SHA256",
  "connect_timeout_ms": 3000,
  "read_timeout_ms": 10000,
  "retry_policy": {
    "strategy": "exponential_backoff",
    "max_attempts": 8,
    "backoff_base_seconds": 30,
    "backoff_multiplier": 2,
    "max_backoff_seconds": 3600
  }
}
```

Response returns the signing secret — **save it only once** (we never show it again).

```json
{
  "data": {
    "id": "wh_01HF93B7X5K7N9P1Q3S5T7V9X1",
    "url": "https://erp.example.com/mytenant/webhook",
    "status": "active",
    "events": ["invoice.created", "..."],
    "signing_secret": "whsec_v1_01HF93B7T4Q2J0X9Z8V7B6N5M4L3K2J1H0G9F8E7D6C5B4A3",
    "secret_algorithm": "HMAC-SHA256",
    "created_at": "2024-03-15T14:35:00Z"
  }
}
```

## Signed Payloads (HMAC-SHA256)

Every webhook request includes three headers you MUST verify before processing:

| Header                         | Value Example                                                                                                                                      |
|--------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------|
| `MyTenant-Signature`           | `t=1710504900,v1=9b1c4e6f8a2d0c1b3e5f7a9b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d`                                                                  |
| `MyTenant-Event-Id`            | `evt_01HF93C2K9M5N7P9Q1R3S5T7V9`                                                                                                                  |
| `MyTenant-Event-Type`          | `invoice.paid`                                                                                                                               |

### Signature Construction

The signature header has format `t=<timestamp>,v1=<hex_hmac>`:

1. `t` is the Unix epoch (seconds) when we signed.
2. `v1` is the HMAC-SHA256 hex digest over the string: `<timestamp>.<raw_json_payload_bytes>` keyed by your 64-char `signing_secret` (after the `whsec_v1_` prefix).

### Step-by-Step Verification Example (Node.js)

```javascript
const crypto = require('crypto');

const SIGNING_SECRET_PREFIX = 'whsec_v1_';
const MAX_SKEW_SECONDS = 300;  // reject if >5min old

function verifyWebhook(headers, rawBody, signingSecret) {
  const signatureHeader = headers['mytenant-signature'];
  if (!signatureHeader) throw new Error('Missing signature header');

  // 1. Extract timestamp and signature from header
  const parts = signatureHeader.split(',');
  const tPart = parts.find(p => p.startsWith('t='));
  const v1Part = parts.find(p => p.startsWith('v1='));
  if (!tPart || !v1Part) throw new Error('Malformed signature header');

  const timestamp = parseInt(tPart.slice(2), 10);
  const receivedSig = v1Part.slice(3);

  // 2. Reject old requests (anti-replay window)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > MAX_SKEW_SECONDS) {
    throw new Error('Timestamp outside acceptable skew window');
  }

  // 3. Compute expected HMAC
  const secret = signingSecret.startsWith(SIGNING_SECRET_PREFIX)
    ? signingSecret.slice(SIGNING_SECRET_PREFIX.length)
    : signingSecret;

  const signedContent = `${timestamp}.${rawBody.toString('utf8')}`;
  const expectedSig = crypto
    .createHmac('sha256', Buffer.from(secret, 'utf8'))
    .update(signedContent)
    .digest('hex');

  // 4. Constant-time comparison
  const expectedBuf = Buffer.from(expectedSig, 'hex');
  const receivedBuf = Buffer.from(receivedSig, 'hex');
  if (expectedBuf.length !== receivedBuf.length) {
    throw new Error('Invalid signature length');
  }
  const ok = crypto.timingSafeEqual(expectedBuf, receivedBuf);
  if (!ok) throw new Error('Signature mismatch');

  return { verified: true, eventAgeSeconds: now - timestamp };
}

// Usage (Express example)
app.post('/mytenant/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    const { verified } = verifyWebhook(req.headers, req.body, process.env.MYTENANT_WEBHOOK_SECRET);
    if (!verified) return res.status(401).send('invalid signature');

    const event = JSON.parse(req.body.toString());
    console.log('Processing event:', event.id, event.type);

    // Deduplicate using event.id in your DB/cache
    // processEvent(event);

    res.status(200).send('ok');
  } catch (err) {
    console.error('Webhook verify failed:', err.message);
    res.status(401).send('unauthorized');
  }
});
```

### Verification Example (Python / Django)

```python
import hashlib, hmac, time, json
from django.http import HttpResponse, HttpResponseForbidden

SIGNING_SECRET_PREFIX = "whsec_v1_"
MAX_SKEW = 300

def verify(request):
    sig_header = request.META.get("HTTP_MYTENANT_SIGNATURE")
    if not sig_header:
        return HttpResponseForbidden("no sig")

    parts = dict(p.split("=", 1) for p in sig_header.split(","))
    ts = int(parts["t"])
    if abs(time.time() - ts) > MAX_SKEW:
        return HttpResponseForbidden("stale")

    secret = settings.MYTENANT_WEBHOOK_SECRET
    if secret.startswith(SIGNING_SECRET_PREFIX):
        secret = secret[len(SIGNING_SECRET_PREFIX):]

    signed = f"{ts}.{request.body.decode('utf-8')}".encode()
    expected = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()

    if not hmac.compare_digest(expected, parts["v1"]):
        return HttpResponseForbidden("bad sig")

    event = json.loads(request.body)
    # ... dedupe + process ...
    return HttpResponse("ok", status=200)
```

## Request Payload Schema

```json
{
  "id": "evt_01HF93D1X7J5N3P9Q1R2S4T6V8",
  "type": "invoice.paid",
  "api_version": "2024-03-01",
  "created_at": "2024-03-15T14:35:00.123Z",
  "org_id": "org_01HF92B6T7XN578Q5WV9QNBG0",
  "webhook_id": "wh_01HF93B7X5K7N9P1Q3S5T7V9X1",
  "live_mode": true,
  "metadata": {
    "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
    "attempt": 1,
    "delivery_id": "wdl_01HF93D2Q6X9J4N7B8V5G2D1"
  },
  "actor": {
    "type": "user",                               // user | api_key | system
    "id": "user_01HF932V88E2XWVVSBD9TMNQN2",
    "ip": "203.0.113.42"
  },
  "data": {
    "object": "invoice",
    "id": "inv_01HF92D4T9X0WF51P7HN15Q",
    "previous_attributes": {
      "status": "issued",
      "amount_paid": 0,
      "amount_due": 208251
    },
    "current": {
      "status": "paid",
      "amount_paid": 208251,
      "amount_due": 0,
      "paid_at": "2024-03-15T14:34:58Z",
      "number": "INV-2024-04-000123",
      "customer_id": "cust_01HF92CP9D7FXRK1P5Q4MX8",
      "grand_total": 208251,
      "currency_code": "USD"
    }
  }
}
```

Key fields:
- `data.previous_attributes`: state before the change (null for create events)
- `data.current`: post-change snapshot of resource core fields (sufficient for most automation — call the GET endpoint for full detail)

## Retry Logic

Delivery failures (non-2xx, timeout, connection error, DNS failure, TLS error) trigger automatic retry with **truncated exponential backoff + jitter**.

Default retry schedule:

| Attempt | Delay Before Retry (base=30s, multiplier=2, jitter ±20%) |
|---------|-----------------------------------------------------------|
| 1       | 0 (immediate on first HTTP attempt)                       |
| 2       | ~30s ± 6s                                                 |
| 3       | ~60s ± 12s                                                |
| 4       | ~120s ± 24s                                               |
| 5       | ~240s ± 48s                                               |
| 6       | ~480s ± 96s                                               |
| 7       | ~900s (15 min cap) ± 180s                                 |
| 8       | ~3600s (60 min cap) ± 720s — final attempt                |

After 8 failed attempts:
- Subscription status → `disabled_with_failures` (not auto-re-enabled; human must investigate).
- `webhook.subscription.disabled` event fired to your **other** active webhooks so you can alert on-call.
- Delivery log retained 30 days; manual `replay` endpoint lets you resubmit after fix.

### Dead-Letter Queue (DLQ)

Enterprise tier: failed deliveries automatically published to a private SQS-like queue you can pull via:
```
GET /v1/webhooks/{webhook_id}/dlq?limit=100
POST /v1/webhooks/{webhook_id}/dlq/{delivery_id}/replay
DELETE /v1/webhooks/{webhook_id}/dlq/{delivery_id}
```

## Event Catalog

### Invoices
| Event                                | Fires When                                                        |
|--------------------------------------|-------------------------------------------------------------------|
| `invoice.created`                    | Draft invoice saved (manual or batch)                             |
| `invoice.issued`                     | Invoice finalized + sent to customer                              |
| `invoice.updated`                    | Any field changed on a draft invoice                              |
| `invoice.sent`                       | Email/SMS/Post physical delivery dispatched (per channel, 1 event per channel + method) |
| `invoice.overdue`                    | Due date passes with balance due > 0                              |
| `invoice.payment_partial`            | Partial payment applied                                           |
| `invoice.paid`                       | Invoice fully paid (amount_due reaches 0)                         |
| `invoice.voided`                     | Invoice voided                                                    |
| `invoice.credited`                   | Credit note issued against invoice                                |
| `invoice.wrote_off`                  | Balance written off as bad debt                                   |
| `invoice.reminder.sent`              | Overdue reminder delivered                                        |
| `invoice.downloaded`                 | Customer viewed/downloaded PDF (opt-in tracking)                  |

### Payments
| Event                                | Fires When                                                        |
|--------------------------------------|-------------------------------------------------------------------|
| `payment.created`                    | Payment record created (pending)                                  |
| `payment.succeeded`                  | Payment processed and confirmed (captured)                        |
| `payment.failed`                     | Decline / insufficient funds / 3DS failed                         |
| `payment.refunded`                   | Full or partial refund executed                                   |
| `payment.refund.failed`              | Refund could not be issued                                        |
| `payment.dispute.created`            | Chargeback received from card network                              |
| `payment.dispute.won`                | Chargeback resolved in merchant favor                             |
| `payment.dispute.lost`               | Chargeback resolved against merchant                              |
| `payment.autopay.scheduled`          | Autopay queued for next invoice due date                          |
| `payment.autopay.failed`             | Autopay attempt failed                                            |

### Leases & Customers
| Event                                | Fires When                                                        |
|--------------------------------------|-------------------------------------------------------------------|
| `customer.created`                   | New customer added                                                |
| `customer.updated`                   | Customer contact/bank info changed                                |
| `customer.archived`                  | Customer archived                                                 |
| `lease.created`                      | Lease record created (pending move-in)                            |
| `lease.started`                      | Lease start date reached; occupancy active                        |
| `lease.amended`                      | Lease amendment signed                                            |
| `lease.renewed`                      | Lease renewed (new lease record)                                  |
| `lease.termination_scheduled`        | End date set (planned move-out)                                   |
| `lease.ended`                        | Actual move-out / final reconciliation complete                   |

### Properties & Meters
| Event                                | Fires When                                                        |
|--------------------------------------|-------------------------------------------------------------------|
| `property.created`                   | New property added                                                |
| `unit.occupied`                      | Unit marked occupied (lease start)                                |
| `unit.vacated`                       | Unit vacated (lease end)                                          |
| `meter.reading.submitted`            | Meter reading submitted                                           |
| `meter.reading.anomaly`              | Anomaly detected: spike/drop/rollback/leak pattern                |
| `meter.calculation.complete`         | Periodic utility charge computed for invoice                      |

### Reports & Jobs
| Event                                | Fires When                                                        |
|--------------------------------------|-------------------------------------------------------------------|
| `report.completed`                   | Generated report ready to download                                |
| `report.failed`                      | Report generation error                                           |
| `batch.invoices.completed`           | End-of-period batch invoice run finished (with counts)            |
| `batch.payments.reconciled`          | Bank statement reconciliation batch completed                     |

### Security & Admin
| Event                                | Fires When                                                        |
|--------------------------------------|-------------------------------------------------------------------|
| `org.member.joined`                  | New member accepts invite + role assigned                         |
| `org.member.removed`                 | Member removed                                                    |
| `auth.mfa.enabled`                   | User enrolls TOTP/U2F/WebAuthn                                    |
| `auth.impersonation.started`         | Support/admin impersonates a user                                 |
| `auth.impersonation.ended`           | Impersonation session ended                                       |
| `api_key.created`                    | New API key issued (masked value in payload)                      |
| `api_key.revoked`                    | API key revoked                                                   |
| `webhook.subscription.disabled`      | Webhook disabled (too many failures / manually)                   |
| `security.authz.denied`              | Authorization policy denied (high-severity alert; SIEM feed)      |
| `security.rate_limit.exceeded`       | IP/subject rate-limited (potential abuse)                         |
| `security.data_export.completed`     | GDPR/CCPA data export package ready for download                  |

### Billing (Platform Billing — CromStel charges to org)
| Event                                | Fires When                                                        |
|--------------------------------------|-------------------------------------------------------------------|
| `platform.invoice.issued`            | CromStel issues invoice to the org for SaaS usage                 |
| `platform.payment.succeeded`         | Org pays platform invoice                                         |
| `platform.subscription.cancelled`    | Org subscription cancelled                                        |

## IP Allowlist (Egress)

Webhook calls originate from these static IPs. You may firewall allow them:

| Region    | IP CIDRs                                                    |
|-----------|-------------------------------------------------------------|
| US-East   | `34.224.12.0/24`, `3.233.180.0/25`                         |
| EU-West   | `18.171.23.128/25`, `35.242.156.0/24`                       |
| AP-South  | `13.234.52.0/24`, `65.2.44.0/24`                           |

## Monitoring & Debugging

- Dashboard **Developer → Webhooks → Deliveries** shows full attempt history (redacted request/response).
- Send test ping: `POST /v1/webhooks/{webhook_id}/test` returns the immediate HTTP result synchronously.
- Alert channels: PagerDuty/OpsGenie/Slack via event subscriptions to `webhook.subscription.disabled`.
