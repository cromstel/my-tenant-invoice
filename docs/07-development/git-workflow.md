# Git Workflow

> Conventional Commits · Squash-merge PRs · Signed releases. Linear history on `main`.

---

## 1. Commit Message Convention

Follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/). Enforced with `commitlint` + `husky`.

```
<type>(<scope>): <subject>

<body (optional, 72 cols)>

BREAKING CHANGE: <description>  (on MAJOR bumps)
```

### 1.1 Allowed Types

| Type       | Bumps version | Purpose                                                |
|------------|---------------|--------------------------------------------------------|
| `feat`     | minor         | A user-facing feature                                  |
| `fix`      | patch         | A user-facing bug fix                                  |
| `perf`     | patch         | Performance improvement                                |
| `refactor` | —             | Code change that is neither fix nor feat               |
| `docs`     | —             | Documentation-only                                     |
| `style`    | —             | Lint / formatting only                                 |
| `test`     | —             | Add or fix tests                                       |
| `build`    | —             | Dependencies, Docker, CI config                        |
| `ci`       | —             | GitHub Actions, pipeline scripts                       |
| `chore`    | —             | Maintenance, codegen, shadcn additions                 |
| `revert`   | —             | Reverts a previous commit                              |

### 1.2 Scopes (examples)

`auth`, `billing`, `invoice`, `customer`, `payments`, `reports`, `platform-ui`, `portal`, `api`, `db`, `infra`, `deps`, `e2e`.

### 1.3 Examples

```
feat(billing): compute pro-rated tariff on mid-cycle tenant move-in

Closes TBI-123
```

```
fix(invoice): prevent double-send by locking invoice row during email queue

- Adds SELECT ... FOR UPDATE in queue handler
- Adds idempotency key on queue entry
- Adds unit tests for concurrent dispatch
```

```
refactor(auth): extract session cookie helpers to lib/auth/session

No behavior change. Preparation for SAML SSO work.
```

### 1.4 commitlint Config

```ts
// commitlint.config.ts
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [2, "always", [
      "feat","fix","perf","refactor","docs","style","test","build","ci","chore","revert",
    ]],
    "header-max-length": [2, "always", 72],
    "subject-case":    [2, "never",  ["sentence-case","start-case","pascal-case","upper-case"]],
  },
};
```

---

## 2. Pull Requests

### 2.1 PR Anatomy

- **Title** uses conventional commit format (this becomes squash commit).
- **Body** includes:
  - Summary / why.
  - Screenshot or Loom for UI changes.
  - Link to Linear issue `TBI-###`.
  - Test plan.
  - Release notes note (optional).
- **Size** < 400 changed lines (excluding tests / generated). Larger PRs get split.

### 2.2 Template (`.github/PULL_REQUEST_TEMPLATE.md`)

```md
## Summary

Fixes TBI-___

<!-- Describe WHAT and WHY, not HOW. -->

## Type of change

- [ ] Bug fix (non-breaking)
- [ ] Feature (non-breaking)
- [ ] Breaking change
- [ ] Refactor / tests / docs

## Screenshots / UI

<!-- Paste before/after or a Loom link -->

## How to test

1. Check out this branch.
2. `pnpm db:migrate && pnpm db:seed`
3. Open ...

## Checklist

- [ ] I have run `pnpm typecheck` and there are no errors
- [ ] I have added/updated tests (unit/integration/e2e as appropriate)
- [ ] I have added/updated docs under `/docs`
- [ ] I have reviewed database queries for N+1s and tenant scoping
```

### 2.3 Review

- **Auto-merge enabled only when**:
  - All status checks pass (lint, typecheck, unit, integration, e2e, security).
  - 1 approval from `CODEOWNERS` path owners.
  - For `app/(marketing)/`, `app/(auth)/` — add `@cromstel/design` as reviewer.
  - For `lib/billing`, `lib/payments` — add `@cromstel/finance` as reviewer.
  - For `lib/db` — add `@cromstel/platform` as reviewer.

### 2.4 Merge Strategy

**Always squash-merge**. Result:

- `main` and `develop` are linear, one commit per PR.
- Commit message is pre-filled from PR title (conventional).
- Intermediate commits are discarded.

```
main:
  ├─ feat(billing): pro-rate tariffs  (#421)  ← squash commit
  ├─ fix(invoice): prevent double-send (#420)
  └─ ...
```

---

## 3. Rebasing

When your `feature/` branch drifts from `develop`:

```bash
git checkout feature/TBI-123
git fetch origin
git rebase origin/develop
# resolve conflicts, then:
git push --force-with-lease
```

Never merge `develop` into a feature branch. Always rebase.

---

## 4. Releases & Tags

A release PR (`release/v1.12.0`) creates one squash commit on `main` tagged:

```bash
git tag -s -a v1.12.0 -m "chore(release): v1.12.0"
git push origin v1.12.0
```

Tags are GPG-signed (release manager only). CI then builds, runs smoke tests, and deploys to production using the tagged commit.

---

## 5. Hotfixes

Hotfix branches off `main`, not develop. See [`branch-strategy.md`](./branch-strategy.md).
