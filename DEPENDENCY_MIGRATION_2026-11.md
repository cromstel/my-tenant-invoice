# Dependency Major-Version Migration — November 2026

> Audit trail for moving every dependency to its latest stable major, and for the Dependabot configuration fix that stopped majors from being bundled into grouped pull requests.

---

## 1. Scope

Every dependency named in the two broken Dependabot pull requests was upgraded
to its latest stable **major** version, and the pull requests were closed and
replaced by a configuration that cannot reproduce them.

| Pull request | Group                                                            | Outcome                                           |
| ------------ | ---------------------------------------------------------------- | ------------------------------------------------- |
| #1           | production dependencies, 24 updates                              | Closed, with the root cause recorded in a comment |
| #2           | development dependencies, 15 updates                             | Closed, with the root cause recorded in a comment |
| #9           | development dependencies, 2 updates (raised after the migration) | Closed; majors are now ignored by configuration   |

The migration set was verified against the targets in those pull requests: 33
dependencies match the target version exactly, 4 resolve to a newer patch or
minor within the same major, and 5 were removed — `autoprefixer` and
`tailwindcss-animate`, which Tailwind 4 no longer needs, and `@types/bcryptjs`,
`@types/nodemailer` and `@types/ua-parser-js`, whose packages now ship their
own type definitions.

Two majors were deliberately **not** applied: `typescript` 5 → 7 and
`jsdom` 30 → 31. They are not part of the original pull-request set — #2 kept
TypeScript at `^5.6.3` — and they appeared afterwards. They need their own
migration.

---

## 2. Root cause

### 2.1 Why the grouped pull requests were broken

`.github/dependabot.yml` declared `groups` without `update-types`. Per the
GitHub documentation, "by default, a group will include updates for all
semantic versions", so the groups silently opted the repository into **major**
upgrades. A grouped pull request therefore mixed breaking changes across
dozens of packages, and CI failed before the diff could be reviewed.

### 2.2 The two failure modes

Both were reproduced locally against `prisma@7.10.1` before anything was
changed.

**Pull request #1** — `@prisma/client` moved to v7 while the `prisma` CLI
stayed on v5:

```
Cannot find module '@prisma/client/generator-build/index.js'
```

The client and the CLI are a matched pair; splitting them across a grouped
update leaves the generator unable to run.

**Pull request #2** — the CLI moved to v7 while the client stayed on v5:

```
P1012: The datasource property `url` is no longer supported in schema files.
Move connection URLs for Migrate to `prisma.config.ts` and pass either
`adapter` for a direct database connection or `accelerateUrl` for Accelerate
to the `PrismaClient` constructor.
```

Prisma 7 moved the datasource URL out of the schema and made a driver adapter
mandatory, so the v5 schema and the v7 CLI are mutually incompatible.

---

## 3. What changed

Five atomic commits, each independently green:

| Commit    | Change                                                                                                                                                             | Verification                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `352c906` | 27 type-only and unused dependencies to their latest majors; 3 `@types` packages removed because the upgraded packages ship their own types                        | Full gate                                                                     |
| `633ee0a` | stripe 23, pino 10, pino-pretty 13, bullmq 6, ioredis 6, eslint 10, eslint-config-prettier 10, lint-staged 17, `@eslint/js`; Node 24 and `engines.node >= 22.22.1` | Full gate                                                                     |
| `99d7ec8` | Tailwind CSS 4.3.5 with the CSS-first configuration                                                                                                                | 34/34 screenshots pixel-identical, Lighthouse unchanged                       |
| `d4f8948` | Prisma ORM 7.10.1 with `prisma.config.ts` and the MariaDB driver adapter                                                                                           | Full gate, migrations and seed applied, tenant isolation exercised at runtime |
| `f54ecc2` | Dependabot groups limited to minor and patch; major updates ignored for npm                                                                                        | Dependabot's own job definition confirms the new rules                        |

### 3.1 Prisma 7

- `prisma/schema.prisma`: the datasource `url` was removed. Keeping it fails
  validation with `P1012`.
- `prisma.config.ts` (new): the schema path, the migrations path, the seed
  command and the datasource URL. The CLI does not load `.env` files any more,
  so the config loads `.env.local` and then `.env` with
  `process.loadEnvFile`, which never overrides an already-set variable — shell,
  CI and Docker values always win.
- `src/lib/db/prisma.ts` and `prisma/seed.ts`: the client is constructed with
  the `@prisma/adapter-mariadb` driver adapter.
- `package.json`: the legacy `prisma.seed` key was removed; `prisma.config.ts`
  is now the only source of truth for the seed command.
- `Dockerfile`: the builder stage gets a dummy `DATABASE_URL`, because the
  config resolves the datasource URL eagerly, and `prisma.config.ts` is copied
  into the runner stage so the CLI can run inside the image.

The CLI is pinned to **7.10.1**, the latest stable release. The `latest`
dist-tag pointed at `8.0.0-rc.33`, a release candidate, which this project
does not use.

### 3.2 Tailwind 4

`tailwind.config.ts`, `tailwindcss-animate` and `autoprefixer` were retired.
The theme — the v3 palette, the v3 shadow scale, the container behaviour and
the class-based dark variant — is declared in `src/styles/globals.css`, so
the rendered output is unchanged.

Two v4 behaviour differences needed explicit compensation:

- `space-y-*` applies `margin-block-end` to the preceding sibling at zero
  specificity. An inline `<Label>` therefore contributes no gap to the input
  that follows it, so the 11 affected inputs in the auth forms carry an
  explicit `mt-2`.
- The `--font-*` namespace collides with Tailwind's own, so the `next/font`
  variables were renamed to `--font-inter` and `--font-jetbrains-mono`.

### 3.3 Dependabot

`groups` now set `update-types: [minor, patch]` and npm ignores
`version-update:semver-major`. The rule is recorded in the configuration file
itself, with the reason next to it, so the next person to edit it does not
reintroduce the problem.

---

## 4. Verification

### 4.1 The gate

Run after every step, on the final commit:

| Check                  | Result                          |
| ---------------------- | ------------------------------- |
| `npm ci`               | clean install from the lockfile |
| `npm audit`            | 0 vulnerabilities               |
| `npm run typecheck`    | no errors                       |
| `npm run lint`         | no errors                       |
| `npm run format:check` | no differences                  |
| `npm test`             | 24 of 24 unit tests passed      |
| `npm run build`        | production build succeeded      |
| `npm run test:e2e`     | 9 of 9 end-to-end tests passed  |

CI on `main` ran all three jobs — types, lint, format and unit tests; the
production build; and the end-to-end suite — and all three passed.

### 4.2 Visual parity

17 routes × desktop and mobile = 34 screenshots, captured from the Tailwind 3
build and the Tailwind 4 build on the same machine and compared pixel by
pixel: **34 of 34 identical**.

### 4.3 Lighthouse

Three runs per page, against both builds, on the same machine:

| Page           | Accessibility | Best practices | SEO | Performance (median) |
| -------------- | ------------- | -------------- | --- | -------------------- |
| `/`            | 100           | 100            | 100 | 99 → 99              |
| `/auth/login`  | 100           | 100            | 100 | 85 → 93              |
| `/auth/signup` | 100           | 100            | 100 | 93 → 91              |

Largest Contentful Paint on `/` was 765 ms before and after, Cumulative Layout
Shift was 0 on every run, CSS grew from 6.1 KB to 7.4 KB against a 40 KB
budget, and the JavaScript payload was unchanged.

### 4.4 Runtime database behaviour

The Prisma 7 client was exercised against a real MariaDB database through the
application's own RLS-extended client:

- tenant reads are filtered by `organizationId` in the emitted SQL;
- a cross-tenant read returns no rows;
- a write without a tenant context is refused with `MissingTenantContextError`;
- platform-context reads still cross tenants.

### 4.5 Dependabot behaviour

After the configuration change, Dependabot's own job definition carried the
new rules — both groups with `update-types: [minor, patch]` and an
`ignore-conditions` entry for `version-update:semver-major` sourced from
`.github/dependabot.yml`. No pull request was opened, because every remaining
update is a major.

---

## 5. Open findings

None of these are regressions introduced by the migration.

| Severity | Finding                                                                                                                                                                           | Status                                                                                                                                                |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Warning  | `setTenantContext` only keeps the tenant context when the callback is `async`; a callback that returns the promise directly loses it and the row-level-security filter is skipped | Pre-existing — behaves identically on Prisma 5.22.0. Production code, `src/lib/api/with-error-handler.ts`, uses the safe async form. Worth hardening. |
| Warning  | The Dockerfile has no `.dockerignore`, so `COPY . .` copies the local `.env` and `.env.local`, including real credentials, into the builder stage                                 | Open                                                                                                                                                  |
| Warning  | `src/lib/config/env.ts` defaults `PLATFORM_ADMIN_EMAIL` to `admin@example.com`, and `prisma/seed.ts` falls back to the password `PlatformAdmin123!`                               | Open                                                                                                                                                  |
| Info     | The `docs/` directory is listed in `.gitignore`, so the documentation portal — and the links to it in `README.md` and `CONTRIBUTING.md` — are not part of the repository          | Open                                                                                                                                                  |
| Info     | `docs/09-devops/cicd.md` documents a `dependabot-automerge.yml` workflow that does not exist in the repository                                                                    | Open                                                                                                                                                  |
| Info     | `typescript` 5 → 7 and `jsdom` 30 → 31 are pending majors                                                                                                                         | Deferred to their own migrations                                                                                                                      |

---

## 6. References

- [Dependency Management](./DEPENDENCY_MANAGEMENT.md) — the standing policy.
- `.github/dependabot.yml` — the configuration described in §3.3.
- `prisma.config.ts` — the Prisma 7 configuration described in §3.1.
- `src/styles/globals.css` — the Tailwind 4 theme described in §3.2.
- `src/lib/db/rls-extension.ts` — the tenant-isolation extension exercised in §4.4.
