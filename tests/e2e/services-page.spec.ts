import { expect, type Page, test } from '@playwright/test';

const PHONE = { width: 375, height: 667 };
const OVERFLOW_WIDTHS = [320, 375, 768, 1024, 1440] as const;

const SERVICE_TITLES = [
  'Property & Portfolio Management',
  'Lease Management',
  'Meter & Consumption Billing',
  'Tariff & Rating Engine',
  'Invoicing & Recurring Billing',
  'Payments, Reconciliation & Collections',
] as const;

/**
 * Scrolls the whole page so that the lazily loaded illustrations are
 * requested, then waits until every one of them has decoded.
 */
async function loadAllIllustrations(page: Page): Promise<void> {
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

test.describe('services page', () => {
  test('leads with a single page heading', async ({ page }) => {
    await page.goto('/services');

    await expect(page.locator('h1')).toHaveCount(1);
  });

  test('presents every service line', async ({ page }) => {
    await page.goto('/services');

    for (const title of SERVICE_TITLES) {
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    }
  });

  test('shows one illustration for the hero and one per service line', async ({ page }) => {
    await page.goto('/services');

    await expect(page.locator('main img')).toHaveCount(7);
  });

  test('loads every illustration', async ({ page }) => {
    await page.goto('/services');
    await loadAllIllustrations(page);

    const images = page.locator('main img');
    const count = await images.count();

    for (let index = 0; index < count; index += 1) {
      const width = await images
        .nth(index)
        .evaluate((image) => (image as HTMLImageElement).naturalWidth);

      expect(width).toBeGreaterThan(0);
    }
  });

  test('describes every illustration', async ({ page }) => {
    await page.goto('/services');

    const images = page.locator('main img');
    const count = await images.count();

    for (let index = 0; index < count; index += 1) {
      const alt = await images.nth(index).getAttribute('alt');

      expect(alt?.trim().length ?? 0).toBeGreaterThan(10);
    }
  });

  test('is reachable from the header', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/');

    await page.getByRole('button', { name: 'Main menu' }).click();
    await page.getByRole('dialog').getByRole('link', { name: 'Services' }).click();

    await expect(page).toHaveURL(/\/services$/);
  });

  test('is listed in the sitemap', async ({ page }) => {
    await page.goto('/sitemap.xml');

    await expect(page.locator('body')).toContainText('/services');
  });
});

test.describe('services page layout', () => {
  for (const width of OVERFLOW_WIDTHS) {
    test(`has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/services');

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );

      expect(overflow).toBe(0);
    });
  }
});
