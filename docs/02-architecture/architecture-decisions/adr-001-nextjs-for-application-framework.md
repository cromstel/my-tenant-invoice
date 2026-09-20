# ADR-001: Choosing Next.js for Application Framework

**Status**: Accepted

---

## Context

**myTenant Invoice** requires a robust, scalable, and secure full-stack framework suitable for building a commercial SaaS platform. Key considerations included:

-   **Performance**: Server-side rendering (SSR), static site generation (SSG), and incremental static regeneration (ISR) for fast page loads.
-   **Developer Experience**: Strong tooling, clear conventions, and a large ecosystem.
-   **Scalability**: Ability to handle a large number of users and tenants with potential for global distribution.
-   **Security**: Built-in features and best practices for securing web applications.
-   **Full-Stack Capabilities**: Support for both frontend UI and backend API/logic within a single codebase.
-   **Modern Web Standards**: Embrace React, TypeScript, and modern JavaScript features.

---

## Decision

We have chosen **Next.js (latest stable App Router version)** as the primary application framework for **myTenant Invoice**.

Next.js, combined with React and TypeScript, provides a comprehensive solution that meets the requirements for a production-grade SaaS platform. Specifically:

-   **App Router**: Enables a full-stack approach with Server Components and Server Actions, allowing us to colocate data fetching and mutations with the UI components, simplifying data flow and reducing client-side JavaScript.
-   **Server-Side Rendering (SSR) / Static Site Generation (SSG)**: Optimizes initial page load performance and SEO.
-   **TypeScript Support**: First-class support for type safety, reducing bugs and improving maintainability.
-   **API Routes / Route Handlers**: Provides a built-in backend for handling API requests, server-side logic, and integrations.
-   **Ecosystem**: Benefits from the vast React and Node.js ecosystems for libraries, tools, and community support.
-   **Deployment**: Excellent compatibility with platforms like Vercel for simplified, scalable deployments.

---

## Consequences

### Positive

-   **Unified Development**: Frontend and backend development occurs within a single project, streamlining workflows.
-   **Optimized Performance**: Leverages Next.js's rendering strategies for superior load times.
-   **Enhanced Developer Experience**: TypeScript, fast refresh, and integrated tooling improve productivity.
-   **Future-Proof**: Aligns with modern web development trends and React's roadmap.
-   **Simplified Deployment**: Vercel integration provides a smooth path to production and scaling.

### Negative

-   **Learning Curve**: New paradigms like Server Components and Server Actions require developers to adapt.
-   **Complexity**: For simpler applications, Next.js might introduce unnecessary complexity.
-   **Vendor Lock-in (Vercel)**: While deployable elsewhere, some Next.js features are optimized for Vercel.

---

## Related Documentation

-   [Architecture Overview](../architecture-overview.md)
-   [Development - Getting Started](../07-development/getting-started.md)
-   [Tech Stack (in Master Prompt)](../../project-documentation.md#36-tech-stack)
