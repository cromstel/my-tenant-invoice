import { expect, type Page, test } from '@playwright/test';

const GOOGLE_FONT_HOSTS = /fonts\.googleapis\.com|fonts\.gstatic\.com/;

/** Records every request to a Google font host made while the page loads. */
function trackGoogleFonts(page: Page): string[] {
  const hits: string[] = [];

  page.on('request', (request) => {
    if (GOOGLE_FONT_HOSTS.test(request.url())) {
      hits.push(request.url());
    }
  });

  return hits;
}

test.describe('self-hosted fonts', () => {
  test('renders the sans font without contacting Google', async ({ page }) => {
    const googleHits = trackGoogleFonts(page);

    await page.goto('/services', { waitUntil: 'networkidle' });

    const state = await page.evaluate(async () => {
      await document.fonts.ready;

      const loaded: Array<{ family: string; weight: string }> = [];
      document.fonts.forEach((face) => {
        if (face.status === 'loaded') {
          loaded.push({ family: face.family, weight: face.weight });
        }
      });

      const localWoff2 = performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .filter((name) => name.includes('/_next/static/media/') && name.endsWith('.woff2'));

      return {
        loaded,
        localWoff2,
        bodyFont: getComputedStyle(document.body).fontFamily,
      };
    });

    expect(googleHits).toEqual([]);
    expect(state.localWoff2.length).toBeGreaterThan(0);
    // Inter is a variable font covering 100 to 900 in a single file.
    expect(state.loaded.map((face) => face.weight)).toContain('100 900');
    expect(state.bodyFont).not.toBe('');
  });

  test('renders the mono font without contacting Google', async ({ page }) => {
    const googleHits = trackGoogleFonts(page);

    await page.goto('/auth/error?error=Configuration', { waitUntil: 'networkidle' });

    const state = await page.evaluate(async () => {
      await document.fonts.ready;

      const loaded: Array<{ family: string; weight: string }> = [];
      document.fonts.forEach((face) => {
        if (face.status === 'loaded') {
          loaded.push({ family: face.family, weight: face.weight });
        }
      });

      const mono = document.querySelector('.font-mono');

      return {
        loaded,
        monoFont: mono ? getComputedStyle(mono).fontFamily : null,
      };
    });

    expect(googleHits).toEqual([]);
    // JetBrains Mono is a variable font covering 100 to 800 in a single file.
    expect(state.loaded.map((face) => face.weight)).toContain('100 800');
    expect(state.monoFont).toContain('monospace');
  });
});
