# Caching Strategy

This document outlines the caching strategy for **myTenant Invoice**, detailing how caching is implemented to improve application performance, reduce database load, and enhance user experience. Caching is applied at multiple layers to optimize data retrieval and computation.

---

## 1. Overview

myTenant Invoice employs a multi-layered caching strategy, including:

-   **CDN Caching**: For static assets and public-facing content.
-   **Application-Level Caching**: In-memory or distributed cache for frequently accessed data.
-   **Database Caching**: Leveraging database-specific mechanisms like query caches or read replicas.
-   **Client-Side Caching**: Browser caching and React Query/SWR for UI data.

**Redis** is the primary technology for distributed application-level caching and session management.

---

## 2. Caching Layers

### 2.1. CDN Caching (Cloudflare, Vercel Edge Network)

-   **Purpose**: Accelerate delivery of static assets (images, CSS, JS bundles) and public marketing pages.
-   **Implementation**: Utilizes a Content Delivery Network (CDN) like Cloudflare or the Vercel Edge Network (for Next.js deployments).
-   **Cache-Control Headers**: Appropriate HTTP `Cache-Control` headers (e.g., `max-age`, `s-maxage`, `stale-while-revalidate`) are set for static assets and immutable resources.
-   **Invalidation**: Automatic cache invalidation on deployment for most assets. Manual invalidation for specific edge cases via CDN APIs.

### 2.2. Application-Level Caching (Redis)

-   **Technology**: **Redis** is used as a distributed cache store.
-   **Use Cases**:
    -   **Session Storage**: Storing user session data (e.g., via Auth.js/NextAuth session store) to support stateless application servers.
    -   **Feature Flags**: Caching feature flag states for quick retrieval.
    -   **Configuration Data**: Organization-specific configurations (branding, invoice settings) that change infrequently.
    -   **Reference Data**: Look-up tables, static lists (e.g., `PropertyType` enums, `ServiceTypeEnum` values).
    -   **Aggregated Data**: Results of expensive queries or computations that are accessed frequently (e.g., dashboard KPIs).
-   **Implementation**: Utilizes the `ioredis` client for Node.js. Caching utilities are centralized in `src/lib/cache/`.
-   **Cache Key Strategy**: Cache keys are designed to include `organizationId` for tenant-scoped data to prevent cross-tenant data leakage. Example: `org:{organizationId}:config`, `org:{organizationId}:metrics:dashboard`.
-   **Expiration (TTL)**: All cached data has an appropriate Time-To-Live (TTL) to ensure data freshness and prevent stale data. Long-lived data is revalidated or refreshed periodically.
-   **Cache Invalidation**: Explicit invalidation occurs when underlying data changes (e.g., after an organization updates its settings, the `org:{organizationId}:config` cache entry is deleted).

```typescript
// Example: src/lib/cache/redis.ts (simplified)
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export async function getOrgConfig(organizationId: string) {
  const key = `org:${organizationId}:config`;
  const cached = await redis.get(key);
  if (cached) {
    return JSON.parse(cached);
  }
  const config = await prisma.organization.findUnique({ where: { id: organizationId } });
  await redis.setex(key, 3600, JSON.stringify(config)); // Cache for 1 hour
  return config;
}
```

### 2.3. Database Caching

-   **Read Replicas**: For high-traffic read operations, MySQL read replicas are used to distribute the load and improve read performance. This is handled at the infrastructure level (e.g., PlanetScale, AWS RDS).
-   **Indexing**: Comprehensive [indexing strategy](../03-database/indexing-strategy.md) to optimize query performance, which inherently acts as a form of database-level optimization.
-   **Query Optimization**: Avoiding N+1 queries, using efficient JOINs, and selecting only necessary columns.

### 2.4. Client-Side Caching

-   **Browser Cache**: Standard browser caching mechanisms for static resources.
-   **Data Fetching Libraries**: Libraries like React Query (TanStack Query) or SWR are used for client-side data fetching and caching, providing automatic revalidation, background refetching, and stale-while-revalidate patterns for a snappier UI.
-   **Global State Management**: Context API or Zustand/Jotai for application-specific state caching that doesn't require persistence across sessions.

---

## 3. Cache Invalidation Strategy

-   **Write-Through / Write-Aside**: Most updates directly modify the database and then either update the cache (write-through) or invalidate relevant cache entries (write-aside).
-   **Event-Driven Invalidation**: Key events (e.g., `organization.updated`, `tariff.updated`) trigger invalidation of related cache entries via background jobs.
-   **TTL Expiry**: All cache entries have a defined TTL, ensuring stale data is eventually removed.
-   **Manual Invalidation**: Platform administrators may have tools to manually invalidate specific cache keys in emergencies.

---

## 4. Tenant Isolation in Caching

-   All cached data containing tenant-specific information **must** be keyed by `organizationId`.
-   Platform-wide data (e.g., `SubscriptionPlan` details, global settings) may be cached without `organizationId` but must not contain any sensitive tenant information.
-   Strict adherence to the `organizationId` prefix in cache keys prevents a user from Organization A from inadvertently retrieving cached data belonging to Organization B.

---

## 5. Security Considerations

-   **No Sensitive Data in Public Caches**: Sensitive PII, financial data, or secrets are never cached in CDN or client-side caches.
-   **Encryption**: Data in Redis can be encrypted at rest if the Redis provider supports it (e.g., AWS ElastiCache encryption).
-   **Access Control**: Redis instances are secured with strong passwords/tokens and network access restrictions.
-   **Cache Poisoning**: Measures are in place to prevent attackers from injecting malicious data into the cache.

---

## Related Documentation

-   [Background Jobs](background-jobs.md)
-   [Event Architecture](event-architecture.md)
-   [Multi-Tenancy Architecture](multi-tenancy-architecture.md)
-   [Database Architecture](database-architecture.md)
-   [Indexing Strategy](../03-database/indexing-strategy.md)
-   [Non-Functional Requirements](../01-product/non-functional-requirements.md)
