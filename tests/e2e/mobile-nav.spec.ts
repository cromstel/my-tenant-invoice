import { expect, test } from '@playwright/test';

const PHONE = { width: 375, height: 667 };
const DESKTOP = { width: 1024, height: 800 };

const OVERFLOW_WIDTHS = [320, 375, 768, 1024, 1440] as const;

const DRAWER_LINK_LABELS = [
  'Features',
  'Services',
  'Pricing',
  'Security',
  'About',
  'Contact',
  'Log in',
  'Get Started',
] as const;

test.describe('marketing header on a phone', () => {
  test('shows the menu button instead of the inline navigation', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/');

    await expect(page.getByRole('button', { name: 'Main menu' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden();
  });

  test('opens a drawer containing every navigation link', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/');

    await page.getByRole('button', { name: 'Main menu' }).click();

    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();

    for (const label of DRAWER_LINK_LABELS) {
      await expect(drawer.getByRole('link', { name: label })).toBeVisible();
    }
  });

  test('names the drawer for assistive technology', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/');

    await page.getByRole('button', { name: 'Main menu' }).click();

    await expect(page.getByRole('dialog')).toHaveAccessibleName('myTenant Invoice');
  });

  test('does not add a heading level inside the drawer', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/');

    await page.getByRole('button', { name: 'Main menu' }).click();

    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();

    await expect(drawer.locator('h1, h2, h3, h4, h5, h6')).toHaveCount(0);
  });

  test('gives every drawer control a 44px touch target', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/');

    await page.getByRole('button', { name: 'Main menu' }).click();

    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();

    const controls = [
      drawer.getByRole('button', { name: 'Close menu' }),
      ...DRAWER_LINK_LABELS.map((label) => drawer.getByRole('link', { name: label })),
    ];

    for (const control of controls) {
      await expect(control).toHaveCSS('height', '44px');
    }
  });

  test('closes the drawer on Escape and returns focus to the trigger', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/');

    const trigger = page.getByRole('button', { name: 'Main menu' });
    await trigger.click();

    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toBeFocused();
  });

  test('navigates to the destination chosen in the drawer', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/');

    await page.getByRole('button', { name: 'Main menu' }).click();

    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();

    await drawer.getByRole('link', { name: 'Features' }).click();

    await expect(page).toHaveURL(/\/features$/);
  });
});

test.describe('marketing header on a desktop', () => {
  test('shows the inline navigation and hides the menu button', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/');

    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Main menu' })).toBeHidden();
  });
});

test.describe('marketing header layout', () => {
  for (const width of OVERFLOW_WIDTHS) {
    test(`has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );

      expect(overflow).toBe(0);
    });
  }
});
