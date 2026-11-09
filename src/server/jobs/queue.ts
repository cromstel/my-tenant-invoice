import { Job, Queue } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  // ioredis 6 defaults to RESP3; BullMQ's Lua dispatch is tested against RESP2.
  protocol: 2,
});

// Queue definitions
export const queues = {
  invoiceGeneration: new Queue('invoice-generation', { connection }),
  pdfGeneration: new Queue('pdf-generation', { connection }),
  emailDispatch: new Queue('email-dispatch', { connection }),
  paymentReminder: new Queue('payment-reminder', { connection }),
  recurringBilling: new Queue('recurring-billing', { connection }),
  meterReadingImport: new Queue('meter-reading-import', { connection }),
  webhookDelivery: new Queue('webhook-delivery', { connection }),
  dataExport: new Queue('data-export', { connection }),
  aiProcessing: new Queue('ai-processing', { connection }),
};

// Job data types
export interface InvoiceGenerationJob {
  leaseId: string;
  invoiceDate: string;
  dueDate: string;
  includeMeterCharges?: boolean;
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
}

export interface PdfGenerationJob {
  invoiceId: string;
  template?: string;
}

export interface EmailDispatchJob {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export interface PaymentReminderJob {
  organizationId: string;
  reminderType: 'due_soon' | 'overdue';
}

export interface WebhookDeliveryJob {
  webhookEndpointId: string;
  eventType: string;
  payload: Record<string, unknown>;
  attempt?: number;
}

export interface DataExportJob {
  organizationId: string;
  entityType: string;
  format: 'csv' | 'xlsx' | 'pdf';
  filters?: Record<string, unknown>;
}

// Helper to add jobs
export async function addJob<T>(
  queueName: keyof typeof queues,
  data: T,
  options?: { delay?: number; priority?: number },
) {
  const queue = queues[queueName];
  return queue.add(queueName, data, {
    delay: options?.delay,
    priority: options?.priority,
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  });
}

export { connection };
export type { Job };
