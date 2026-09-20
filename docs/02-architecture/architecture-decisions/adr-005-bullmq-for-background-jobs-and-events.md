# ADR-005: Choosing BullMQ and Redis for Background Jobs and Event Processing

**Status**: Accepted

---

## Context

**myTenant Invoice** requires robust capabilities for handling asynchronous tasks, long-running operations, scheduled jobs, and event-driven communication. Key requirements include:

-   **Reliability**: Ensure jobs are processed reliably, even in the face of application restarts or failures, with retry mechanisms.
-   **Scalability**: Support for high throughput of jobs and the ability to scale workers independently from the main application.
-   **Persistence**: Jobs should be stored persistently to prevent data loss.
-   **Scheduling**: Ability to schedule recurring tasks (cron-like functionality) and delayed jobs.
-   **Observability**: Tools to monitor job status, progress, and failures.
-   **Concurrency Control**: Manage how many jobs run simultaneously.
-   **Cost-Effectiveness**: A solution that is efficient for production environments.

---

## Decision

We have chosen **BullMQ** as our Node.js job queue library, backed by **Redis** as the message broker and storage layer, for all background jobs and event processing in **myTenant Invoice**.

BullMQ is a highly performant and feature-rich job queue built on top of Redis, specifically designed for Node.js environments. Its advantages include:

-   **Built on Redis**: Leverages Redis's speed and persistence for efficient job storage and management.
-   **Comprehensive Feature Set**: Provides queues, workers, repeatable jobs (cron), delayed jobs, priorities, concurrency control, and a clean API.
-   **Reliable Processing**: Automatic retries with exponential back-off, event logging, and dead-letter queues (DLQs) for failed jobs ensure high reliability.
-   **Observability**: Integrates well with monitoring tools, and offers a dashboard (BullMQ Dashboard) for visualizing queue status.
-   **Scalability**: Easily scales by adding more worker processes/servers, and Redis can be clustered for high availability.
-   **Type-Safe**: Provides excellent TypeScript support.

---

## Consequences

### Positive

-   **Improved Responsiveness**: Offloads long-running tasks from the main request thread, keeping the UI fast and responsive.
-   **Enhanced Reliability**: Guarantees delivery and processing of critical tasks (e.g., invoice generation, notifications) through retries and persistence.
-   **Efficient Resource Usage**: Allows for optimal utilization of computing resources by processing tasks asynchronously.
-   **Simplified Scheduling**: Provides native support for cron-based repeatable jobs, simplifying maintenance.
-   **Clear Event Flow**: Establishes a clear pattern for event-driven architecture within the application.

### Negative

-   **Redis Dependency**: Introduces Redis as a critical infrastructure dependency, requiring separate management and monitoring.
-   **Operational Complexity**: While powerful, managing BullMQ and Redis in production requires understanding queue monitoring, scaling Redis, and worker deployment strategies.
-   **Potential for Stale Data**: Incorrectly managed background jobs or data can lead to processing stale data if not carefully designed with idempotency and data freshness in mind.
-   **Cost**: Managed Redis services can incur additional infrastructure costs.

---

## Related Documentation

-   [Background Jobs](../background-jobs.md)
-   [Event Architecture](../event-architecture.md)
-   [Caching Strategy](../caching-strategy.md)
-   [Observability](../09-devops/observability.md)
-   [Disaster Recovery](../09-devops/disaster-recovery.md)
