import Decimal from 'decimal.js';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

export const money = {
  /** Adds two money values. */
  add(a: Decimal.Value, b: Decimal.Value): Decimal {
    return new Decimal(a).plus(b);
  },
  /** Subtracts b from a. */
  subtract(a: Decimal.Value, b: Decimal.Value): Decimal {
    return new Decimal(a).minus(b);
  },
  /** Multiplies two money values. */
  multiply(a: Decimal.Value, b: Decimal.Value): Decimal {
    return new Decimal(a).times(b);
  },
  /** Divides a by b. */
  divide(a: Decimal.Value, b: Decimal.Value): Decimal {
    return new Decimal(a).dividedBy(b);
  },
  /** Rounds to 2 decimal places (cents). */
  toCents(value: Decimal.Value): number {
    return new Decimal(value).times(100).round().toNumber();
  },
  /** Converts cents to a Decimal. */
  fromCents(cents: number): Decimal {
    return new Decimal(cents).dividedBy(100);
  },
  /** Formats a money value as a localized currency string. */
  format(value: Decimal.Value, currency = 'USD', locale = 'en-US'): string {
    const num = new Decimal(value).toNumber();
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(num);
  },
  /** Returns true if the value is zero. */
  isZero(value: Decimal.Value): boolean {
    return new Decimal(value).isZero();
  },
  /** Returns true if a is greater than b. */
  greaterThan(a: Decimal.Value, b: Decimal.Value): boolean {
    return new Decimal(a).gt(b);
  },
  /** Returns true if a is less than b. */
  lessThan(a: Decimal.Value, b: Decimal.Value): boolean {
    return new Decimal(a).lt(b);
  },
};

export type Money = Decimal;
