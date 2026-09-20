# CI/CD Pipeline — myTenant Invoice SaaS

**Document Owner:** CromStel IT Group — DevOps Team
**Last Updated:** 2026-09-20
**Platform:** GitHub Actions · Vercel Deployments · GitHub Environments

---

## 1. Pipeline Overview

Every push triggers a 7-stage pipeline with the following execution DAG:

```
 ┌──────────┐    ┌──────────┐    ┌────────────┐    ┌────────────┐    ┌─────────┐    ┌────────────┐    ┌───────────────┐
 │  Install │───►│   Lint   │───►│ Typecheck  │───►│ Unit + Int │───►│  Build  │───►│  Security  │───►│  E2E (matrix) │
 │  (cache) │    │ (eslint, │    │  (tsc --   │    │  (vitest + │    │ (next   │    │ (audit +   │    │ (playwright,  │
 │          │    │  format) │    │   noEmit)  │    │ coverage)  │    │  build)  │    │  trivy, SAST│    │ 5 browsers)   │
 └──────────┘    └──────────┘    └────────────┘    └────────────┘    └─────────┘    └────────────┘    └───────────────┘
                                                                                                         │
                                                                                                         ▼
                                                                                                 ┌──────────────┐
                                                                                                 │  Deploy to   │
                                                                                                 │  Vercel env  │
                                                                                                 │  (if eligible)│
                                                                                                 └──────────────┘
```

**Stage Gate Rules:**
- Stage N runs only if stage N–1 passes (exit 0).
- On **pull requests**: run stages 1–6. E2E runs on PRs with `run-e2e` label or `release/*` branches.
- On **push to `main`**: run stages 1–7 in full; deploy staging on success.
- On **push of tag `v*`**: run 1–7 + deploy **production** with manual approval.

---

## 2. Complete Workflow: `.github/workflows/ci.yml`

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, release/* ]
    tags:     [ 'v*' ]
  pull_request:
    branches: [ main ]
    types:    [ opened, synchronize, reopened, labeled ]
  workflow_dispatch:
    inputs:
      deploy_environment:
        description: 'Deploy target'
        required: false
        default: staging
        type: choice
        options: [ staging, production ]

concurrency:
  group:    ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

env:
  NODE_VERSION: '20'
  CACHE_VERSION:  'v3'
  NODE_OPTIONS:   '--max-old-space-size=8192'

jobs:
  # ───────────────────────────────────────────────────────────────
  # STAGE 1 — Install with cache
  # ───────────────────────────────────────────────────────────────
  install:
    name: Install dependencies
    runs-on: ubuntu-latest
    timeout-minutes: 8
    outputs:
      cache-key: ${{ steps.cache-key.outputs.key }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js ${{ env.NODE_VERSION }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Generate cache key
        id: cache-key
        run: echo "key=node-modules-${{ env.CACHE_VERSION }}-${{ hashFiles('**/package-lock.json') }}" >> $GITHUB_OUTPUT

      - name: Restore node_modules from cache
        id: node-cache
        uses: actions/cache@v4
        with:
          path: node_modules
          key:  ${{ steps.cache-key.outputs.key }}

      - name: Install dependencies
        if:   steps.node-cache.outputs.cache-hit != 'true'
        run:  npm ci --no-audit --no-fund

      - name: Cache Prisma client (generated for this platform)
        uses: actions/cache@v4
        with:
          path: node_modules/.prisma
          key:  prisma-client-${{ env.CACHE_VERSION }}-${{ hashFiles('prisma/schema.prisma') }}

  # ───────────────────────────────────────────────────────────────
  # STAGE 2 — Lint + format check
  # ───────────────────────────────────────────────────────────────
  lint:
    name: Lint & Format
    runs-on: ubuntu-latest
    needs: install
    timeout-minutes: 6
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '${{ env.NODE_VERSION }}', cache: 'npm' }
      - name: Restore cache
        uses: actions/cache@v4
        with:
          path: node_modules
          key:  ${{ needs.install.outputs.cache-key }}
          fail-on-cache-miss: true
      - name: ESLint
        run:  npm run lint -- --max-warnings 0
      - name: Prettier format check
        run:  npm run format:check
        continue-on-error: true   # soft-fail, leaves annotation; hard-fail once team fully adapted
      - name: Lint commit messages (conventional)
        uses: wagoid/commitlint-github-action@v6
        continue-on-error: true

  # ───────────────────────────────────────────────────────────────
  # STAGE 3 — TypeScript typecheck
  # ───────────────────────────────────────────────────────────────
  typecheck:
    name: Typecheck (tsc --noEmit)
    runs-on: ubuntu-latest
    needs: install
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '${{ env.NODE_VERSION }}', cache: 'npm' }
      - name: Restore cache
        uses: actions/cache@v4
        with:
          path: node_modules
          key:  ${{ needs.install.outputs.cache-key }}
          fail-on-cache-miss: true
      - name: Prisma generate
        run:  npx prisma generate
      - name: tsc --noEmit
        run:  npm run typecheck
        env:
          # tsc needs these defined for global process.env type usage, not actual secrets
          DATABASE_URL: ${{ vars.TEST_DATABASE_URL }}
          AUTH_SECRET:  dummy-for-typecheck

  # ───────────────────────────────────────────────────────────────
  # STAGE 4 — Unit + Integration tests with coverage gate
  # ───────────────────────────────────────────────────────────────
  test:
    name: Unit + Integration Tests
    runs-on: ubuntu-latest
    needs: install
    timeout-minutes: 15
    services:
      mysql:
        image:  mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: rootpw
          MYSQL_DATABASE:      mytenant_test
        ports:      [ '3306:3306' ]
        options:    >-
          --health-cmd="mysqladmin ping -uroot -prootpw"
          --health-interval=10s --health-timeout=5s --health-retries=5
      redis:
        image:  redis:7-alpine
        ports:  [ '6379:6379' ]
        options: '--entrypoint redis-server --appendonly no'
      stripe-mock:
        image:  stripe/stripe-mock:v0.187.0
        ports:  [ '12111:12111', '12112:12112' ]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '${{ env.NODE_VERSION }}', cache: 'npm' }
      - name: Restore cache
        uses: actions/cache@v4
        with:
          path: node_modules
          key:  ${{ needs.install.outputs.cache-key }}
          fail-on-cache-miss: true
      - name: Prisma generate + migrate test DB
        run:  npx prisma migrate deploy
        env:
          DATABASE_URL: mysql://root:rootpw@127.0.0.1:3306/mytenant_test
      - name: Seed test data
        run:  npx tsx prisma/seed.test.ts
        env:
          DATABASE_URL: mysql://root:rootpw@127.0.0.1:3306/mytenant_test
      - name: Run tests with coverage
        id: vitest
        run:  npm test -- --coverage
        env:
          DATABASE_URL:     mysql://root:rootpw@127.0.0.1:3306/mytenant_test
          REDIS_URL:        redis://127.0.0.1:6379
          STRIPE_API_KEY:   sk_test_12345
          STRIPE_MOCK_URL:  http://127.0.0.1:12111
          AUTH_SECRET:      test-secret
          NODE_ENV:         test
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          files: ./coverage/coverage-final.json
          fail_ci_if_error: false
      - name: Enforce minimum coverage thresholds
        run: |
          node -e "
            const cov = require('./coverage/coverage-summary.json').total;
            const fail = [];
            if (cov.lines.pct    < 78) fail.push('lines ' + cov.lines.pct + '% < 78%');
            if (cov.functions.pct< 75) fail.push('functions ' + cov.functions.pct + '% < 75%');
            if (cov.branches.pct < 70) fail.push('branches ' + cov.branches.pct + '% < 70%');
            if (fail.length) { console.error('Coverage gate FAIL:', fail.join(', ')); process.exit(1); }
            console.log('Coverage gate PASS:', JSON.stringify({l:cov.lines.pct,f:cov.functions.pct,b:cov.branches.pct}));
          "

  # ───────────────────────────────────────────────────────────────
  # STAGE 5 — Build (next build) — catches SSR errors, missing pages
  # ───────────────────────────────────────────────────────────────
  build:
    name: Next.js Production Build
    runs-on: ubuntu-latest
    needs: [ install, lint, typecheck ]    # build needs to pass lint/typecheck but can parallel test
    timeout-minutes: 18
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '${{ env.NODE_VERSION }}', cache: 'npm' }
      - name: Restore cache
        uses: actions/cache@v4
        with:
          path: node_modules
          key:  ${{ needs.install.outputs.cache-key }}
          fail-on-cache-miss: true
      - name: Prisma generate
        run:  npx prisma generate
      - name: Next build
        run:  npm run build
        env:
          # Next build-time env — placeholder values so SSR routes at least compile
          DATABASE_URL:                      'mysql://placeholder:placeholder@localhost/placeholder'
          AUTH_SECRET:                       'build-only-dummy'
          STRIPE_SECRET_KEY:                 'sk_build_dummy'
          NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:'pk_build_dummy'
          REDIS_URL:                         'redis://build-dummy:6379'
          SENTRY_AUTH_TOKEN:                 ${{ secrets.SENTRY_AUTH_TOKEN }}
          SENTRY_ORG:                        'cromstel-it-group'
          SENTRY_PROJECT:                    'mytenant-invoice'
          VERCEL_GIT_COMMIT_SHA:             ${{ github.sha }}
      - name: Upload build artifact (for E2E + deploy jobs)
        uses: actions/upload-artifact@v4
        with:
          name: next-build-${{ github.sha }}
          path: |
            .next/**
            !.next/cache/**
            public/**
            package.json
          retention-days: 14

  # ───────────────────────────────────────────────────────────────
  # STAGE 6 — Security scans (SAST, dependency audit, secrets, images)
  # ───────────────────────────────────────────────────────────────
  security:
    name: Security Scans
    runs-on: ubuntu-latest
    needs: install
    timeout-minutes: 15
    permissions:
      contents:          read
      security-events:   write      # to upload SARIF
      actions:           read
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }

      # 6a — npm audit + license check
      - uses: actions/setup-node@v4
        with: { node-version: '${{ env.NODE_VERSION }}', cache: 'npm' }
      - name: Restore cache
        uses: actions/cache@v4
        with:
          path: node_modules
          key:  ${{ needs.install.outputs.cache-key }}
          fail-on-cache-miss: true
      - name: npm audit (fail on HIGH/CRITICAL)
        run:  npm audit --audit-level=high
        continue-on-error: false
      - name: License compliance
        run:  npx license-checker --production --onlyAllow "MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC;Python-2.0;CC0-1.0;0BSD"
        env: { CI: 'true' }

      # 6b — Secrets leak detection (gitleaks)
      - name: Gitleaks — no committed secrets
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GITLEAKS_ENABLE_COMMENTS: true

      # 6c — SAST: CodeQL (JavaScript/TypeScript)
      - name: Initialize CodeQL
        uses: github/codeql-action/init@v3
        with: { languages: javascript-typescript, queries: security-and-quality }
      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v3
        with: { category: "/language:javascript-typescript" }

      # 6d — SAST: Trivy filesystem scan
      - name: Run Trivy vulnerability scan
        uses: aquasecurity/trivy-action@0.24.0
        with:
          scan-type:      fs
          scan-ref:       .
          severity:       CRITICAL,HIGH
          ignore-unfixed: true
          format:         sarif
          output:         trivy-results.sarif
      - name: Upload Trivy scan to GitHub Security tab
        uses: github/codeql-action/upload-sarif@v3
        if:   always()
        with: { sarif_file: trivy-results.sarif, category: trivy }

  # ───────────────────────────────────────────────────────────────
  # STAGE 7 — E2E (Playwright), 5-browser matrix
  # ───────────────────────────────────────────────────────────────
  e2e:
    name: E2E (${{ matrix.shard }}/${{ strategy.job-total }} — ${{ matrix.browser }})
    if: >-
      (github.event_name == 'push' && (startsWith(github.ref, 'refs/heads/release/') || github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/v'))) ||
      (github.event_name == 'pull_request' && contains(github.event.pull_request.labels.*.name, 'run-e2e')) ||
      (github.event_name == 'workflow_dispatch')
    runs-on: ubuntu-latest
    needs: build
    timeout-minutes: 30
    strategy:
      fail-fast: false
      matrix:
        browser: [ chromium, firefox, webkit, 'chrome:canary', msedge ]
        shard:   [ 1, 2 ]
    services:
      mysql:
        image:  mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: rootpw
          MYSQL_DATABASE:      mytenant_e2e
        ports:   [ '3306:3306' ]
        options: >-
          --health-cmd="mysqladmin ping -uroot -prootpw"
          --health-interval=10s --health-timeout=5s --health-retries=5
      redis:
        image:  redis:7-alpine
        ports:  [ '6379:6379' ]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '${{ env.NODE_VERSION }}', cache: 'npm' }
      - name: Restore cache
        uses: actions/cache@v4
        with:
          path: node_modules
          key:  ${{ needs.install.outputs.cache-key }}
          fail-on-cache-miss: true
      - name: Download build artifact
        uses: actions/download-artifact@v4
        with: { name: next-build-${{ github.sha }} }
      - name: Prisma migrate + seed e2e DB
        run:  npx prisma migrate deploy && npx tsx prisma/seed.test.ts
        env:
          DATABASE_URL: mysql://root:rootpw@127.0.0.1:3306/mytenant_e2e
      - name: Install Playwright browsers
        run:  npx playwright install --with-deps ${{ matrix.browser }}
      - name: Start production server + run tests
        run:  npx playwright test --project=${{ matrix.browser }} --shard=${{ matrix.shard }}/${{ strategy.job-total }}
        env:
          DATABASE_URL:       mysql://root:rootpw@127.0.0.1:3306/mytenant_e2e
          REDIS_URL:          redis://127.0.0.1:6379
          AUTH_SECRET:        e2e-test-secret
          NEXT_PUBLIC_APP_URL:'http://127.0.0.1:3000'
          STRIPE_API_KEY:     sk_test_e2e
          NODE_ENV:           test
      - name: Upload Playwright report
        if:   always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report-${{ matrix.browser }}-${{ matrix.shard }}
          path: |
            playwright-report/
            test-results/
          retention-days: 30

  # ───────────────────────────────────────────────────────────────
  # DEPLOY — Staging (auto on release/* or main success)
  # ───────────────────────────────────────────────────────────────
  deploy-staging:
    name: Deploy → Staging
    if: >-
      github.event_name == 'push' &&
      (github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/heads/release/')) &&
      !startsWith(github.ref, 'refs/tags/')
    needs: [ test, build, security, e2e ]
    runs-on: ubuntu-latest
    timeout-minutes: 12
    environment:
      name: staging
      url:  ${{ steps.deploy.outputs.url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '${{ env.NODE_VERSION }}' }
      - name: Install Vercel CLI
        run:  npm i -g vercel@latest
      - name: Pull Vercel env (staging project)
        run:  vercel pull --yes --environment=preview --token=${{ secrets.VERCEL_STAGING_TOKEN }}
      - name: Build Vercel artifact
        run:  vercel build --token=${{ secrets.VERCEL_STAGING_TOKEN }}
      - name: Deploy prebuilt to staging
        id:   deploy
        run:  echo "url=$(vercel deploy --prebuilt --token=${{ secrets.VERCEL_STAGING_TOKEN }})" >> $GITHUB_OUTPUT
      - name: Alias to staging canonical domain
        run:  vercel alias ${{ steps.deploy.outputs.url }} staging.mytenant-invoice.com --token=${{ secrets.VERCEL_STAGING_TOKEN }}
      - name: Post-deploy smoke tests
        run:  npx playwright test tests/smoke --project=chromium
        env:
          PLAYWRIGHT_TEST_BASE_URL: https://staging.mytenant-invoice.com
      - name: Notify Slack
        uses: slackapi/slack-github-action@v1
        with:
          channel-id: C04UAT8DEPX   # #deployments
          slack-message: "✅ Staging deploy of ${{ github.sha }} (${{ github.ref_name }}) → ${{ steps.deploy.outputs.url }}"
        env:
          SLACK_BOT_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}

  # ───────────────────────────────────────────────────────────────
  # DEPLOY — Production (tag v* + manual approval gate)
  # ───────────────────────────────────────────────────────────────
  deploy-production:
    name: Deploy → Production
    if:   startsWith(github.ref, 'refs/tags/v')
    needs: [ test, build, security, e2e ]
    runs-on: ubuntu-latest
    timeout-minutes: 15
    environment:
      name: production
      url:  ${{ steps.deploy.outputs.url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '${{ env.NODE_VERSION }}' }
      - name: Install Vercel CLI
        run:  npm i -g vercel@latest
      - name: Pull Vercel env (production project)
        run:  vercel pull --yes --environment=production --token=${{ secrets.VERCEL_PROD_TOKEN }}
      - name: Build Vercel artifact
        run:  vercel build --prod --token=${{ secrets.VERCEL_PROD_TOKEN }}
      - name: Trigger PlanetScale schema migrations (safe, only pending)
        run:  npx prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.PROD_DATABASE_URL_DIRECT }}
      - name: Deploy prebuilt to prod
        id:   deploy
        run:  echo "url=$(vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_PROD_TOKEN }})" >> $GITHUB_OUTPUT
      - name: Create Sentry release
        uses: getsentry/action-release@v1
        env:
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
          SENTRY_ORG:        cromstel-it-group
          SENTRY_PROJECT:    mytenant-invoice
        with:
          environment: production
          version:     ${{ github.ref_name }}
          sourcemaps:  .next/static/chunks
          finalize:    true
      - name: Run post-deploy smoke tests
        run:  npx playwright test tests/smoke --project=chromium --reporter=line
        env:
          PLAYWRIGHT_TEST_BASE_URL: ${{ steps.deploy.outputs.url }}
      - name: Send notification #prod-incidents
        uses: slackapi/slack-github-action@v1
        with:
          channel-id: C03J5A13J0F
          slack-message: "🚀 PROD deploy: ${{ github.ref_name }} — ${{ github.sha }} — by ${{ github.actor }} → ${{ steps.deploy.outputs.url }}\nChange log: <https://github.com/cromstel-it/mytenant-invoice/releases/tag/${{ github.ref_name }}|${{ github.ref_name }}>"
        env:
          SLACK_BOT_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}
```

---

## 3. Supporting Workflows

### 3.1 `.github/workflows/staging-refresh.yml` — Weekly staging DB refresh

```yaml
name: Weekly Staging Refresh

on:
  schedule:
    - cron: '0 2 * * 1'    # Monday 02:00 UTC
  workflow_dispatch:

jobs:
  refresh:
    runs-on: ubuntu-latest
    environment: staging
    timeout-minutes: 60
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - name: Install pscale CLI
        run:  |
          wget https://github.com/planetscale/cli/releases/download/v0.213.0/pscale_0.213.0_linux_amd64.deb
          sudo dpkg -i pscale_0.213.0_linux_amd64.deb
          echo "${{ secrets.PLANETSCALE_SERVICE_TOKEN }}" | pscale auth login --service-token "${{ secrets.PLANETSCALE_SERVICE_TOKEN_NAME }}" --no-input
      - name: Dump prod snapshot
        run:  pscale database dump mytenant_invoice main --output /tmp/prod-dump
      - name: Run PII anonymizer
        run:  npm ci && npx tsx tools/anonymize.ts --input /tmp/prod-dump --output /tmp/anon-dump
      - name: Restore to staging
        run:  pscale database restore-dump mytenant_invoice_staging main /tmp/anon-dump --wait
      - name: Flush staging Redis
        run:  |
          redis-cli -u ${{ secrets.STAGING_REDIS_URL }} FLUSHALL SYNC
      - name: Notify Slack #staging-ops
        uses: slackapi/slack-github-action@v1
        with:
          channel-id: C05KL07BND8
          slack-message: "🔄 Staging DB refreshed from prod snapshot. PII scrubbed."
        env: { SLACK_BOT_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }} }
```

### 3.2 `.github/workflows/dependabot-automerge.yml`

```yaml
name: Dependabot Auto-Merge

on: pull_request_target

permissions:
  pull-requests: write
  contents: write

jobs:
  automerge:
    if:   github.actor == 'dependabot[bot]'
    runs-on: ubuntu-latest
    steps:
      - name: Fetch metadata
        id: metadata
        uses: dependabot/fetch-metadata@v2
      - name: Enable auto-merge for patch/minor deps
        if: >-
          steps.metadata.outputs.update-type == 'version-update:semver-patch' ||
          (steps.metadata.outputs.update-type == 'version-update:semver-minor' &&
           contains(steps.metadata.outputs.dependency-names, 'stripe') == false &&
           contains(steps.metadata.outputs.dependency-names, 'prisma') == false &&
           contains(steps.metadata.outputs.dependency-names, 'next') == false)
        run: gh pr merge --auto --squash "$PR_URL"
        env: { PR_URL: ${{ github.event.pull_request.html_url }}, GITHUB_TOKEN: ${{ secrets.DEPENDABOT_MERGE_TOKEN }} }
```

---

## 4. Required Secrets & Variables

### GitHub Repository Secrets

| Secret Name                      | Source                              | Used In                                      |
|----------------------------------|-------------------------------------|----------------------------------------------|
| `VERCEL_STAGING_TOKEN`           | Vercel Personal Access Token — staging project scope | `deploy-staging`                       |
| `VERCEL_PROD_TOKEN`              | Vercel Personal Access Token — prod project scope | `deploy-production`                      |
| `SENTRY_AUTH_TOKEN`              | Sentry → Settings → Auth Tokens     | build, `deploy-production` (release tracking) |
| `CODECOV_TOKEN`                  | Codecov repo upload token           | test                                         |
| `SLACK_BOT_TOKEN`                | Slack Bot OAuth (xoxb-…)            | `deploy-staging`, `deploy-production`, refresh |
| `PLANETSCALE_SERVICE_TOKEN_NAME` + `…_TOKEN` | PlanetScale Service Token | `staging-refresh`                   |
| `PROD_DATABASE_URL_DIRECT`       | PlanetScale direct conn string      | `deploy-production` (migrate step)           |
| `STAGING_REDIS_URL`              | Upstash staging — rediss://…        | staging-refresh (FLUSHALL)                   |
| `DEPENDABOT_MERGE_TOKEN`         | GitHub PAT — repo scope             | dependabot-automerge                         |

### GitHub Repository Variables (non-secret)

| Variable Name               | Value                                                        |
|-----------------------------|--------------------------------------------------------------|
| `TEST_DATABASE_URL`         | `mysql://root:rootpw@127.0.0.1:3306/mytenant_test`          |

---

## 5. SLA & Performance Budget

| Stage             | Target Duration     | Alert On Exceeding |
|-------------------|---------------------|--------------------|
| `install`         | < 3 min (cache hit)| 5 min              |
| `lint` + `typecheck` | < 8 min          | 15 min             |
| `test`            | < 10 min            | 18 min             |
| `build`           | < 10 min            | 16 min             |
| `security`        | < 12 min            | 20 min             |
| `e2e`             | < 25 min            | 35 min             |
| **Full pipeline** | **< 50 min**        | 70 min → page SRE |

Historical pipeline metrics are tracked in a private dashboard: `https://datadoghq.com/dashboard/mytenant-ci`.
