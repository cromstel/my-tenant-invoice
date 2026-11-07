'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PropertyEditFormProps {
  propertyId: string;
  currentName: string;
  currentAddress: string;
  currentType: string;
}

export function PropertyEditForm({
  propertyId,
  currentName,
  currentAddress,
  currentType,
}: PropertyEditFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm({
    defaultValues: {
      name: currentName,
      address: currentAddress,
      propertyType: currentType,
    },
  });

  const onSubmit = async (data: { name: string; address: string; propertyType: string }) => {
    setIsSubmitting(true);
    try {
      await fetch(`/api/v1/properties/${propertyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      router.refresh();
      router.push(`/dashboard/properties/${propertyId}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-2xl space-y-4">
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" {...form.register('name')} />
      </div>
      <div>
        <Label htmlFor="address">Address</Label>
        <Input id="address" {...form.register('address')} />
      </div>
      <div>
        <Label htmlFor="propertyType">Type</Label>
        <select
          id="propertyType"
          {...form.register('propertyType')}
          className="w-full rounded-md border px-3 py-2 text-sm"
        >
          <option value="RESIDENTIAL">Residential</option>
          <option value="COMMERCIAL">Commercial</option>
          <option value="OFFICE">Office</option>
          <option value="RETAIL">Retail</option>
          <option value="INDUSTRIAL">Industrial</option>
          <option value="MIXED_USE">Mixed Use</option>
        </select>
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving...' : 'Update Property'}
      </Button>
    </form>
  );
}
