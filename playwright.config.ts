import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  // On CI the 'github' reporter annotates failures inline and the HTML report
  // is written without opening a browser (which would block the runner).
  reporter: process.env.CI
    ? [
        ['github'],
        ['html', { open: 'never' }],
      ]
    : [['html', { open: 'always' }]],
  use: {
    baseURL: 'http://localhost:6161',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:6161',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
