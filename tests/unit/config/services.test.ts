import { describe, expect, it } from 'vitest';

import { platformPrinciples, platformStats, serviceLines } from '@/config/services';

describe('service catalogue', () => {
  it('covers six service lines', () => {
    expect(serviceLines).toHaveLength(6);
  });

  it('gives every service line a unique id', () => {
    const ids = serviceLines.map((service) => service.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('describes every service line', () => {
    for (const service of serviceLines) {
      expect(service.title.length).toBeGreaterThan(0);
      expect(service.summary.length).toBeGreaterThan(0);
      expect(service.capabilities.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('points every service line at a raster illustration', () => {
    for (const service of serviceLines) {
      expect(service.image).toMatch(/^\/illustrations\/services-[a-z-]+\.png$/);
    }
  });

  it('describes every illustration for assistive technology', () => {
    for (const service of serviceLines) {
      expect(service.imageAlt.trim().length).toBeGreaterThan(10);
    }
  });

  it('reports platform counts as plain numbers', () => {
    expect(platformStats).toHaveLength(4);

    for (const stat of platformStats) {
      expect(stat.value).toMatch(/^\d+$/);
      expect(stat.label.length).toBeGreaterThan(0);
      expect(stat.detail.length).toBeGreaterThan(0);
    }
  });

  it('states the platform guarantees', () => {
    expect(platformPrinciples).toHaveLength(4);

    for (const principle of platformPrinciples) {
      expect(principle.title.length).toBeGreaterThan(0);
      expect(principle.description.length).toBeGreaterThan(0);
    }
  });
});
