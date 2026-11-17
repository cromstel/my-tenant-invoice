import { describe, expect, it } from 'vitest';

import { safeRedirectPath } from '@/lib/safe-redirect';

describe('safeRedirectPath', () => {
  it.each([
    ['https://evil.com'],
    ['//evil.com'],
    ['/\\evil.com'],
    ['javascript:alert(1)'],
    [' /dashboard'],
  ])('rejects unsafe value "%s"', (raw) => {
    expect(safeRedirectPath(raw, '/dashboard')).toBe('/dashboard');
  });

  it('rejects missing or empty values', () => {
    expect(safeRedirectPath(null, '/dashboard')).toBe('/dashboard');
    expect(safeRedirectPath(undefined, '/dashboard')).toBe('/dashboard');
    expect(safeRedirectPath('', '/dashboard')).toBe('/dashboard');
  });

  it.each([['/dashboard'], ['/platform?tab=users'], ['/'], ['/dashboard/invoices/abc-123']])(
    'accepts relative path "%s"',
    (raw) => {
      expect(safeRedirectPath(raw, '/fallback')).toBe(raw);
    },
  );
});
