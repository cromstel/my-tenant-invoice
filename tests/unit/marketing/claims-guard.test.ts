import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Claims guard for the whole marketing surface.
 *
 * The marketing pages are public and their copy is not reviewed by anyone who
 * can verify a certification, an uptime figure, or a feature that is not
 * implemented in the service layer (see the claims policy comment in
 * src/config/services.ts). This reads the raw source of every marketing route
 * and fails if a banned claim is reintroduced.
 */

const MARKETING_DIR = path.join(process.cwd(), 'src', 'app', '(marketing)');

/** Shared marketing copy that is imported into one or more marketing pages. */
const SHARED_COPY = [path.join(process.cwd(), 'src', 'config', 'features.ts')];

const PAGES = [
  'page.tsx',
  'about/page.tsx',
  'services/page.tsx',
  'solutions/page.tsx',
  'pricing/page.tsx',
  'security/page.tsx',
  'blog/page.tsx',
  'contact/page.tsx',
  'privacy/page.tsx',
  'terms/page.tsx',
];

/** Certification-style wording the company cannot back with evidence. */
const BANNED_CERTIFICATIONS = ['soc 2', 'iso 27001', 'iso 27701', 'hipaa', 'pci dss', 'certified'];

/** Features the claims policy says are not shipped. */
const BANNED_UNSHIPPED_FEATURES = [
  'time-of-use',
  'seasonal pricing',
  'seasonal tariff',
  'ai assistant',
  'client portal',
  'tenant portal',
];

/** Measurable commitments with nothing measured behind them. */
const BANNED_UNVERIFIED_COMMITMENTS = [
  'uptime sla',
  'sla guarantee',
  'guaranteed uptime',
  '99.9%',
  'regular security assessments',
];

/** Lowercased full source of a marketing page, for substring matching. */
function readPage(relativePath: string): string {
  return readFileSync(path.join(MARKETING_DIR, relativePath), 'utf8').toLowerCase();
}

function assertNoBannedPhrase(page: string, pagePath: string, banned: string[]): void {
  for (const phrase of banned) {
    expect(page).not.toContain(phrase);
  }

  // Individual assertions give better failure messages; this fallback keeps the
  // guard honest if a list is edited carelessly.
  void pagePath;
}

describe('marketing claims guard', () => {
  const sources = [
    ...PAGES.map((pagePath) => ({ label: pagePath, text: readPage(pagePath) })),
    ...SHARED_COPY.map((filePath) => ({
      label: path.relative(process.cwd(), filePath),
      text: readFileSync(filePath, 'utf8').toLowerCase(),
    })),
  ];

  for (const { label, text } of sources) {
    describe(label, () => {
      it('publishes no certification claims', () => {
        assertNoBannedPhrase(text, label, BANNED_CERTIFICATIONS);
      });

      it('publishes no claims for unshipped features', () => {
        assertNoBannedPhrase(text, label, BANNED_UNSHIPPED_FEATURES);
      });

      it('publishes no unverifiable commitments', () => {
        assertNoBannedPhrase(text, label, BANNED_UNVERIFIED_COMMITMENTS);
      });
    });
  }
});
