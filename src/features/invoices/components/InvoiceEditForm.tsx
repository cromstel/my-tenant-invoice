'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface InvoiceEditFormProps {
  invoiceId: string;
  currentStatus: string;
}

export function InvoiceEditForm({ invoiceId, currentStatus }: InvoiceEditFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm({
    defaultValues: {
      status: currentStatus,
    },
  });

  const onSubmit = async (data: { status: string }) => {
    setIsSubmitting(true);
    try {
      await fetch(`/api/v1/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="status">Status</Label>
        <select
          id="status"
          {...form.register('status')}
          className="w-full rounded-md border px-3 py-2 text-sm"
        >
          <option value="DRAFT">Draft</option>
          <option value="PENDING_APPROVAL">Pending Approval</option>
          <option value="APPROVED">Approved</option>
          <option value="SENT">Sent</option>
          <option value="VOID">Void</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving...' : 'Update Status'}
      </Button>
    </form>
  );
}
