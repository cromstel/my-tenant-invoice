import { existsSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { companyFacts, companyValues, teamPods } from '@/config/about';

const PUBLIC_DIR = path.join(process.cwd(), 'public');

/** Resolves a site path such as `/team/product-design.png` to a file on disk. */
function resolveAsset(sitePath: string): string {
  return path.join(PUBLIC_DIR, sitePath.replace(/^\//, ''));
}

describe('about page content', () => {
  it('gives every value a stable id and enough copy to be useful', () => {
    expect(companyValues).toHaveLength(4);
    expect(new Set(companyValues.map((value) => value.id)).size).toBe(companyValues.length);

    for (const value of companyValues) {
      expect(value.title.length).toBeGreaterThan(3);
      expect(value.description.length).toBeGreaterThan(80);
      expect(typeof value.icon).not.toBe('undefined');
    }
  });

  it('describes the six teams by function, each with its own portrait', () => {
    expect(teamPods).toHaveLength(6);
    expect(new Set(teamPods.map((pod) => pod.id)).size).toBe(teamPods.length);

    for (const pod of teamPods) {
      expect(pod.image).toBe(`/team/${pod.id}.png`);
      expect(pod.remit.length).toBeGreaterThan(20);
      expect(pod.focus.length).toBeGreaterThanOrEqual(2);
      // Portraits sit beside the pod name, so the image is decorative.
      expect(pod.imageAlt).toBe('');
    }
  });

  it('ships every team portrait it references', () => {
    for (const pod of teamPods) {
      const file = resolveAsset(pod.image);

      expect(existsSync(file), `${pod.image} is missing`).toBe(true);
      expect(statSync(file).size).toBeGreaterThan(1000);
    }
  });

  it('ships every page illustration it references', () => {
    for (const asset of ['/illustrations/about-hero.png', '/illustrations/about-auditor.png']) {
      const file = resolveAsset(asset);

      expect(existsSync(file), `${asset} is missing`).toBe(true);
      expect(statSync(file).size).toBeGreaterThan(5000);
    }
  });

  it('keeps every fact a label with a value', () => {
    expect(companyFacts.length).toBeGreaterThanOrEqual(6);

    for (const fact of companyFacts) {
      expect(fact.label.length).toBeGreaterThan(2);
      expect(fact.value.length).toBeGreaterThan(2);

      if (fact.href) {
        expect(fact.href).toMatch(/^(https:\/\/|mailto:)/);
      }
    }
  });

  it('publishes no certification, headcount or customer-count claims', () => {
    // The About page is public and its copy is not reviewed by anyone who can
    // verify a certification. This guards the module against a future edit
    // that copies language out of the internal docs.
    const copy = JSON.stringify({ companyValues, teamPods, companyFacts }).toLowerCase();

    const banned = [
      'soc 2 type',
      'iso 27001',
      'iso 27701',
      'hipaa',
      'pci dss',
      'certified',
      'headcount',
      'employees',
      'customers worldwide',
    ];

    for (const claim of banned) {
      expect(copy).not.toContain(claim);
    }
  });
});
