import { notFound } from 'next/navigation';

import { AppShell } from '@/components/app-shell/app-shell';
import { InvoiceEditForm } from '@/features/invoices/components/InvoiceEditForm';
import { createMetadata } from '@/lib/format';
import { requireOrgUser } from '@/server/page-guards';
import { services } from '@/server/services';

export const dynamic = 'force-dynamic';

export const metadata = createMetadata('Edit Invoice', 'Update invoice status and details.');

interface InvoiceEditPageProps {
  params: Promise<{ id: string }>;
}

export default async function InvoiceEditPage({ params }: InvoiceEditPageProps) {
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
      <div className="max-w-2xl space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Edit Invoice {invoice.invoiceNumber}
          </h1>
          <p className="text-muted-foreground">Update invoice status and details</p>
        </div>
        <InvoiceEditForm invoiceId={id} currentStatus={invoice.status} />
      </div>
    </AppShell>
  );
}
