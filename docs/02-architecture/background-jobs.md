# Background Jobs

This document describes the background job processing architecture for **myTenant Invoice**, detailing how long-running, asynchronous, and scheduled tasks are handled to ensure application responsiveness, scalability, and reliability.

---

## 1. Overview

Background jobs are crucial for offloading intensive or time-consuming operations from the main request/response cycle. They enable the application to:

-   Maintain fast user interface response times.
-   Process large batches of data without timeouts.
-   Execute scheduled tasks (e.g., recurring billing).
-   Perform reliable inter-service communication (e.g., webhooks, notifications).

**BullMQ**, backed by **Redis**, is the chosen technology for our job queue system.

---

## 2. Technology Stack

-   **Queue Library**: [BullMQ](https://docs.bullmq.io/)
-   **Message Broker**: [Redis](https://redis.io/) (used for storing job data and managing queues)
-   **Worker Runtime**: Node.js (within dedicated worker processes or serverless functions)

**Why BullMQ?**

-   **Persistence**: Jobs are stored in Redis, ensuring they survive process restarts.
-   **Reliability**: Built-in retry mechanisms, back-off strategies, and dead-letter queues.
-   **Concurrency Control**: Manage concurrent job execution to optimize resource usage.
-   **Observability**: Provides mechanisms for monitoring job status, progress, and historical data.
-   **Scheduling**: Supports delayed and repeatable jobs for cron-like functionality.

See also: [ADR-005: Choosing BullMQ for Background Jobs and Event Processing](architecture-decisions/adr-005-bullmq-for-background-jobs-and-events.md)

---

## 3. Key Use Cases for Background Jobs

| Use Case                  | Description                                                        | Trigger (Example)                       | Queue (Example) |
| :------------------------ | :----------------------------------------------------------------- | :-------------------------------------- | :-------------- |
| **Invoice Batches**       | Generate and process multiple invoices for a billing cycle.        | Scheduled (cron) / API call             | `billingQueue`  |
| **PDF Generation**        | Create PDF versions of invoices, statements, and reports.          | `invoice.sent` event / UI action        | `documentQueue` |
| **Bulk Email/SMS**        | Send mass notifications (e.g., overdue reminders, marketing).      | Scheduled / API call                    | `notificationQueue` |
| **Data Exports/Imports**  | Process large CSV/Excel files for customer, property, meter data.  | UI action / API call                    | `importExportQueue` |
| **Recurring Billing**     | Automatically generate invoices for recurring services.            | Scheduled (daily/monthly)               | `billingQueue`  |
| **Reminders**             | Send due date reminders for invoices, lease renewals.              | Scheduled (daily)                       | `notificationQueue` |
| **Payment Reconciliation**| Match incoming bank payments to outstanding invoices.              | Scheduled (daily) / bank webhook        | `paymentQueue`  |
| **Webhook Retries**       | Re-attempt failed webhook deliveries with exponential back-off.    | `webhook.delivery.failed` event         | `webhookQueue`  |
| **AI Processing**         | Generate AI insights, process language models.                     | `meter.reading.anomaly` / UI request    | `aiQueue`       |
| **Database Backfills**    | Update or migrate large datasets in the background.                | Deployment / Admin action               | `migrationQueue` |

---

## 4. Job Structure and Implementation

### 4.1. Centralized Queue Definitions

Queues are defined centrally in `src/server/jobs/queues.ts`.

```typescript
// src/server/jobs/queues.ts
import { Queue } from 'bullmq';
import { redisConnection } from '@/lib/db/redis';

export const invoiceQueue = new Queue('invoices', { connection: redisConnection });
export const notificationQueue = new Queue('notifications', { connection: redisConnection });
export const billingQueue = new Queue('billing', { connection: redisConnection });
// ... other queues
```

### 4.2. Adding Jobs

Jobs are added to queues with a `name` (event type) and `data` (payload).

```typescript
// Example: Adding an invoice generation job
import { billingQueue } from '@/server/jobs/queues';

async function triggerMonthlyBilling(organizationId: string, billingCycleId: string) {
  await billingQueue.add('generateMonthlyInvoices', {
    organizationId,
    billingCycleId,
    triggeredBy: 'system',
  }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: true,
    removeOnFail: false,
  });
}
```

### 4.3. Job Workers

Dedicated worker processes (or serverless functions configured for long-running tasks) process jobs from queues. Each worker processes a specific job type.

```typescript
// src/server/jobs/workers/billing.worker.ts (simplified)
import { Worker } from 'bullmq';
import { redisConnection } from '@/lib/db/redis';
import { generateInvoicesService } from '@/server/services/billing.service';
import { auditLogService } from '@/server/services/audit.service';

new Worker('billing', async (job) => {
  const { organizationId, billingCycleId, triggeredBy } = job.data;
  console.log(`Processing monthly invoices for ${organizationId} cycle ${billingCycleId}`);
  
  try {
    await generateInvoicesService(organizationId, billingCycleId);
    await auditLogService.log({ 
      organizationId, 
      action: 'billing.generate_success', 
      entityType: 'BillingCycle', 
      entityId: billingCycleId 
    });
    job.log(`Successfully generated invoices for ${organizationId}`);
  } catch (error) {
    await auditLogService.log({ 
      organizationId, 
      action: 'billing.generate_failed', 
      entityType: 'BillingCycle', 
      entityId: billingCycleId, 
      metadata: { error: error.message } 
    });
    throw error; // Re-throw to trigger BullMQ retries/DLQ
  }
}, { connection: redisConnection });
```

### 4.4. Scheduling Repeatable Jobs (Cron-like)

BullMQ supports repeatable jobs for scheduled tasks.

```typescript
// src/server/jobs/scheduler.ts
import { Rsmq } from 'rsmq'; // or other scheduling method
import { billingQueue } from './queues';

export async function setupScheduledJobs() {
  await billingQueue.add('generateMonthlyInvoices', { type: 'monthly-auto' }, {
    repeat: { cron: '0 0 1 * *' }, // Run at midnight on the 1st of every month
    jobId: 'monthly-billing-job',
  });
  // ... other scheduled jobs
}
```

---

## 5. Reliability and Error Handling

-   **Idempotency**: All jobs that perform state changes (especially financial ones) are designed to be idempotent to prevent duplicate processing issues on retries.
-   **Retries**: Jobs are configured with a sensible number of retries and exponential back-off.
-   **Dead-Letter Queue (DLQ)**: Failed jobs that exhaust all retries are moved to a dedicated `failed` queue for manual inspection and reprocessing.
-   **Concurrency**: Workers can be configured to process jobs concurrently or sequentially, based on the nature of the task (e.g., invoice generation might be sequential per organization).
-   **Observability**: Integrated with monitoring tools to track job success rates, failures, processing times, and queue depths. Alerts are configured for critical failures.

---

## 6. Tenant Isolation in Background Jobs

-   Every job payload related to tenant data **must** include the `organizationId`.
-   Workers processing tenant-scoped jobs **must** use this `organizationId` for all database operations and service calls, enforcing strict data isolation.
-   Platform-level jobs (e.g., managing global subscription plans) may not have an `organizationId` but operate only on platform-level data.

---

## Related Documentation

-   [Event Architecture](event-architecture.md)
-   [Caching Strategy](caching-strategy.md)
-   [Multi-Tenancy Architecture](multi-tenancy-architecture.md)
-   [Audit Logging](../05-security/audit-logging.md)
-   [Observability](../09-devops/observability.md)
-   [Disaster Recovery](../09-devops/disaster-recovery.md)
