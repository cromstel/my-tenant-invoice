# Deployment Guide — myTenant Invoice SaaS

**Document Owner:** CromStel IT Group — DevOps Team
**Last Updated:** 2026-09-20
**Target Stacks:** Vercel (Edge + Serverless) · PlanetScale (MySQL 8) · Upstash (Redis + Kafka)

---

## 1. Architecture Overview

```
                 ┌─────────────────────────────────────────────────────┐
                 │                   Vercel Edge                       │
                 │  ┌───────────┐  ┌──────────────┐  ┌─────────────┐   │
                 │  │  CDN /    │  │  Edge Middle │  │  Image Opt. │   │
                 │  │  Static   │  │  ware (Auth, │  │  / Cache    │   │
                 │  │  Assets   │  │  Sec, Routing│  │             │   │
                 │  └─────┬─────┘  └──────┬───────┘  └──────┬──────┘   │
                 └────────┼───────────────┼─────────────────┼──────────┘
                          │               │                 │
                 ┌────────▼───────────────▼─────────────────▼──────────┐
                 │              Vercel Serverless (us-east-1)          │
                 │  ┌────────────┐  ┌───────────┐  ┌───────────────┐  │
                 │  │ Next.js SSR│  │ API Routes│  │ BullMQ Workers│  │
                 │  │ / ISR Pages│  │ / TRPC    │  │ (Crons/Async) │  │
                 │  └─────┬──────┘  └─────┬─────┘  └───────┬───────┘  │
                 └────────┼───────────────┼─────────────────┼──────────┘
                          │               │                 │
         ┌────────────────▼──┐  ┌─────────▼──────────┐  ┌──▼──────────────┐
         │ PlanetScale MySQL │  │   Upstash Redis     │  │   Stripe /       │
         │  (Primary + RR)   │  │ (Sessions, Queues, │  │   Resend /       │
         │  us-east-1 + us-  │  │  Caching, Rate-Lim) │  │   Sentry SaaS    │
         │  west-2 (replica) │  │   Global Tier       │  │                  │
         └───────────────────┘  └────────────────────┘  └──────────────────┘
```

---

## 2. Prerequisites

| Tool / Service       | Version / Tier                     | Purpose                                  |
|----------------------|------------------------------------|------------------------------------------|
| Vercel Account       | Pro / Enterprise                   | Hosting, Edge, Serverless, Preview URLs  |
| PlanetScale Account  | Scaler Pro (or Enterprise)         | Managed MySQL with branching             |
| Upstash Account      | Global Tier (Redis + Kafka)        | Sessions, caching, BullMQ queues         |
| Stripe Account       | Business — connected platform      | Payment processing, webhooks             |
| Resend Account       | Pro                                | Transactional email / SMTP fallback      |
| Sentry Account       | Business                           | Error tracking, performance, replay      |
| GitHub Repository    | Private — `cromstel-it/mytenant-invoice` | Source control + CI/CD triggers     |
| Node.js              | 20.x LTS (locked via `.nvmrc`)     | Runtime for builds + tooling             |
| npm                  | 10.x                                | Package manager                          |

---

## 3. Environment Variables

All variables are managed in Vercel Project Settings → Environment Variables.
Never commit `.env` files. The `.env.example` is the single source of truth for required keys.

### 3.1 Required Environment Variables

```bash
# ── Application ──────────────────────────────────────────
NEXT_PUBLIC_APP_NAME="myTenant Invoice"
NEXT_PUBLIC_APP_URL="https://app.mytenant-invoice.com"   # prod
NEXT_PUBLIC_SUPPORT_EMAIL="support@cromstelit.com"
NEXT_PUBLIC_COMPANY_NAME="CromStel IT Group"
NODE_ENV="production"

# ── Authentication (Auth.js v5) ──────────────────────────
AUTH_SECRET="<32-byte-crypto-random — openssl rand -hex 32>"
AUTH_URL="https://app.mytenant-invoice.com"
AUTH_TRUST_HOST="true"

# OAuth — Google
AUTH_GOOGLE_ID="<google-oauth-client-id>"
AUTH_GOOGLE_SECRET="<google-oauth-client-secret>"

# OAuth — Microsoft (optional, for enterprise)
AUTH_MICROSOFT_ID="<azure-ad-app-id>"
AUTH_MICROSOFT_SECRET="<azure-ad-client-secret>"
AUTH_MICROSOFT_TENANT_ID="<azure-ad-tenant-id>"

# ── Database: PlanetScale ────────────────────────────────
DATABASE_URL="mysql://<user>:<password>@<host>.psdb.cloud/mytenant_invoice?sslaccept=strict&ssl={"rejectUnauthorized":true}"
DATABASE_HOST="<host>.psdb.cloud"
DATABASE_USERNAME="<user>"
DATABASE_PASSWORD="<password>"
DATABASE_NAME="mytenant_invoice"

# Direct connection (for migrations / Prisma Studio) — uses Replicas
DIRECT_URL="mysql://<user>:<password>@<host>-direct.psdb.cloud/mytenant_invoice?sslaccept=strict&ssl={"rejectUnauthorized":true}"

# ── Cache / Queue: Upstash Redis ─────────────────────────
REDIS_URL="rediss://default:<token>@<region>-<id>.upstash.io:6379"
UPSTASH_REDIS_REST_URL="https://<region>-<id>.upstash.io"
UPSTASH_REDIS_REST_TOKEN="<upstash-rest-token>"

# BullMQ queue connection (same Redis, separate DB index)
BULLMQ_REDIS_DB="1"
BULLMQ_CONCURRENCY="10"

# ── Email: Resend ────────────────────────────────────────
RESEND_API_KEY="<re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx>"
RESEND_FROM="no-reply@mytenant-invoice.com"
RESEND_BCC="audit-log@cromstelit.com"

# SMTP fallback (for self-hosted or Resend downtime)
SMTP_HOST="smtp.sendgrid.net"
SMTP_PORT="587"
SMTP_USER="apikey"
SMTP_PASSWORD="<sendgrid-api-key>"
SMTP_FROM="no-reply@mytenant-invoice.com"

# ── Payments: Stripe ─────────────────────────────────────
STRIPE_SECRET_KEY="sk_live_<stripe-secret-key>"   # or sk_test_ in non-prod
STRIPE_PUBLISHABLE_KEY="pk_live_<stripe-publishable-key>"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_<stripe-publishable-key>"
STRIPE_WEBHOOK_SECRET="whsec_<stripe-webhook-secret>"
STRIPE_TAX_BEHAVIOR="exclusive"
STRIPE_DEFAULT_CURRENCY="USD"

# ── Observability: Sentry ────────────────────────────────
SENTRY_DSN="https://<key>@<id>.ingest.sentry.io/<project-id>"
SENTRY_ORG="cromstel-it-group"
SENTRY_PROJECT="mytenant-invoice"
SENTRY_AUTH_TOKEN="<sentry-automation-token>"
NEXT_PUBLIC_SENTRY_DSN="https://<key>@<id>.ingest.sentry.io/<project-id>"
NEXT_PUBLIC_SENTRY_REPLAY_SESSION_SAMPLE_RATE="0.1"
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE="0.05"

# ── Logs / Metrics (Pino → Datadog via Vercel Integration) ─
LOG_LEVEL="info"                       # debug | info | warn | error
LOG_PRETTY="false"                     # set true ONLY in dev
DD_API_KEY="<datadog-api-key>"
DD_SITE="datadoghq.com"

# ── Security hardening ───────────────────────────────────
ALLOWED_ORIGINS="https://app.mytenant-invoice.com,https://*.vercel.app"
RATE_LIMIT_WINDOW_MS="900000"          # 15 min
RATE_LIMIT_MAX_REQUESTS="300"          # per IP window
CSRF_TOKEN_SECRET="<32-byte-separate-from-auth-secret>"

# ── Feature flags (LaunchDarkly-compatible JSON) ─────────
NEXT_PUBLIC_FLAGS='{"multiCurrency":true,"autoPay":true,"lateFeesV2":false}'
```

### 3.2 Environment Variable Scoping in Vercel

| Variable Prefix / Group          | Production | Preview | Development | Secret? |
|----------------------------------|:----------:|:-------:|:-----------:|:-------:|
| `NEXT_PUBLIC_*`                  |     ✓      |    ✓    |      ✓      |    NO   |
| `AUTH_SECRET`, `CSRF_TOKEN_SECRET` |     ✓      |    ✓    |      ✓      |   YES   |
| `DATABASE_URL`, `DIRECT_URL`     |     ✓      |    ✓    |      ✓      |   YES   |
| `REDIS_URL`, `UPSTASH_*`         |     ✓      |    ✓    |      ✓      |   YES   |
| `STRIPE_SECRET_KEY`              |  live-only | test    |   test      |   YES   |
| `STRIPE_WEBHOOK_SECRET`          |  live-only | test    |   test      |   YES   |
| `RESEND_API_KEY`                 |     ✓      |    ✓    |      ✓      |   YES   |
| `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`|     ✓      |    ✓    |      ✓      |   YES   |
| `DD_API_KEY`                     |     ✓      |    —    |      —      |   YES   |

**How to set a Secret in Vercel UI:** Project → Settings → Environment Variables → Add new → toggle "Encrypt" → Save. Secret values are **never returned** by the Vercel API/UI after save.

---

## 4. Step-by-Step Deployment (Production)

### 4.1 Provision Infrastructure

```bash
# 1. Create PlanetScale database (CLI example)
pscale database create mytenant_invoice --region us-east --org cromstel-it
pscale branch create mytenant_invoice main --org cromstel-it
pscale password create mytenant_invoice main deploy-01 --role admin --org cromstel-it
# → Save username, password, host; construct DATABASE_URL + DIRECT_URL

# 2. Create Upstash Redis (CLI example)
upstash redis create --name mytenant-invoice-redis --region global --tls true
# → Save REDIS_URL, REST URL, REST token

# 3. Create Upstash Kafka topics for BullMQ events (optional audit trail)
upstash kafka create --name mytenant-invoice-events --region us-east-1
upstash kafka topic create mytenant-invoice-events --name invoice-events --partitions 6
```

### 4.2 Push Database Schema

```bash
# NEVER run prisma migrate deploy from your laptop against prod.
# Use CI or the pscale deploy-request flow (see §4.5).

# Initial bootstrap via CI only:
npx prisma migrate deploy    # applies migrations from prisma/migrations/*
npx prisma generate          # client generated automatically on build too
npx tsx prisma/seed.ts       # ONLY once — seeds roles, superadmin, base tariffs
```

### 4.3 Connect Git → Vercel

1. Open [vercel.com/new](https://vercel.com/new) → Import `cromstel-it/mytenant-invoice`.
2. **Framework Preset:** Next.js (auto-detected). Leave build/dev commands as defaults.
3. **Root Directory:** Leave as `/` (monorepo users: change to `mytenant-invoice/`).
4. Paste **all** env vars from §3 into Project Settings → Environment Variables.
   - Scope `DATABASE_URL` + Stripe test keys to Preview + Development.
   - Scope live Stripe keys to **Production Only**.
5. Under **Advanced** → Node.js Version → `20.x`.
6. Click **Deploy**. First build runs in ~4 min; expect warm-up on first request.

### 4.4 Configure Stripe Webhooks

After the first successful deployment:

```
Stripe Dashboard → Developers → Webhooks → Add endpoint
  Endpoint URL:   https://app.mytenant-invoice.com/api/webhooks/stripe
  Listen to:      All invoice events + customer + payment_intent events at minimum:
                     invoice.paid, invoice.payment_failed,
                     invoice.overdue, customer.subscription.updated,
                     payment_intent.succeeded, charge.refunded
  Secret:         whsec_… (save as STRIPE_WEBHOOK_SECRET in Vercel prod)
```

### 4.5 Promoting Schema Changes (PlanetScale Deploy Request)

```bash
# 1. Create schema change branch locally
pscale branch create mytenant_invoice add-tax-ids --from main
# 2. Point dev env to this branch, run `prisma migrate dev`, iterate
# 3. When ready, open Deploy Request in UI or CLI:
pscale deploy-request create mytenant_invoice add-tax-ids
# 4. Schema diff + migration plan displayed. Approve in UI.
# 5. PlanetScale applies the change automatically; no deploy required.
```

### 4.6 Configure Custom Domain + SSL

Vercel Dashboard → Project → Settings → Domains:

| Domain                    | Redirect To                    | Purpose                |
|---------------------------|--------------------------------|------------------------|
| `app.mytenant-invoice.com`| *serve the app*                | Primary app domain     |
| `www.mytenant-invoice.com`| `https://app.mytenant-invoice.com` | Canonical redirect |
| `mytenant-invoice.com`    | `https://app.mytenant-invoice.com` | Apex redirect     |

- Vercel automatically provisions Let's Encrypt certs and renews them.
- Enable **HSTS Preload** after 2 weeks of stable HTTPS only:
  ```json
  // next.config.mjs
  async headers() {
    return [{
      source: "/(.*)",
      headers: [{
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload"
      }]
    }]
  }
  ```

---

## 5. Preview Deployments (per-PR)

Every push to a non-main branch deploys a unique preview URL:
`https://mytenant-invoice-<git-branch>-<hash>.vercel.app`

Preview deployments automatically:
- Use the PlanetScale `preview` branch (configurable via preview-scoped `DATABASE_URL`)
- Use Upstash Redis `Preview` database (separate DB index `2`)
- Use Stripe **test mode** keys
- Seeded with demo tenant `acme-preview` + `owner@acme.test` / `PreviewPass1!`
- Destroyed automatically 7 days after merge or branch deletion

---

## 6. Smoke Test Checklist (Post-Deploy)

Run these after every production deploy before marking it healthy:

- [ ] Landing page loads: `GET /` → 200, includes `NEXT_PUBLIC_APP_NAME`
- [ ] Login page: `GET /login` → 200, Google/Microsoft buttons render
- [ ] API health: `GET /api/health` returns `{"status":"ok","db":"up","redis":"up","version":"…"}`
- [ ] Auth round-trip: log in as test user → redirected to `/dashboard`
- [ ] Tenant isolation: switching tenant does NOT leak data (cookies prefixed by tenantId)
- [ ] Invoice PDF generation: `POST /api/invoices/{id}/pdf` returns `application/pdf` 200
- [ ] Stripe webhook: send a test event → `api/webhooks/stripe` returns 200, logs appear
- [ ] Email: send password reset → Resend dashboard shows delivered
- [ ] BullMQ worker: enqueue test job → completes, Sentry no errors
- [ ] Sentry: force `throw new Error('smoke')` → issue appears in Sentry project within 60s

---

## 7. Rollback

See [`rollback.md`](./rollback.md) for full procedures:
- **Code rollback:** Vercel Dashboard → Deployments → select previous → "Promote to Production" (< 30s, no downtime)
- **Data rollback:** PlanetScale deploy-rollback within 30-minute post-apply window
- **Config rollback:** `vercel env rollback <deployment-id>` (preserves exact same env)
