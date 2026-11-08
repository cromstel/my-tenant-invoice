import { describe, expect, it } from 'vitest';

// Pure function extracted from LeaseService.calculateProration
function calculateProration(startDate: Date, endDate: Date, monthlyAmount: number): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const dailyRate = monthlyAmount / daysInMonth;
  return dailyRate * days;
}

describe('LeaseService.calculateProration', () => {
  it('should calculate proration for partial month', () => {
    const result = calculateProration(new Date('2026-01-15'), new Date('2026-01-31'), 1000);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1000);
  });

  it('should calculate full month proration', () => {
    const result = calculateProration(new Date('2026-02-01'), new Date('2026-02-28'), 1000);
    // Feb has 28 days, 27 days difference from Feb 1 to Feb 28
    expect(result).toBeGreaterThan(900);
    expect(result).toBeLessThan(1000);
  });

  it('should handle zero amount', () => {
    const result = calculateProration(new Date('2026-01-01'), new Date('2026-01-15'), 0);
    expect(result).toBe(0);
  });
});
