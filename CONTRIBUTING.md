# Contributing to myTenant Invoice

:wave: Thank you for your interest in contributing!
**myTenant Invoice** is a commercial SaaS platform by **CromStel IT Group**.
External contributions are welcome under the guidelines below.

---

## 1. Code of Conduct

All participants must adhere to the [Code of Conduct](./CODE_OF_CONDUCT.md).
We pledge to make participation a harassment-free experience.

---

## 2. Before You Start

1. Read the full [project documentation](./docs/README.md) first.
2. Architecture changes require opening a discussion **before** code.
3. Open an issue to discuss large features; we may redirect your effort if
   it overlaps with ongoing work.

---

## 3. Development Workflow

1. Fork the repository on GitHub.
2. Create a feature branch off `main` with a descriptive name:
   `feat/organization-branding`, `fix/invoice-decimal-rounding`, etc.
3. Make focused, atomic commits.
4. Add or update **tests** for every behavior change.
5. Run the full local validation before pushing:
   ```bash
   npm run lint
   npm run typecheck
   npm run format:check
   npm run test:unit
   npm run test:integration
   ```
6. When a dependency needs a major-version upgrade, follow
   [Dependency Management](./DEPENDENCY_MANAGEMENT.md). Majors are migrated by
   hand, one dependency at a time, never by a grouped Dependabot pull request.
7. Submit a pull request against `main` and fill in the PR template.

---

## 4. Coding Standards

- TypeScript **strict** mode — no `any`, no `@ts-ignore`.
- Favor feature modules under `/src/features/<domain>`.
- All server routes and server actions must validate inputs with Zod.
- Tenant-scoped operations must never trust client-provided `organizationId`.
- Financial math uses `Decimal.js` / Prisma `Decimal(19,4)`.
- Prefer **Next.js Server Components** where interactivity is not required.
- UI components come from our shadcn/ui-based design system.

See: [docs/07-development/coding-standards.md](docs/07-development/coding-standards.md).

---

## 5. Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(invoices): allow revision of PAID invoices via credit-note flow
fix(billing): round prorated charges per line item, not per invoice
docs(architecture): add tenant-isolation threat model section
test(isolation): add cross-tenant invoice retrieval E2E test
```

---

## 6. Pull Request Requirements

A PR is only eligible for review when all of the following are true:

- [ ] Build, lint, typecheck all pass locally.
- [ ] Unit and integration tests pass; new code has coverage.
- [ ] Tenant isolation tests added or updated.
- [ ] Documentation updated (API, architecture, user docs if applicable).
- [ ] No new secrets or hard-coded credentials.
- [ ] CHANGELOG.md updated under `[Unreleased]`.

---

## 7. Security

- **Never** commit secrets, keys, tokens, or production URLs.
- Report security issues privately: see [SECURITY.md](./SECURITY.md).
- Never weaken tenant isolation, validation, or authorization to “make the UI work.”

---

## 8. Questions

For product, architecture, or implementation questions, open a GitHub Discussion.
For urgent commercial or security matters, contact **CromStel IT Group**:
- https://cromstelit.com
- hello@cromstelit.com
