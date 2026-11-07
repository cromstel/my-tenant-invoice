import { getCurrentUser } from '@/lib/auth';
import { AuthorizationError } from '@/lib/errors';
import logger from '@/lib/logging/logger';
import { getActiveOrganizationId } from '@/lib/tenant';
import { openaiAdapter } from '@/server/integrations/openai-adapter';
import { services } from '@/server/services';

export interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class AIService {
  async chat(messages: AIChatMessage[], context?: { invoiceId?: string; meterId?: string }) {
    if (!openaiAdapter.isConfigured()) {
      throw new Error('AI service not configured');
    }

    const user = await getCurrentUser();
    if (!user) throw new AuthorizationError('Authentication required');

    const orgId = await getActiveOrganizationId();

    // Build context from tenant-scoped data
    let systemContext = 'You are a helpful billing assistant for myTenant Invoice. ';
    systemContext += 'Answer questions about invoices, tariffs, consumption, and billing. ';
    systemContext += 'Only use the data provided. Never make up information. ';

    if (context?.invoiceId) {
      try {
        const invoice = await services.invoice.getById(context.invoiceId);
        systemContext += `\nInvoice context: ${JSON.stringify({
          number: invoice.invoiceNumber,
          status: invoice.status,
          total: invoice.total,
          dueDate: invoice.dueDate,
          items: invoice.items?.map(
            (i: { description: string | null; quantity: unknown; amount: unknown }) => ({
              description: i.description,
              quantity: i.quantity,
              amount: i.amount,
            }),
          ),
        })}`;
      } catch {
        // Ignore errors
      }
    }

    if (context?.meterId) {
      try {
        const meter = await services.meter.getById(context.meterId);
        systemContext += `\nMeter context: ${JSON.stringify({
          serialNumber: meter.serialNumber,
          type: meter.meterType,
          latestReading: meter.latestReading,
          unit: meter.unitOfMeasurement,
        })}`;
      } catch {
        // Ignore errors
      }
    }

    const response = await openaiAdapter.chat([
      { role: 'system', content: systemContext },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ]);

    logger.info({ userId: user.id, orgId, messageCount: messages.length }, 'AI chat completed');
    return response;
  }

  async explainInvoice(invoiceId: string) {
    const invoice = await services.invoice.getById(invoiceId);
    return openaiAdapter.explainInvoice({
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      subtotal: invoice.subtotal,
      taxAmount: invoice.taxAmount,
      total: invoice.total,
      amountPaid: invoice.amountPaid,
      remainingBalance: invoice.remainingBalance,
      dueDate: invoice.dueDate,
      items: invoice.items?.map(
        (i: {
          description: string | null;
          quantity: unknown;
          unitPrice: unknown;
          amount: unknown;
        }) => ({
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          amount: i.amount,
        }),
      ),
    });
  }

  async explainTariff(tariffId: string) {
    const tariff = await services.tariff.getById(tariffId);
    return openaiAdapter.explainTariff({
      name: tariff.name,
      description: tariff.description,
      isActive: tariff.isActive,
      versions: tariff.versions,
    });
  }
}

export const aiService = new AIService();
