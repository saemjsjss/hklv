/**
 * Navigation: get from the entry URL to the open "Study Agency Insert Mode" form.
 *   URL → 지원서작성 → tick 동의함 (필수정보) → 다음 → form
 */
import type { Page } from 'playwright';
import { clickByText } from './browser.js';
import { log } from './log.js';

/** Tick every required-agreement (동의함) checkbox on the consent screen. */
async function agreeRequired(page: Page): Promise<void> {
  const rows = page.locator('tr', { hasText: '필수정보' });
  const n = await rows.count();
  if (n > 0) {
    for (let i = 0; i < n; i++) {
      const box = rows.nth(i).locator('input[type="checkbox"]').first();
      if ((await box.count()) > 0) await box.check().catch(() => {});
    }
    return;
  }
  // Fallback: no 필수정보 row found — tick the first checkbox on the page.
  const box = page.locator('input[type="checkbox"]').first();
  if ((await box.count()) > 0) await box.check().catch(() => {});
}

/** Drive from the entry URL to the open agency form. */
export async function navigateToForm(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);

  if (!(await clickByText(page, '지원서작성'))) log.warn('Could not find 지원서작성 button.');
  await page.waitForTimeout(600);

  await agreeRequired(page);
  if (!(await clickByText(page, '다음'))) log.warn('Could not find 다음 button.');

  // Wait for the agency form to appear (its key required field).
  await page
    .locator('th, td, label')
    .filter({ hasText: /유학원\s*학생\s*이메일/ })
    .first()
    .waitFor({ timeout: 15_000 })
    .catch(() => log.warn('Agency form field (유학원 학생 이메일) did not appear in time.'));
}

/** Click the final submit button. Returns whether it was found. */
export async function submitForm(page: Page, submitText: string): Promise<boolean> {
  return clickByText(page, submitText);
}
