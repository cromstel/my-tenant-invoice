# Dependency Management

> npm dependencies are updated in two tracks: minor and patch updates are automated by Dependabot, major updates are migrated deliberately by hand.

---

## 1. Policy

| Update type  | Who applies it | How                                                                   |
| ------------ | -------------- | --------------------------------------------------------------------- |
| patch, minor | Dependabot     | One grouped pull request per dependency type, merged once CI is green |
| major        | A developer    | Deliberate migration, one dependency at a time, following §3          |

**Majors are ignored by Dependabot on purpose.** A major is a breaking change:
it can require schema and config changes, a lockfile rewrite and code edits, and
the correct response is rarely "merge the diff". Bundling majors into an
unattended grouped pull request produced a broken build in this repository — see
[the migration record](./DEPENDENCY_MIGRATION_2026-11.md) for the incident and
its root cause.

---

## 2. Dependabot configuration

```yaml
# .github/dependabot.yml
version: 2

updates:
  - package-ecosystem: npm
    directory: '/'
    schedule:
      interval: weekly
      day: monday
      time: '06:00'
      timezone: Etc/UTC
    open-pull-requests-limit: 5
    labels:
      - dependencies
    ignore:
      - dependency-name: '*'
        update-types:
          - 'version-update:semver-major'
    groups:
      production-dependencies:
        applies-to: version-updates
        dependency-type: production
        update-types:
          - minor
          - patch
      development-dependencies:
        applies-to: version-updates
        dependency-type: development
        update-types:
          - minor
          - patch
```

Two rules make this safe, and both must be kept:

1. **Every group sets `update-types`.** Without it a group silently accepts
   _every_ semantic version level, majors included.
2. **npm ignores `version-update:semver-major`.** Majors never reach a grouped
   pull request at all.

The `github-actions` ecosystem declares no groups, so each action already
arrives as its own pull request and needs no equivalent filter.

---

## 3. Migrating a major version

### 3.1 Before changing anything

- Confirm the target is a **stable** release. Check the dist-tags, not `latest`:
  a `latest` tag can point at a release candidate (for example `prisma@latest`
  was `8.0.0-rc.33` while the latest stable was `7.10.1`).
- Read the current documentation for the target version and list the breaking
  changes that apply to this codebase.
- Run `npm audit` before installing. It must report zero vulnerabilities.
- Check the package's install scripts. The repository approves them explicitly
  through the `allowScripts` field in `package.json`; keep those entries in
  sync with the versions in use.

### 3.2 The verification gate

Every step must leave these green, in this order:

| Step            | Command                 |
| --------------- | ----------------------- |
| Clean install   | `npm ci`                |
| Vulnerabilities | `npm audit` (must be 0) |
| Types           | `npm run typecheck`     |
| Lint            | `npm run lint`          |
| Format          | `npm run format:check`  |
| Unit tests      | `npm test`              |
| Build           | `npm run build`         |
| End to end      | `npm run test:e2e`      |

A failing gate is reported, never worked around. Fix the cause, or roll the
change back.

### 3.3 Changes that alter rendering

A major that changes how markup is styled needs a **visual parity check**:
capture the same routes and viewports before and after, then compare the
images pixel by pixel. Any difference is either a deliberate design change or
a regression to be fixed — never waved through.

For performance-sensitive changes, also compare Lighthouse accessibility,
best-practices and SEO scores and the Core Web Vitals metrics against the
pre-upgrade build on the same machine.

### 3.4 Changes that touch the database layer

Exercise the data path at runtime, not only at compile time. For this
repository that means: apply the migrations against a real database, run the
seed, and make a real query through the application's own client — including
the tenant-isolation extension, so the filtering is proven to still apply.

---

## 4. Notes for Prisma 7

Prisma 7 changed where configuration lives. These are the parts that surprise
people:

- **`prisma.config.ts` is the source of truth.** It holds the schema path, the
  migrations path, the seed command and the datasource URL. The legacy
  `package.json#prisma` seed key was removed.
- **The CLI no longer loads `.env` files.** `prisma.config.ts` loads
  `.env.local` and then `.env` itself, using `process.loadEnvFile`, which never
  overwrites a variable that is already set. Shell, CI and Docker values
  therefore always win.
- **`prisma generate` is an explicit step.** Prisma 7 no longer generates the
  client during install, so CI and Docker both run it as their own command.
- **The client requires a driver adapter.** `src/lib/db/prisma.ts` and
  `prisma/seed.ts` pass `@prisma/adapter-mariadb`; there is no
  `@prisma/adapter-mysql` package.
- **The datasource URL is no longer valid in the schema.** Keeping
  `url = env("DATABASE_URL")` in `prisma/schema.prisma` fails validation with
  `P1012`.

---

## 5. Notes for Tailwind 4

Tailwind 4 is configured from CSS. `tailwind.config.ts` has been retired and the
theme — colours, shadows, the container behaviour and the dark variant — is
declared in `src/styles/globals.css`. Utility classes are unchanged, so an
existing class name that stops working is usually a v4 behaviour difference
rather than a removed class; the `space-y-*` gap change described in the
migration record is the canonical example.

---

## 6. Related

- [Dependency Major-Version Migration — November 2026](./DEPENDENCY_MIGRATION_2026-11.md) —
  the audit trail for the migration that introduced the current setup.
- [Contributing](./CONTRIBUTING.md) — the contribution workflow this policy
  extends.
- [Changelog](./CHANGELOG.md) — the released changes.
