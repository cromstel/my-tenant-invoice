# Environments Strategy — myTenant Invoice SaaS

**Document Owner:** CromStel IT Group — DevOps Team
**Last Updated:** 2026-09-20
**Environment Model:** 4-tier: Development → Test → Staging → Production

---

## 1. Environment Inventory

| Environment | Purpose                              | URL                                              | Branch   | Deploy Trigger            | SLA / Uptime  | Data Class           |
|-------------|--------------------------------------|--------------------------------------------------|----------|---------------------------|---------------|----------------------|
| **dev**     | Individual developer sandboxes       | `http://localhost:3000`                          | any WIP  | `npm run dev`             | best-effort   | synthetic only       |
| **test**    | CI-driven unit/integration + E2E     | GitHub Actions ephemeral (Vitest/Playwright)     | `main`   | every push to main        | N/A (ephemeral)| synthetic only       |
| **staging** | UAT, load tests, pre-release demo    | `https://staging.mytenant-invoice.com`           | `release/*` or manual tag | after successful CI on release branch | 99.5% (business hours UTC+0) | anonymized prod clone |
| **prod**    | Live paying customers                | `https://app.mytenant-invoice.com`               | `main` (via GitHub tag `vX.Y.Z`) | only after staging sign-off + manual approval | 99.9% (Tier-2 target) | real PII / financial |

---

## 2. Per-Environment Configuration

### 2.1 Development (`dev`)

**Who uses it:** Single engineer on laptop or GitHub Codespace.

| Aspect            | Value / Implementation                                                                 |
|-------------------|----------------------------------------------------------------------------------------|
| Node.js           | 20.x — via nvmrc, `nvm use`                                                            |
| Database          | Local Docker MySQL 8 or PlanetScale `dev-<name>` branch (preferred for schema parity) |
| Redis             | Local `docker compose up redis` **or** Upstash Free tier — DB index `dev-<uid>:0`     |
| Stripe            | **Test mode only** — use developer's personal test keys or team-shared test account   |
| Email             | Mailpit (`localhost:1025`) — never sends real email                                    |
| Auth              | Credentials only; Google/Microsoft OAuth disabled to avoid config sprawl              |
| Seed data         | `npm run prisma:seed` → 3 orgs, 5 tenants, 50 invoices, demo user `demo@cromstel.test` |
| Logs              | Pretty pino-pretty to stdout; LOG_LEVEL=debug                                          |
| Sentry            | Disabled; errors go to browser console / terminal                                     |

**Bootstrap command for a new engineer:**
```bash
git clone git@github.com:cromstel-it/mytenant-invoice.git
cd mytenant-invoice
cp .env.example .env.local   # fill in PlanetScale dev-branch + Upstash dev keys
npm install
npx prisma migrate dev      # applies + generates client + seeds
npm run dev                 # http://localhost:3000 (auto-open)
```

### 2.2 Test (`test`)

**Who uses it:** GitHub Actions runners on every push. Not reachable by humans.

| Aspect            | Value / Implementation                                                                 |
|-------------------|----------------------------------------------------------------------------------------|
| Runtime           | GitHub Actions `ubuntu-latest` + Node 20.x + services: mysql 8 + redis 7 (container)   |
| Database          | Ephemeral Docker MySQL — test DB dropped after workflow ends                          |
| Redis             | Ephemeral Docker Redis — `redis-server --appendonly no`                               |
| Stripe            | Stripe Test Mode; use `stripe-mock` service in workflow for deterministic tests       |
| Email             | `nodemailer` JSON transport (no network calls)                                        |
| Seed data         | Deterministic `prisma/seed.test.ts` — 2 orgs, fixed IDs for assertions                |
| Logs              | JSON pino → captured in GitHub Actions logs; no 3rd-party export                      |

### 2.3 Staging (`staging`)

**Who uses it:** Product, QA, customers doing UAT, Sales demos. Mirrors prod topology 1:1.

| Aspect            | Value / Implementation                                                                 |
|-------------------|----------------------------------------------------------------------------------------|
| Vercel            | Separate project: `mytenant-invoice-staging` — same region, same function size         |
| PlanetScale       | Database `mytenant_invoice_staging` — main branch refreshed weekly from prod snapshot (PII scrubbed) |
| Upstash           | Dedicated Redis `mytenant-invoice-staging` (Global Tier) — separate from prod          |
| Stripe            | Stripe **Test Mode**, dedicated test account with cloned prod product catalog         |
| Email             | Resend test API key; `bcc: staging-audit@cromstelit.com` — no real customer deliveries |
| Sentry            | Separate Sentry project `mytenant-invoice-staging` — alerts disabled, visible only to eng |
| BullMQ            | Reduced concurrency (BULLMQ_CONCURRENCY=3); cron schedule offset by 37 minutes        |
| Feature flags     | All flags **on** by default — staging is where we exercise upcoming features          |

**Weekly staging refresh (automated Monday 02:00 UTC via GitHub Workflow):**
```
1. pscale backup create mytenant_invoice --branch main --name weekly-snapshot
2. Take DB dump:  pscale database dump mytenant_invoice main --output /tmp/prod-dump
3. Anonymize columns (run via `tools/anonymize.ts`):
     - users.email → <first>.<last>+<uid>@cromstel-staging.test
     - users.phone → +1555000xxxx
     - tenants.bank_* → synthetic test values
     - invoices.stripe_payment_intent_id → pi_test_xxxxxxxxxxx
     - all `name`, `address` columns → faker replacements
4. pscale database restore-dump mytenant_invoice_staging main /tmp/anon-dump
5. FLUSH Upstash Redis staging (prevent stale session/survey data leak)
6. Send Slack #staging-ops: "Staging refreshed from prod snapshot @ 2026-09-20T02:??Z"
```

### 2.4 Production (`prod`)

**Who uses it:** Paying customers, authenticated users, public marketing pages.

| Aspect            | Value / Implementation                                                                 |
|-------------------|----------------------------------------------------------------------------------------|
| Vercel            | Project `mytenant-invoice` — region us-east-1; 4096 MB memory for SSR routes; edge middleware enabled |
| PlanetScale       | DB `mytenant_invoice` main — **Enterprise cluster** — primary us-east-1 + replica us-west-2 + eu-west-1 |
| Upstash           | Dedicated Global Redis — eviction policy `volatile-lru` — max memory 25 GB            |
| Stripe            | Live Stripe Connect platform account — webhook signatures verified, idempotency keys  |
| Email             | Resend Pro — dedicated sending domain + DMARC/SPF/DKIM all green; BCC compliance log  |
| Sentry            | Primary project — alerts enabled to #prod-incidents Slack; 100% error sampling       |
| BullMQ            | Concurrency=12; separate Redis DB index 1; retries with exponential backoff          |
| Feature flags     | Flags off by default; release toggles via LaunchDarkly env JSON (§3)                  |

---

## 3. Environment Segregation Controls

| Control                                     | Implementation                                                                 |
|---------------------------------------------|-------------------------------------------------------------------------------|
| **No shared credentials between tiers**     | Env vars stored in separate Vercel Projects + separate 1Password vaults per tier. Checked in CI via `scripts/assert-env-segregation.sh` (ensures `DATABASE_URL` doesn't match prod host in non-prod). |
| **Network access control**                  | PlanetScale prod DB allow-lists only Vercel's published egress ranges + VPN. Staging DB also allows office egress. |
| **PII scrubbing**                           | Staging refresh (§2.3) runs strict PII scrubber; tested by looking for any real email/phone regex after restore. Failure aborts the restore. |
| **Manual prod deploy gate**                 | GitHub Environment `production` configured with Required Reviewers (`devops-leads` team) + Wait Timer 5 min. |
| **Config drift detection**                  | Nightly workflow `check-env-drift` compares Vercel project env keys to `.env.example`, alerts on missing/unexpected keys. |
| **Secret rotation schedule**                | AUTH_SECRET, CSRF_TOKEN_SECRET, DB passwords rotated quarterly. Rotation runbook in [`disaster-recovery.md §5`](./disaster-recovery.md#5-secret-rotation-runbook). |

---

## 4. Environment Promotion Path

```
Developer Branch
      │  npm run dev
      ▼
  Local dev   ────── lint / typecheck ──► (pass required to open PR)
      │
      │  git push
      ▼
  Pull Request
      │  Preview deploy (Vercel auto) + CI (lint / typecheck / test / build / security)
      ▼
  main branch
      │
      │  CI-green → auto-deploy to staging via `release/next` branch
      ▼
  staging.mytenant-invoice.com
      │  UAT sign-off + load test pass
      │  (manual: Release Manager clicks "Promote" in Vercel Dashboard)
      ▼
  tag v1.4.2 on main ─► deploy to prod (Vercel production deploy)
                         │
                         └► smoke tests run automatically via Playwright
                            if fail → auto-rollback to previous deployment
```

---

## 5. Access Matrix

| Role                  | Dev (local) | Test (CI) | Staging (Vercel) | Production (Vercel) |
|-----------------------|:-----------:|:---------:|:----------------:|:-------------------:|
| Software Engineer     |  full       |   view logs only | deploy + view | view only |
| QA Engineer           |  full       |   view    | full (data edits) | view only |
| Product Manager       |  N/A        |   N/A     | view (UAT)       | view only (dashboards) |
| DevOps / SRE          |  full       |   admin   | admin            | full admin (break-glass) |
| Support Agent         |  N/A        |   N/A     | view (reproduce) | view only |
| Customer UAT          |  N/A        |   N/A     | restricted role  | their own tenant only |
| Auditor               |  N/A        |   N/A     | read-only        | read-only, no PII export |

Access provisioned via Okta groups: `eng-all`, `qa-all`, `pm-all`, `sre-oncall`, `support-t1`, `auditors`.
