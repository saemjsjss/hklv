/**
 * Navigation: from the entry URL to the open English "Study Agency Insert Mode".
 *   URL → English → Application → tick Agree (Required information) → Next → form
 * Korean fallbacks are tried too, so it works whichever language loads first.
 */
import type { Page } from 'playwright';
import { clickByText } from './browser.js';
import { log } from './log.js';

async function clickFirst(page: Page, locs: ReturnType<Page['getByRole']>[]): Promise<boolean> {
  for (const loc of locs) {
    if ((await loc.count()) > 0) {
      await loc.first().click().catch(() => {});
      return true;
    }
  }
  return false;
}

/** Switch the portal to English (no-op if already English). */
async function switchToEnglish(page: Page): Promise<void> {
  await clickFirst(page, [
    page.getByRole('link', { name: 'English', exact: true }),
    page.getByText('English', { exact: true }),
  ]);
  await page.waitForTimeout(700);
}

/** Open the application form: the "Application" nav (not "Application Status"/"Edit"). */
async function openApplication(page: Page): Promise<void> {
  const clicked = await clickFirst(page, [
    page.getByRole('button', { name: 'Application', exact: true }),
    page.getByRole('link', { name: 'Application', exact: true }),
    page.getByText('Application', { exact: true }),
  ]);
  if (!clicked && !(await clickByText(page, '지원서작성'))) log.warn('Could not find the Application button.');
  await page.waitForTimeout(700);
}

/** Tick every required-agreement checkbox on the consent screen. */
async function agreeRequired(page: Page): Promise<void> {
  for (const key of ['Required information', '필수정보']) {
    const rows = page.locator('tr', { hasText: key });
    const n = await rows.count();
    if (n > 0) {
      for (let i = 0; i < n; i++) {
        const box = rows.nth(i).locator('input[type="checkbox"]').first();
        if ((await box.count()) > 0) await box.check().catch(() => {});
      }
      return;
    }
  }
  const box = page.locator('input[type="checkbox"]').first();
  if ((await box.count()) > 0) await box.check().catch(() => {});
}

/** Drive from the entry URL to the open agency form. */
export async function navigateToForm(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);

  await switchToEnglish(page);
  await openApplication(page);

  await agreeRequired(page);
  if (!(await clickByText(page, 'Next'))) await clickByText(page, '다음');

  await page
    .locator('th, td, label')
    .filter({ hasText: /student email address/i })
    .first()
    .waitFor({ timeout: 15_000 })
    .catch(() => log.warn('Agency form field (student email address) did not appear in time.'));
}

/** Click the final submit button. */
export async function submitForm(page: Page, submitText: string): Promise<boolean> {
  return clickByText(page, submitText);
}
