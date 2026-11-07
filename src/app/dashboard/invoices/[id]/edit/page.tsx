import { notFound } from 'next/navigation';

import { InvoiceEditForm } from '@/features/invoices/components/InvoiceEditForm';
import { services } from '@/server/services';

export const dynamic = 'force-dynamic';

interface InvoiceEditPageProps {
  params: Promise<{ id: string }>;
}

export default async function InvoiceEditPage({ params }: InvoiceEditPageProps) {
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
    <div className="max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Edit Invoice {invoice.invoiceNumber}</h1>
        <p className="text-muted-foreground">Update invoice status and details</p>
      </div>
      <InvoiceEditForm invoiceId={id} currentStatus={invoice.status} />
    </div>
  );
}
