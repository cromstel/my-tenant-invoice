import { describe, expect, it } from 'vitest';

// Pure function extracted from MeterService.detectAnomaly
function detectAnomaly(
  meter: { openingReading: number; latestReading: number },
  newReading: number,
): boolean {
  const latest = meter.latestReading;
  const newR = newReading;
  if (newR < 0) return true;
  if (newR < latest) return true;
  const consumption = newR - latest;
  const prevConsumption = latest - (meter.openingReading ?? 0);
  if (prevConsumption > 0 && consumption > prevConsumption * 10) return true;
  return false;
}

describe('MeterService.detectAnomaly', () => {
  it('should detect negative reading', () => {
    expect(detectAnomaly({ openingReading: 0, latestReading: 100 }, -5)).toBe(true);
  });

  it('should detect decreased reading', () => {
    expect(detectAnomaly({ openingReading: 0, latestReading: 100 }, 50)).toBe(true);
  });

  it('should detect consumption spike', () => {
    expect(detectAnomaly({ openingReading: 0, latestReading: 100 }, 1101)).toBe(true);
  });

  it('should not flag normal reading', () => {
    expect(detectAnomaly({ openingReading: 0, latestReading: 100 }, 150)).toBe(false);
  });

  it('should not flag same reading', () => {
    expect(detectAnomaly({ openingReading: 0, latestReading: 100 }, 100)).toBe(false);
  });
});
