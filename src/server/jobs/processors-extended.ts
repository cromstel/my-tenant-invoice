import logger from '@/lib/logging/logger';
import { repositories } from '@/server/repositories';
import { services } from '@/server/services';

// Job processor: PDF generation for invoices
export async function processPdfGeneration(data: { invoiceId: string; template?: string }) {
  try {
    const invoice = await services.invoice.getById(data.invoiceId);
    // In a real implementation, this would use a PDF library like puppeteer or react-pdf
    // For now, we generate a simple HTML representation
    const html = `
      <html>
        <body>
          <h1>Invoice ${invoice.invoiceNumber}</h1>
          <p>Customer: ${invoice.customer?.fullName ?? 'Unknown'}</p>
          <p>Date: ${new Date(invoice.invoiceDate as Date).toLocaleDateString()}</p>
          <p>Due: ${new Date(invoice.dueDate as Date).toLocaleDateString()}</p>
          <p>Total: $${Number(invoice.total).toLocaleString()}</p>
          <table>
            <tr><th>Description</th><th>Qty</th><th>Price</th><th>Amount</th></tr>
            ${
              invoice.items
                ?.map(
                  (item: {
                    description: string | null;
                    quantity: unknown;
                    unitPrice: unknown;
                    amount: unknown;
                  }) => `
              <tr>
                <td>${item.description ?? '-'}</td>
                <td>${Number(item.quantity)}</td>
                <td>$${Number(item.unitPrice).toLocaleString()}</td>
                <td>$${Number(item.amount).toLocaleString()}</td>
              </tr>
            `,
                )
                .join('') ?? ''
            }
          </table>
        </body>
      </html>
    `;

    logger.info({ invoiceId: data.invoiceId }, 'PDF generation completed');
    return { html, invoiceId: data.invoiceId };
  } catch (err) {
    logger.error({ err, invoiceId: data.invoiceId }, 'PDF generation failed');
    throw err;
  }
}

// Job processor: Data export
export async function processDataExport(data: {
  organizationId: string;
  entityType: string;
  format: 'csv' | 'xlsx' | 'pdf';
  filters?: Record<string, unknown>;
}) {
  try {
    let records: unknown[] = [];

    switch (data.entityType) {
      case 'invoices':
        records = await repositories.invoice.findAll({
          organizationId: data.organizationId,
          ...data.filters,
        });
        break;
      case 'customers':
        records = await repositories.customer.findAll({
          organizationId: data.organizationId,
          ...data.filters,
        });
        break;
      case 'payments':
        records = await repositories.payment.findAll({
          organizationId: data.organizationId,
          ...data.filters,
        });
        break;
      case 'properties':
        records = await repositories.property.findAll({
          organizationId: data.organizationId,
          ...data.filters,
        });
        break;
      default:
        throw new Error(`Unknown entity type: ${data.entityType}`);
    }

    // Generate CSV
    if (data.format === 'csv' && records.length > 0) {
      const headers = Object.keys(records[0] as Record<string, unknown>);
      const csv = [
        headers.join(','),
        ...records.map((r) =>
          headers.map((h) => JSON.stringify((r as Record<string, unknown>)[h] ?? '')).join(','),
        ),
      ].join('\n');

      logger.info(
        { organizationId: data.organizationId, entityType: data.entityType, count: records.length },
        'Data export completed',
      );
      return { csv, count: records.length };
    }

    logger.info(
      { organizationId: data.organizationId, entityType: data.entityType, count: records.length },
      'Data export completed',
    );
    return { records, count: records.length };
  } catch (err) {
    logger.error({ err, organizationId: data.organizationId }, 'Data export failed');
    throw err;
  }
}

// Job processor: Meter reading import
export async function processMeterReadingImport(data: {
  organizationId: string;
  meterId: string;
  readings: Array<{ reading: number; readingDate: string; readingType?: string }>;
}) {
  try {
    const results = [];
    for (const r of data.readings) {
      const result = await services.meter.addReading({
        meterId: data.meterId,
        reading: r.reading,
        readingDate: new Date(r.readingDate),
        readingType: r.readingType ?? 'IMPORT',
      });
      results.push(result);
    }

    logger.info(
      { organizationId: data.organizationId, meterId: data.meterId, count: results.length },
      'Meter reading import completed',
    );
    return { imported: results.length, results };
  } catch (err) {
    logger.error({ err, organizationId: data.organizationId }, 'Meter reading import failed');
    throw err;
  }
}

// Job processor: AI processing
export async function processAIProcessing(data: {
  userId: string;
  organizationId: string;
  type: 'explain_invoice' | 'explain_tariff' | 'chat';
  payload: Record<string, unknown>;
}) {
  try {
    const { aiService } = await import('@/server/services/ai-service');
    let result: string;

    switch (data.type) {
      case 'explain_invoice':
        result = await aiService.explainInvoice(data.payload.invoiceId as string);
        break;
      case 'explain_tariff':
        result = await aiService.explainTariff(data.payload.tariffId as string);
        break;
      case 'chat':
        result = await aiService.chat(
          data.payload.messages as Array<{ role: 'user' | 'assistant'; content: string }>,
        );
        break;
      default:
        throw new Error(`Unknown AI processing type: ${data.type}`);
    }

    logger.info({ userId: data.userId, type: data.type }, 'AI processing completed');
    return { result };
  } catch (err) {
    logger.error({ err, userId: data.userId }, 'AI processing failed');
    throw err;
  }
}
