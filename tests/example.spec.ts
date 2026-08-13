import { test, expect } from '@playwright/test';

/**
 * These examples are intentionally self-contained: they load HTML directly into
 * the page with `page.setContent`, so they need no network and run
 * deterministically anywhere (including CI). Swap `setContent` for
 * `page.goto('https://your-app.example')` to test a real site.
 */

test('reads the page title and heading', async ({ page }) => {
  await page.setContent(`
    <!doctype html>
    <html>
      <head><title>hklv playwright demo</title></head>
      <body>
        <h1>Hello Playwright</h1>
      </body>
    </html>
  `);

  await expect(page).toHaveTitle('hklv playwright demo');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hello Playwright');
});

test('interacts with a button and asserts the result', async ({ page }) => {
  await page.setContent(`
    <button id="go">Click me</button>
    <p id="status">idle</p>
    <script>
      document.getElementById('go').addEventListener('click', () => {
        document.getElementById('status').textContent = 'clicked';
      });
    </script>
  `);

  const status = page.locator('#status');
  await expect(status).toHaveText('idle');

  await page.getByRole('button', { name: 'Click me' }).click();
  await expect(status).toHaveText('clicked');
});
