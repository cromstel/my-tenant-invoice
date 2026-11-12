import { expect, type Page, test } from '@playwright/test';

const PHONE = { width: 375, height: 667 };
const OVERFLOW_WIDTHS = [320, 375, 768, 1024, 1440] as const;

const TEAM_NAMES = [
  'Platform Engineering',
  'Product & Design',
  'Security & Compliance',
  'Billing Engineering',
  'Integrations & API',
  'Customer Success',
] as const;

/**
 * Scrolls the whole page so that the lazily loaded portraits are requested,
 * then waits until every image in the document has decoded.
 */
async function loadAllImages(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const step = window.innerHeight;

    for (let offset = 0; offset < document.body.scrollHeight; offset += step) {
      window.scrollTo(0, offset);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }

    window.scrollTo(0, 0);
  });

  await page.waitForFunction(() => {
    const images = Array.from(document.querySelectorAll('main img'));

    return (
      images.length > 0 &&
      images.every((image) => {
        const element = image as HTMLImageElement;

        return element.complete && element.naturalWidth > 0;
      })
    );
  });
}

test.describe('about page', () => {
  test('leads with a single page heading', async ({ page }) => {
    await page.goto('/about');

    await expect(page.locator('h1')).toHaveCount(1);
  });

  test('covers the story, mission, values, team and company facts', async ({ page }) => {
    await page.goto('/about');

    for (const heading of [
      'The platform in numbers',
      'Billing that survives an audit',
      'Our mission',
      'What we hold the product to',
      'The teams behind the platform',
      'At a glance',
    ]) {
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    }
  });

  test('shows four platform numbers taken from source', async ({ page }) => {
    await page.goto('/about');

    const stats = page.locator('section[aria-labelledby="about-stats-heading"] dt');

    await expect(stats).toHaveCount(4);
  });

  test('presents one card and one portrait per team', async ({ page }) => {
    await page.goto('/about');

    for (const name of TEAM_NAMES) {
      await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    }

    await expect(page.locator('#team img')).toHaveCount(TEAM_NAMES.length);
  });

  test('loads every image', async ({ page }) => {
    await page.goto('/about');
    await loadAllImages(page);

    const images = page.locator('main img');
    const count = await images.count();

    expect(count).toBe(TEAM_NAMES.length + 1);

    for (let index = 0; index < count; index += 1) {
      const width = await images
        .nth(index)
        .evaluate((image) => (image as HTMLImageElement).naturalWidth);

      expect(width).toBeGreaterThan(0);
    }
  });

  test('describes the hero and treats the portraits as decorative', async ({ page }) => {
    await page.goto('/about');

    const heroAlt = await page.locator('main img').first().getAttribute('alt');
    expect(heroAlt?.trim().length ?? 0).toBeGreaterThan(20);

    const portraits = page.locator('#team img');
    const count = await portraits.count();

    for (let index = 0; index < count; index += 1) {
      // The pod name sits beside the portrait, so repeating it in alt text
      // would make a screen reader announce the same words twice.
      await expect(portraits.nth(index)).toHaveAttribute('alt', '');
    }
  });

  test('declares a canonical url and a page title', async ({ page }) => {
    await page.goto('/about');

    await expect(page).toHaveTitle(/About · myTenant Invoice/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/about$/);
  });

  test('gives standalone controls a touch-sized target', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/about');

    const controls = await page.evaluate(() =>
      Array.from(document.querySelectorAll('main a, main button'))
        // A link inside a sentence is inline by design, and WCAG exempts it.
        // Everything else has to be comfortable to tap.
        .filter((element) => !element.closest('p'))
        .map((element) => ({
          text: element.textContent?.trim().slice(0, 40) ?? '',
          height: Math.round(element.getBoundingClientRect().height),
        })),
    );

    expect(controls.length).toBeGreaterThan(0);

    for (const control of controls) {
      expect(
        control.height,
        `"${control.text}" is only ${control.height}px tall`,
      ).toBeGreaterThanOrEqual(44);
    }
  });

  test('is listed in the sitemap', async ({ page }) => {
    await page.goto('/sitemap.xml');

    await expect(page.locator('body')).toContainText('/about');
  });
});

test.describe('about page layout', () => {
  for (const width of OVERFLOW_WIDTHS) {
    test(`has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/about');

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );

      expect(overflow).toBe(0);
    });
  }
});
