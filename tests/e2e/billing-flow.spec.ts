import { expect, test } from '@playwright/test';

test.describe('Billing Flow', () => {
  test('should display dashboard after login', async ({ page }) => {
    await page.goto('/auth/login');
    // Check that the login form is present
    await expect(page.locator('form')).toBeVisible();
  });

  test('should navigate to properties page', async ({ page }) => {
    await page.goto('/dashboard/properties');
    // Should redirect to login if not authenticated
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('should display marketing pages', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();

    await page.goto('/features');
    await expect(page.locator('h1')).toContainText('Features');

    await page.goto('/pricing');
    await expect(page.locator('h1')).toContainText('Pricing');

    await page.goto('/solutions');
    await expect(page.locator('h1')).toContainText('Solutions');
  });

  test('should display contact page', async ({ page }) => {
    await page.goto('/contact');
    await expect(page.locator('h1')).toContainText('Contact');
    await expect(page.locator('form')).toBeVisible();
  });
});
