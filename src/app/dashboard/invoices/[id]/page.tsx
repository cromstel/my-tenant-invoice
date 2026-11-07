import { notFound } from 'next/navigation';

import { services } from '@/server/services';

export const dynamic = 'force-dynamic';

interface InvoiceDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function InvoiceDetailPage({ params }: InvoiceDetailPageProps) {
  const { id } = await params;

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
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoice {invoice.invoiceNumber}</h1>
          <p className="text-muted-foreground">
            {invoice.customer?.fullName ?? 'Unknown Customer'} ·{' '}
            {new Date(invoice.invoiceDate as Date).toLocaleDateString()}
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
          <div className="text-lg font-bold">${Number(invoice.subtotal).toLocaleString()}</div>
        </div>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Tax</div>
          <div className="text-lg font-bold">${Number(invoice.taxAmount).toLocaleString()}</div>
        </div>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Total</div>
          <div className="text-lg font-bold">${Number(invoice.total).toLocaleString()}</div>
        </div>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Balance</div>
          <div className="text-lg font-bold">
            ${Number(invoice.remainingBalance).toLocaleString()}
          </div>
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
                  <td className="p-3 text-sm">${Number(item.unitPrice).toLocaleString()}</td>
                  <td className="p-3 text-sm">${Number(item.amount).toLocaleString()}</td>
                  <td className="p-3 text-sm">${Number(item.taxAmount).toLocaleString()}</td>
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
            <span>{new Date(invoice.invoiceDate as Date).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Due Date</span>
            <span>{new Date(invoice.dueDate as Date).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Currency</span>
            <span>{invoice.currency}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Amount Paid</span>
            <span>${Number(invoice.amountPaid).toLocaleString()}</span>
          </div>
        </div>
        {invoice.notes && (
          <div className="mt-4">
            <span className="text-sm text-muted-foreground">Notes:</span>
            <p className="mt-1 text-sm">{invoice.notes}</p>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {invoice.status === 'DRAFT' && (
          <a
            href={`/dashboard/invoices/${id}/edit`}
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium shadow hover:bg-accent"
          >
            Edit
          </a>
        )}
        {invoice.status === 'DRAFT' && (
          <form action={`/api/v1/invoices/${id}/send`} method="POST">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
            >
              Send Invoice
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
