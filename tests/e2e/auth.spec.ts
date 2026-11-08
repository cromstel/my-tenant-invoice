import { expect, test } from '@playwright/test';

test.describe('Authentication', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.locator('h1, h2')).toContainText(/login|sign in/i);
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('should display signup page', async ({ page }) => {
    await page.goto('/auth/signup');
    await expect(page.locator('h1, h2')).toContainText(/sign up|register|create/i);
  });
});
