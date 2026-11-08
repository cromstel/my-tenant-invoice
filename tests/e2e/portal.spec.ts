import { expect, test } from '@playwright/test';

test.describe('Client Portal', () => {
  test('should display portal page', async ({ page }) => {
    await page.goto('/portal');
    // Should redirect to login if not authenticated
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('should display platform page', async ({ page }) => {
    await page.goto('/platform');
    // Should redirect to login if not authenticated
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
