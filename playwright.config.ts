import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration.
 *
 * The browser binaries are managed by Playwright itself. In this repo's
 * dev container they are pre-installed; on a fresh machine run:
 *
 *   npx playwright install --with-deps chromium
 *
 * See https://playwright.dev/docs/test-configuration for all options.
 */
export default defineConfig({
  testDir: './tests',
  // Run every test file in parallel.
  fullyParallel: true,
  // Fail the build on CI if you accidentally left test.only in the source.
  forbidOnly: !!process.env.CI,
  // Retry failing tests on CI only.
  retries: process.env.CI ? 2 : 0,
  // Opt out of parallel workers on CI for more stable runs.
  workers: process.env.CI ? 1 : undefined,
  // HTML report; open it with `npm run pw:report`.
  reporter: 'html',
  use: {
    // Collect a trace when retrying a failed test.
    trace: 'on-first-retry',
    // Capture a screenshot only when a test fails.
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Add more browsers by installing them first, e.g.
    //   npx playwright install firefox webkit
    // and uncommenting:
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
