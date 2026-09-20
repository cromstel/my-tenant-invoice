# ADR-003: Selecting Auth.js (NextAuth) for Authentication

**Status**: Accepted

---

## Context

Authentication is a critical component of any SaaS platform, especially one handling sensitive financial and tenant-isolated data. **myTenant Invoice** requires a robust, flexible, and secure authentication solution that offers:

-   **Compatibility**: Seamless integration with Next.js App Router and Server Actions.
-   **Feature Richness**: Support for email/password, email verification, password reset, secure sessions, and potential for OAuth/MFA.
-   **Security**: Industry-standard security practices, protection against common web vulnerabilities.
-   **Database Integration**: Easy integration with our MySQL + Prisma stack for user and session management.
-   **Developer Experience**: Simple API, clear documentation, and active community support.
-   **Multi-Tenancy**: Needs to support users belonging to multiple organizations and handling distinct organizational roles.

---

## Decision

We have chosen **Auth.js (formerly NextAuth.js v5)** as the authentication framework for **myTenant Invoice**.

Auth.js is explicitly designed for Next.js applications and provides a comprehensive suite of features essential for our platform:

-   **Native Next.js Integration**: First-class support for App Router, Server Components, and Server Actions, making it the most suitable choice for our core stack.
-   **Provider Flexibility**: Supports credential-based authentication (email/password), email magic links, and numerous OAuth providers (Google, GitHub, etc.) out-of-the-box.
-   **Prisma Adapter**: Offers an official adapter for Prisma, simplifying the integration with our MySQL database for managing `User`, `Account`, and `Session` models.
-   **Session Management**: Provides secure, JWT-based sessions that can be stored in a database (via Prisma adapter) or Redis (for enhanced scalability and control).
-   **Customization**: Highly customizable callbacks, pages, and flows to meet specific branding and user experience requirements.
-   **Security Features**: Handles common vulnerabilities like CSRF, session fixation, and credential stuffing internally.

---

## Consequences

### Positive

-   **Accelerated Development**: Reduces the effort required to build a secure authentication system from scratch.
-   **Strong Security Posture**: Leverages a widely-audited and maintained library, benefiting from community security efforts.
-   **Seamless Integration**: Designed for Next.js, ensuring optimal performance and developer experience within our stack.
-   **Scalability**: Supports stateless sessions via JWT and can integrate with Redis for high-performance session storage.
-   **Flexibility**: Easy to add or remove authentication methods as business needs evolve.

### Negative

-   **Abstractions**: Introduces its own set of abstractions and conventions that developers need to learn.
-   **Configuration Complexity**: Can be complex to configure correctly for advanced scenarios, especially with custom adapters or callbacks.
-   **Version Changes**: NextAuth v5 (Auth.js) introduced breaking changes from v4, requiring careful migration if upgrading from older versions (not an issue for new projects).
-   **Multi-tenancy Adaptation**: While Auth.js handles user authentication, integrating it with our custom multi-tenancy (`organizationId`, `OrganizationMember`) and RBAC model requires careful implementation of custom callbacks and authorization layers.

---

## Related Documentation

-   [Authentication Architecture](../authentication-architecture.md)
-   [Authorization Model](../authorization-model.md)
-   [Security Overview](../05-security/security-overview.md)
-   [Database Architecture](../database-architecture.md)
-   [Development - Getting Started](../07-development/getting-started.md)
