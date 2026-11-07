import Decimal from 'decimal.js';
import { z } from 'zod';

/**
 * Money is always stored as a non-negative Decimal with up to 4 decimal places.
 * Use integer cents for API transport when possible.
 */
export const MoneySchema = z
  .union([z.string(), z.number(), z.instanceof(Decimal)])
  .transform((val) => new Decimal(val))
  .refine((d) => d.gte(0), 'Amount must be non-negative')
  .refine((d) => d.decimalPlaces() <= 4, 'Amount must have at most 4 decimal places');
export type MoneyInput = z.input<typeof MoneySchema>;

export const CentsSchema = z.number().int().nonnegative('Cents must be a non-negative integer');
export type Cents = z.infer<typeof CentsSchema>;

export function centsToDecimal(cents: number): Decimal {
  return new Decimal(cents).dividedBy(100);
}

export function decimalToCents(value: Decimal | number | string): number {
  return new Decimal(value).times(100).round().toNumber();
}
