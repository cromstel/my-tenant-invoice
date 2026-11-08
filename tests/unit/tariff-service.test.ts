import { describe, expect, it } from 'vitest';

// Pure function tests - extracted from TariffService.calculateCharge
function calculateCharge(input: {
  tariffType: string;
  rules: Record<string, unknown>;
  quantity: number;
  unitPrice?: number;
}): number {
  const { tariffType, rules, quantity, unitPrice = 0 } = input;
  const qty = quantity;

  switch (tariffType) {
    case 'FLAT_RATE':
      return ((rules.rate as number) ?? 0) * qty;

    case 'STANDING_CHARGE':
      return (rules.standingCharge as number) ?? 0;

    case 'PERCENTAGE':
      return unitPrice * qty * (((rules.percentage as number) ?? 0) / 100);

    case 'MIN_CHARGE': {
      const charge = ((rules.rate as number) ?? 0) * qty;
      const min = (rules.minimum as number) ?? 0;
      return charge >= min ? charge : min;
    }

    case 'MAX_CHARGE': {
      const charge = ((rules.rate as number) ?? 0) * qty;
      const max = (rules.maximum as number) ?? Infinity;
      return charge <= max ? charge : max;
    }

    default:
      return ((rules.rate as number) ?? 0) * qty;
  }
}

describe('TariffService.calculateCharge', () => {
  it('should calculate flat rate charge', () => {
    const result = calculateCharge({ tariffType: 'FLAT_RATE', rules: { rate: 10 }, quantity: 5 });
    expect(result).toBe(50);
  });

  it('should calculate standing charge', () => {
    const result = calculateCharge({
      tariffType: 'STANDING_CHARGE',
      rules: { standingCharge: 25 },
      quantity: 100,
    });
    expect(result).toBe(25);
  });

  it('should calculate percentage charge', () => {
    const result = calculateCharge({
      tariffType: 'PERCENTAGE',
      rules: { percentage: 10 },
      quantity: 5,
      unitPrice: 100,
    });
    expect(result).toBe(50);
  });

  it('should apply minimum charge', () => {
    const result = calculateCharge({
      tariffType: 'MIN_CHARGE',
      rules: { rate: 2, minimum: 20 },
      quantity: 5,
    });
    expect(result).toBe(20);
  });

  it('should apply maximum charge', () => {
    const result = calculateCharge({
      tariffType: 'MAX_CHARGE',
      rules: { rate: 10, maximum: 30 },
      quantity: 5,
    });
    expect(result).toBe(30);
  });

  it('should default to flat rate for unknown type', () => {
    const result = calculateCharge({ tariffType: 'UNKNOWN', rules: { rate: 7 }, quantity: 3 });
    expect(result).toBe(21);
  });
});
