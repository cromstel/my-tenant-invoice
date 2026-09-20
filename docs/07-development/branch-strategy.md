# Branch Strategy

> GitFlow-inspired with trunk-based release cadence. Protected branches: `main`, `develop`.

---

## 1. Branch Types

| Branch Type       | Pattern              | Parent    | Merges Into              | Purpose                                                    |
|-------------------|----------------------|-----------|--------------------------|------------------------------------------------------------|
| `main`            | `main`               | —         | —                        | Production deployable. Linear history only.                |
| `develop`         | `develop`            | `main`    | `main` (via `release/*`) | Integration of all in-flight features                      |
| `feature/*`       | `feature/TBI-###-slug` | `develop` | `develop`                | New feature or non-critical bug fix                        |
| `release/*`       | `release/vX.Y.Z`    | `develop` | `main` + `develop`       | Hardening, RC builds, release notes, version bump          |
| `hotfix/*`        | `hotfix/TBI-###-slug` | `main`  | `main` + `develop`       | Urgent production fix, out of cadence                      |

---

## 2. Branch Lifecycles

### 2.1 Feature Branch

```
develop
  └─ feature/TBI-123-auto-charge
        ├─ commit 1
        ├─ commit 2
        └─ (PR approved, squash-merged)
            ↘  develop (as single commit)
```

Rules:
- Max 1 Jira / Linear ticket per feature branch.
- Delete branch after merge.
- CI runs: lint, typecheck, unit, integration.
- e2e runs on `/ok-to-test` comment for large changes.

```bash
git checkout develop
git pull --ff-only origin develop
git checkout -b feature/TBI-123-auto-charge
# work
git commit -m "feat(billing): auto-charge for recurring tariffs"
git push -u origin feature/TBI-123-auto-charge
# open PR → develop
```

### 2.2 Release Branch

```
develop  (v1.12.0-dev)
  └─ release/v1.12.0
        ├─ chore: bump package.json to 1.12.0
        ├─ docs: update CHANGELOG 1.12.0
        ├─ fix: RC-only patches
        └─ (PR to main)  squash → main
            + (backport PR to develop)
```

Rules:
- Cut from `develop` every two weeks on Cadence Tuesday.
- Only `fix:*`, `chore:*`, `docs:*` commits allowed. No new features.
- Tag `vX.Y.Z` on `main` after merge.
- After `main` merge, open a backport PR to `develop` so RC patches are not lost.

### 2.3 Hotfix Branch

```
main  (v1.11.3)
  └─ hotfix/TBI-456-overdue-cron-null
        ├─ fix(cron): guard against NULL due_date in overdue-marker
        ├─ test: add regression test
        └─ (PR to main)  squash → main + tag v1.11.4
            + (backport PR to develop)
```

Rules:
- Branch off the **current production commit on `main`**.
- Includes fix + regression test + changelog entry.
- Requires 2 approvals.
- Merged → tag `vX.Y.Z+1`.
- Backport to `develop` as a separate PR.

---

## 3. Versioning — SemVer 2.0

Given a version `MAJOR.MINOR.PATCH`:

| Commit prefix    | Bump  |
|------------------|-------|
| `feat:`          | MINOR |
| `fix:`, `perf:`  | PATCH |
| `BREAKING CHANGE`footer | MAJOR |

Automated via `release-please` on `main`:

```yaml
# .github/workflows/release-please.yml
on:
  push:
    branches: [main]
permissions:
  contents: write
  pull-requests: write
jobs:
  release-please:
    runs-on: ubuntu-latest
    steps:
      - uses: googleapis/release-please-action@v4
        with:
          release-type: node
          package-name: mytenant-invoice
```

---

## 4. Protected Branch Rules

### 4.1 `main`

| Rule                                  | Value                                      |
|---------------------------------------|--------------------------------------------|
| Require pull request reviews          | 1 approval + CODEOWNERS                    |
| Dismiss stale reviews                 | yes                                        |
| Require status checks to pass         | lint, typecheck, unit, integration, e2e, security-audit, migration-plan |
| Require branches up-to-date           | yes                                        |
| Require signed commits                | yes (GPG)                                  |
| Include administrators                | no, same rules                             |
| Allow force pushes                    | **NO**                                     |
| Allow deletions                       | **NO**                                     |

### 4.2 `develop`

Same rules except:
- No signed-commits requirement.
- e2e runs only on demand for feature branches but mandatory for PR merge.

---

## 5. Branch Cleanup

- `feature/*` deleted automatically on GitHub merge (repo setting).
- `release/*` deleted 1 week after successful production deployment.
- `hotfix/*` deleted after backport PR merges to `develop`.
- Weekly cron closes stale branches:

```yaml
name: Clean Stale Branches
on:
  schedule: [{ cron: '0 4 * * 1' }]
jobs:
  stale:
    runs-on: ubuntu-latest
    steps:
      - uses: beatlabs/clean-sre-branches@v1
        with:
          days-before-stale: 30
          ignore-patterns: "^(main|develop)$"
```
