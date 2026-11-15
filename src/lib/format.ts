import type { Metadata } from 'next';

/**
 * Coerces a database value (number, string, or Prisma Decimal) to a number.
 * Returns null for anything that is not representable, so formatters can
 * fall back to a stable default instead of throwing during render.
 */
function toNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  return isNaN(num) ? null : num;
}

/**
 * Format a number as USD currency with exactly 2 decimal places.
 * Always uses en-US locale for consistent server/client rendering.
 */
export function usd(amount: unknown): string {
  const num = toNumber(amount);
  if (num == null) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Format a date consistently with en-US locale (MM/DD/YYYY).
 * Avoids locale-dependent hydration mismatches.
 */
export function fmtDate(date: Date | string | null | undefined): string {
  if (date == null) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format a date with time (HH:MM) consistently.
 */
export function fmtDateTime(date: Date | string | null | undefined): string {
  if (date == null) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format an occupancy rate as percentage with 1 decimal.
 */
export function fmtOccupancy(rate: unknown): string {
  const num = toNumber(rate);
  if (num == null) return '0.0%';
  return `${num.toFixed(1)}%`;
}

/**
 * Format a count or number with en-US thousands separator.
 * Always renders consistently regardless of server/client locale.
 */
export function fmtCount(num: unknown): string {
  const n = toNumber(num);
  if (n == null) return '0';
  return new Intl.NumberFormat('en-US').format(n);
}

/**
 * Render 44px touch-target minimum height class.
 * Use min-h-11 on link/button elements to meet WCAG 2.2 AA touch target requirements.
 */
export const TOUCH_TARGET_CLASS = 'min-h-11 min-w-11';

/**
 * Creates a consistent metadata object for Next.js pages.
 * Ensures all pages have proper Open Graph and Twitter card data.
 */
export function createMetadata(title: string, description?: string): Metadata {
  return {
    title,
    description: description ?? '',
    openGraph: {
      title,
      description: description ?? '',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: description ?? '',
    },
  };
}
