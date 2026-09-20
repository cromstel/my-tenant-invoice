# Getting Started

> myTenant Invoice — Next.js 14 (App Router) · TypeScript strict · Tailwind · shadcn/ui · Vitest · Playwright · MySQL · Redis · Docker

## 1. Prerequisites

| Tool      | Minimum Version | Install / Verify                          |
|-----------|-----------------|-------------------------------------------|
| Node.js   | 20.10 (LTS)     | `node -v` (use `fnm` or `nvm` to pin)     |
| pnpm      | 9.x             | `corepack enable && corepack prepare pnpm@9 --activate` |
| Docker    | 24+ (Compose v2) | `docker compose version`                 |
| MySQL     | 8.0             | Via docker-compose.yml (recommended)      |
| Redis     | 7.2             | Via docker-compose.yml (recommended)      |
| Git       | 2.40+           | `git --version`                           |

## 2. Repository Layout

```
mytenant-invoice/
├─ app/                    # Next.js App Router (route groups, layouts, pages)
│  ├─ (marketing)/
│  ├─ (auth)/
│  ├─ (platform)/
│  └─ (portal)/
├─ components/             # Shared UI primitives + domain components
│  ├─ ui/                  # shadcn/ui primitives
│  ├─ invoice/
│  └─ data-table.tsx
├─ lib/                    # Domain logic (pure TS, no React)
│  ├─ auth/
│  ├─ db/                  # Drizzle schema, queries, repos
│  ├─ billing/             # Tariff calc, invoice engine
│  ├─ payments/            # Stripe/PayGate adapters
│  └─ feature-flags.ts
├─ server/                 # tRPC routers + procedures
├─ scripts/                # DB seed, data migrations
├─ tests/
│  ├─ unit/                # Vitest
│  ├─ integration/         # Vitest + testcontainers
│  └─ e2e/                 # Playwright
├─ docker-compose.yml      # MySQL + Redis + Mailpit
├─ drizzle.config.ts
├─ next.config.mjs
├─ vitest.config.ts
└─ playwright.config.ts
```

## 3. First-time Setup

```bash
# 1. Clone
git clone git@github.com:cromstel/mytenant-invoice.git
cd mytenant-invoice

# 2. Install deps
pnpm install

# 3. Copy env file — see §4 for full listing
cp .env.example .env.local

# 4. Start infra (MySQL 8, Redis 7, Mailpit)
pnpm docker:up

# 5. Apply schema + seed
pnpm db:migrate
pnpm db:seed

# 6. Start dev server
pnpm dev
# → http://localhost:3000
```

Seed creates three orgs you can impersonate:

| Email                      | Password     | Role    | Org Slug              |
|----------------------------|--------------|---------|-----------------------|
| `owner@acme.test`          | `Testpass1!` | OWNER   | `acme-property-group` |
| `admin@acme.test`          | `Testpass1!` | ADMIN   | same                  |
| `billing@cromstel.test`    | `Testpass1!` | BILLING | `cromstel-commercial` |

Mailpit captures all outbound email: http://localhost:8025

## 4. Environment Variables — `.env.local`

```env
# ---------- Runtime ----------
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ORG_SLUG=acme-property-group

# ---------- Auth ----------
AUTH_SECRET=                    # `openssl rand -base64 33`
AUTH_COOKIE_NAME=mytenant.session
SESSION_TTL_SECONDS=604800
PASSWORD_PEPPER=                # 32 random bytes
BCRYPT_ROUNDS=12

# ---------- Database ----------
DATABASE_URL=mysql://root:devpassword@127.0.0.1:3306/mytenant_invoice
DATABASE_SHADOW_URL=mysql://root:devpassword@127.0.0.1:3306/mytenant_invoice_shadow

# ---------- Cache / Queue ----------
REDIS_URL=redis://127.0.0.1:6379
QUEUE_NAME=billing-events

# ---------- Payments ----------
NEXT_PUBLIC_STRIPE_PK=pk_test_xxx
STRIPE_SK=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
PAYGATE_MERCHANT_ID=
PAYGATE_SECRET=

# ---------- SMTP ----------
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
SMTP_FROM_NAME="myTenant Invoice"
SMTP_FROM=no-reply@mytenant.test

# ---------- Feature flags (local) ----------
FF_NEW_DASHBOARD=true
FF_BULK_INVOICE_SEND=true
FF_CUSTOM_PORTAL_THEMING=false

# ---------- Observability (dev) ----------
LOG_LEVEL=debug
LOG_PRETTY=true
```

## 5. Useful Scripts

```bash
pnpm dev               # next dev (3000)
pnpm build             # next build + typecheck
pnpm start             # next start
pnpm lint              # biome lint
pnpm typecheck         # tsc --noEmit (strict)

pnpm test              # vitest run (unit + integration)
pnpm test:unit         # vitest run tests/unit
pnpm test:int          # DATABASE_URL=test → vitest run tests/integration
pnpm test:e2e          # playwright test (needs running server)
pnpm test:e2e:ui       # playwright test --ui

pnpm db:generate       # drizzle-kit generate
pnpm db:migrate        # drizzle-kit migrate
pnpm db:seed           # tsx scripts/seed.ts
pnpm db:studio         # drizzle-kit studio → http://local:4983

pnpm docker:up         # docker compose up -d mysql redis mailpit
pnpm docker:down       # docker compose down

pnpm shadcn:add        # npx shadcn@latest add <component>
pnpm emails:dev        # react-email preview (8080)
```

## 6. Start a Feature Branch

```bash
git checkout develop
git pull --ff-only
git checkout -b feature/TBI-123-auto-charge-tariffs
# code, commit, PR
```

See [`branch-strategy.md`](./branch-strategy.md) and [`git-workflow.md`](./git-workflow.md).
