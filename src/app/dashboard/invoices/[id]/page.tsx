import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AppShell } from '@/components/app-shell/app-shell';
import { createMetadata, fmtDate, usd } from '@/lib/format';
import { requireOrgUser } from '@/server/page-guards';
import { services } from '@/server/services';

export const dynamic = 'force-dynamic';

export const metadata = createMetadata(
  'Invoice Details',
  'View invoice line items, totals, and payment status.',
);

interface InvoiceDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function InvoiceDetailPage({ params }: InvoiceDetailPageProps) {
  const { id } = await params;
  await requireOrgUser();

  let invoice: Awaited<ReturnType<typeof services.invoice.getById>> | null = null;
  try {
    invoice = await services.invoice.getById(id);
  } catch {
    notFound();
  }

  if (!invoice) {
    notFound();
  }

  return (
    <AppShell>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Invoice {invoice.invoiceNumber}</h1>
            <p className="text-muted-foreground">
              {invoice.customer?.fullName ?? 'Unknown Customer'} · {fmtDate(invoice.invoiceDate)}
            </p>
          </div>
          <div className="flex gap-2">
            <span className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-sm font-medium">
              {invoice.status}
            </span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">Subtotal</div>
            <div className="text-lg font-bold">{usd(invoice.subtotal)}</div>
          </div>
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">Tax</div>
            <div className="text-lg font-bold">{usd(invoice.taxAmount)}</div>
          </div>
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">Total</div>
            <div className="text-lg font-bold">{usd(invoice.total)}</div>
          </div>
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">Balance</div>
            <div className="text-lg font-bold">{usd(invoice.remainingBalance)}</div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold">Line Items</h3>
          {invoice.items && invoice.items.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left text-sm font-medium">Description</th>
                  <th className="p-3 text-left text-sm font-medium">Qty</th>
                  <th className="p-3 text-left text-sm font-medium">Unit Price</th>
                  <th className="p-3 text-left text-sm font-medium">Amount</th>
                  <th className="p-3 text-left text-sm font-medium">Tax</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="p-3 text-sm">{item.description ?? '-'}</td>
                    <td className="p-3 text-sm">{Number(item.quantity)}</td>
                    <td className="p-3 text-sm">{usd(item.unitPrice)}</td>
                    <td className="p-3 text-sm">{usd(item.amount)}</td>
                    <td className="p-3 text-sm">{usd(item.taxAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted-foreground">No line items.</p>
          )}
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold">Details</h3>
          <div className="grid gap-4 text-sm md:grid-cols-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Invoice Date</span>
              <span>{fmtDate(invoice.invoiceDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Due Date</span>
              <span>{fmtDate(invoice.dueDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Currency</span>
              <span>{invoice.currency}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount Paid</span>
              <span>{usd(invoice.amountPaid)}</span>
            </div>
          </div>
          {invoice.notes && (
            <div className="mt-4">
              <span className="text-sm text-muted-foreground">Notes:</span>
              <p className="mt-1 text-sm">{invoice.notes}</p>
            </div>
          )}
        </div>

        {invoice.status === 'DRAFT' && (
          <div className="flex gap-2">
            <Link
              href={`/dashboard/invoices/${id}/edit`}
              className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium shadow hover:bg-accent"
            >
              Edit
            </Link>
          </div>
        )}
      </div>
    </AppShell>
  );
}
