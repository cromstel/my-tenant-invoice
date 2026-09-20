# Event Architecture

This document describes the event-driven architecture (EDA) for **myTenant Invoice**, detailing how events are generated, consumed, and processed across the system to support asynchronous operations, system integrations, and real-time updates.

---

## 1. Overview

myTenant Invoice leverages an event-driven approach to decouple services, improve scalability, and enhance responsiveness. Key components of our event architecture include:

-   **Event Producers**: Components that generate and publish events (e.g., `InvoiceService`, `PaymentService`).
-   **Event Bus / Queue**: A robust, persistent message queue for reliable event delivery (e.g., Redis-backed BullMQ).
-   **Event Consumers**: Services or workers that subscribe to and process events asynchronously.
-   **Event Schema**: Standardized structure for event payloads to ensure consistency and interoperability.

---

## 2. Event Types and Examples

Events represent significant state changes or actions within the system. They are typically named in a `resource.action` format.

| Event Type                 | Description                                                        | Producer              | Key Data (Examples)                  |
| :------------------------- | :----------------------------------------------------------------- | :-------------------- | :----------------------------------- |
| `organization.created`     | A new tenant organization has been provisioned.                    | `OrganizationService`   | `organizationId`, `name`, `slug`       |
| `invoice.created`          | A new invoice has been generated.                                  | `InvoiceService`        | `invoiceId`, `organizationId`, `customerId`, `total` |
| `invoice.sent`             | An invoice has been delivered to the customer.                     | `InvoiceService`        | `invoiceId`, `deliveryMethod`          |
| `invoice.paid`             | An invoice has been fully paid.                                    | `PaymentService`        | `invoiceId`, `paymentId`, `amount`     |
| `invoice.overdue`          | An invoice has become overdue.                                     | `BillingJobWorker`      | `invoiceId`, `dueDate`                 |
| `payment.succeeded`        | A payment transaction was successful.                              | `PaymentService`        | `paymentId`, `organizationId`, `amount` |
| `payment.failed`           | A payment transaction failed.                                      | `PaymentService`        | `paymentId`, `errorCode`               |
| `meter.reading.created`    | A new meter reading has been recorded.                             | `MeterService`          | `meterId`, `reading`, `readingDate`    |
| `user.registered`          | A new user has registered on the platform.                         | `AuthService`           | `userId`, `email`                      |
| `property.updated`         | Details of a property have been changed.                           | `PropertyService`       | `propertyId`, `organizationId`         |
| `webhook.delivery.failed`  | An attempt to deliver a webhook payload failed.                    | `WebhookService`        | `webhookEventId`, `statusCode`         |

---

## 3. Message Queue Technology

**BullMQ (backed by Redis)** has been chosen as the primary message queue for asynchronous job processing and event handling.

-   **Persistence**: Redis ensures messages are not lost on system restarts.
-   **Reliability**: Built-in retry mechanisms and dead-letter queues for failed jobs.
-   **Scalability**: Supports multiple workers and high message throughput.
-   **Observability**: Provides tools for monitoring queue status, job progress, and failures.

See also: [ADR-005: Choosing BullMQ for Background Jobs and Event Processing](architecture-decisions/adr-005-bullmq-for-background-jobs-and-events.md)

---

## 4. Event Flow

### 4.1. Publishing Events

Event producers publish messages to specific queues (or topics conceptually within BullMQ).

```typescript
// Example: InvoiceService publishing an event
import { invoiceQueue } from '@/server/jobs/queues';

async function createInvoice(data: CreateInvoiceDTO) {
  const invoice = await prisma.invoice.create({ data });
  await invoiceQueue.add('invoice.created', { invoiceId: invoice.id, organizationId: invoice.organizationId });
  return invoice;
}
```

### 4.2. Consuming Events

Dedicated background workers (consumers) listen to queues and process events. These workers are typically long-running processes.

```typescript
// Example: Background worker consuming 'invoice.created' event
import { invoiceQueue } from '@/server/jobs/queues';

invoiceQueue.process('invoice.created', async (job) => {
  const { invoiceId, organizationId } = job.data;
  // Logic to send email, create audit log, trigger webhooks, etc.
  console.log(`Processing invoice.created event for invoice ${invoiceId} in organization ${organizationId}`);
  // ... call other services, e.g., notificationService.sendInvoiceEmail(invoiceId)
});
```

---

## 5. Event Schema and Validation

Events use a consistent JSON payload structure. Zod schemas are used to validate event payloads, ensuring data integrity before processing.

```typescript
// Example: Zod schema for invoice.created event
import { z } from 'zod';

export const InvoiceCreatedEventSchema = z.object({
  invoiceId: z.string().cuid(),
  organizationId: z.string().cuid(),
  customerId: z.string().cuid(),
  total: z.number().positive(),
});

export type InvoiceCreatedEvent = z.infer<typeof InvoiceCreatedEventSchema>;
```

---

## 6. Idempotency

For critical financial and integration events (e.g., payment webhooks), idempotency is crucial to prevent duplicate processing.

-   **Strategy**: Use `idempotencyKey` in event payloads and store it in the database with a unique constraint. Before processing, check if a job with the same `idempotencyKey` has already been successfully processed.

See also: [Database Technology - Idempotency](../03-database/financial-precision.md#idempotency)

---

## 7. Error Handling & Retries

-   **Retry Mechanisms**: BullMQ provides automatic retry logic for failed jobs, with configurable back-off strategies.
-   **Dead-Letter Queue (DLQ)**: Jobs that exhaust their retries are moved to a DLQ for manual inspection and reprocessing.
-   **Monitoring**: Integrated with observability tools (Sentry) to alert on job failures.

---

## 8. Tenant Isolation in Event Processing

Every event payload that affects tenant-scoped data **must** include `organizationId`. Event consumers **must** use this `organizationId` in all database queries and service calls to ensure data isolation.

Platform-level events (e.g., `organization.created`) may not have an `organizationId` in their initial payload but will generate tenant-scoped follow-up actions.

---

## Related Documentation

-   [Background Jobs](background-jobs.md)
-   [Caching Strategy](caching-strategy.md)
-   [Multi-Tenancy Architecture](multi-tenancy-architecture.md)
-   [Audit Logging](../05-security/audit-logging.md)
-   [Database Technology - Idempotency](../03-database/financial-precision.md#idempotency)
