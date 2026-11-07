import logger from '@/lib/logging/logger';
import { emailAdapter } from '@/server/integrations/email-adapter';
import { triggerWebhooks } from '@/server/integrations/webhook-delivery';
import { addJob } from '@/server/jobs/queue';
import { repositories } from '@/server/repositories';
import { services } from '@/server/services';

// Job processor: Generate invoice from lease
export async function processInvoiceGeneration(data: {
  leaseId: string;
  invoiceDate: string;
  dueDate: string;
  includeMeterCharges?: boolean;
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
}) {
  try {
    const invoice = await services.billing.generateInvoiceFromLease({
      leaseId: data.leaseId,
      invoiceDate: new Date(data.invoiceDate),
      dueDate: new Date(data.dueDate),
      includeMeterCharges: data.includeMeterCharges,
      billingPeriodStart: data.billingPeriodStart ? new Date(data.billingPeriodStart) : undefined,
      billingPeriodEnd: data.billingPeriodEnd ? new Date(data.billingPeriodEnd) : undefined,
    });

    // Trigger webhook
    const lease = await repositories.lease.findById(data.leaseId);
    if (lease) {
      await triggerWebhooks(lease.organizationId, 'invoice.created', {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        total: invoice.total,
      });
    }

    // Queue PDF generation
    await addJob('pdfGeneration', { invoiceId: invoice.id });

    logger.info({ invoiceId: invoice.id }, 'Invoice generation job completed');
    return invoice;
  } catch (err) {
    logger.error({ err, leaseId: data.leaseId }, 'Invoice generation job failed');
    throw err;
  }
}

// Job processor: Send payment reminders
export async function processPaymentReminders(
  organizationId: string,
  reminderType: 'due_soon' | 'overdue',
) {
  try {
    const invoices = await repositories.invoice.findAll({ organizationId });

    const now = new Date();
    const filtered = invoices.filter((inv) => {
      if (inv.status === 'PAID' || inv.status === 'CANCELLED' || inv.status === 'VOID')
        return false;
      const dueDate = new Date(inv.dueDate as Date);
      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (reminderType === 'due_soon') return daysUntilDue > 0 && daysUntilDue <= 3;
      if (reminderType === 'overdue') return daysUntilDue < 0;
      return false;
    });

    for (const invoice of filtered) {
      const customer = await repositories.customer.findById(invoice.customerId);
      if (customer?.email) {
        await emailAdapter.sendTemplate(
          customer.email,
          reminderType === 'due_soon' ? 'overdueReminder' : 'overdueReminder',
          {
            invoiceNumber: invoice.invoiceNumber,
            total: invoice.total,
            dueDate: invoice.dueDate,
            customerName: customer.fullName,
          },
        );
      }
    }

    logger.info({ organizationId, reminderType, count: filtered.length }, 'Payment reminders sent');
    return { sent: filtered.length };
  } catch (err) {
    logger.error({ err, organizationId }, 'Payment reminder job failed');
    throw err;
  }
}

// Job processor: Recurring billing
export async function processRecurringBilling(organizationId: string) {
  try {
    const leases = await repositories.lease.findAll({ organizationId, status: 'ACTIVE' });
    const today = new Date();
    const results = [];

    for (const lease of leases) {
      // Check if billing is due (simplified: monthly on the 1st)
      if (today.getDate() === 1) {
        const invoice = await services.billing.generateInvoiceFromLease({
          leaseId: lease.id,
          invoiceDate: today,
          dueDate: new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000),
          includeMeterCharges: true,
        });
        results.push(invoice);
      }
    }

    logger.info({ organizationId, generated: results.length }, 'Recurring billing completed');
    return { generated: results.length };
  } catch (err) {
    logger.error({ err, organizationId }, 'Recurring billing job failed');
    throw err;
  }
}
