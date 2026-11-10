# Changelog

All notable changes to **myTenant Invoice** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Project structure and documentation foundation.
- Multi-tenant architecture specification (MySQL 8+ / Prisma / Next.js).
- Product vision, personas, user stories, and feature roadmap (Phase 0).

### Changed
- All dependencies migrated to their latest stable major versions — Prisma ORM
  7, Tailwind CSS 4, ESLint 10, stripe 23, and others. The full audit trail is
  in [the migration record](./DEPENDENCY_MIGRATION_2026-11.md).
- Dependabot groups now cover minor and patch updates only. Major updates are
  ignored and migrated deliberately, following
  [Dependency Management](./DEPENDENCY_MANAGEMENT.md).

### Deprecated
- (none)

### Removed
- (none)

### Fixed
- (none)

### Security
- Tenant isolation requirements documented.
- SOC 2 / GDPR / PCI DSS alignment requirements documented.
