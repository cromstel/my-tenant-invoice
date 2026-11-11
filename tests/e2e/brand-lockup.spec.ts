import { expect, test } from '@playwright/test';

const PHONE = { width: 375, height: 667 };
const DESKTOP = { width: 1024, height: 800 };

test.describe('brand lockup', () => {
  test('shows the logo beside the product name in the header', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/');

    const home = page.locator('header a[href="/"]');
    const mark = home.locator('svg');
    const name = home.getByText('myTenant Invoice', { exact: true }).last();

    await expect(mark).toBeVisible();
    await expect(name).toBeVisible();

    const markBox = await mark.boundingBox();
    const nameBox = await name.boundingBox();

    expect(markBox).not.toBeNull();
    expect(nameBox).not.toBeNull();
    // The mark sits to the left of the name, not after it.
    expect(markBox!.x + markBox!.width).toBeLessThanOrEqual(nameBox!.x);
  });

  test('leaves the header link named after the product', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/');

    const home = page.locator('header a[href="/"]');

    await expect(home).toHaveAccessibleName('myTenant Invoice');
    await expect(home.locator('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  test('scales the logo with the viewport', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/');

    const phone = await page.locator('header a[href="/"] svg').boundingBox();

    await page.setViewportSize(DESKTOP);
    const desktop = await page.locator('header a[href="/"] svg').boundingBox();

    expect(phone!.width).toBeCloseTo(28, 1);
    expect(desktop!.width).toBeCloseTo(32, 1);
  });

  test('shows the logo in the footer', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/');

    const footerMark = page.locator('footer svg');

    await expect(footerMark).toBeVisible();
    expect((await footerMark.boundingBox())!.width).toBeCloseTo(24, 1);
  });
});
