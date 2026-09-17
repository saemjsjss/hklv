/**
 * Playwright browser layer with **label-based** locators.
 *
 * The Hanyang form is a table of `<label> | <control>` rows. Rather than depend
 * on generated ids/names (this is a SPA, so they are unstable), we locate the
 * row by its exact Korean label text and then reach for the control inside it.
 * When we later have the real page HTML, only the few tricky rows need a pinned
 * override — the bulk keeps working.
 */
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from 'playwright';
import { log } from './log.js';

const CTRL: Record<string, string> = {
  text: 'input[type="text"], input[type="email"], input[type="tel"], input[type="number"], input[type="password"], input:not([type]), textarea',
  date: 'input[type="date"], input[type="text"], input:not([type])',
  select: 'select',
  checkbox: 'input[type="checkbox"]',
  radio: 'input[type="radio"]',
  file: 'input[type="file"]',
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export interface Launched {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

export async function launch(opts: {
  channel: string;
  headless: boolean;
  slowMo: number;
}): Promise<Launched> {
  const base = {
    headless: opts.headless,
    slowMo: opts.slowMo,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  };
  let browser: Browser;
  try {
    browser = await chromium.launch(opts.channel ? { ...base, channel: opts.channel } : base);
  } catch (err) {
    if (opts.channel) {
      log.warn(`Chrome channel "${opts.channel}" not available, falling back to bundled Chromium.`);
      browser = await chromium.launch(base);
    } else {
      throw err;
    }
  }
  const context = await browser.newContext({ acceptDownloads: false });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  return { browser, context, page };
}

/**
 * The nearest form row for an exact label: the closest `<tr>`, else the label's
 * parent. `occurrence` selects among rows that share a label (e.g. "E-mail"
 * appears under both General and Agent; "Name" under Personal and Emergency).
 */
export async function rowFor(page: Page, label: string, occurrence = 0): Promise<Locator> {
  const re = new RegExp(`^\\s*${escapeRe(label)}\\s*$`);
  const cell = page.locator('th, td, label, dt').filter({ hasText: re }).nth(occurrence);
  const tr = cell.locator('xpath=ancestor-or-self::tr[1]');
  if ((await tr.count()) > 0) return tr.first();
  return cell.locator('xpath=..'); // div/li layout fallback
}

/** The i-th control of a kind inside a row (visible ones only, unless file). */
export async function control(
  page: Page,
  label: string,
  kind: keyof typeof CTRL,
  index = 0,
  occurrence = 0,
): Promise<Locator | undefined> {
  const row = await rowFor(page, label, occurrence);
  if ((await row.count()) === 0) return undefined;
  const all = row.locator(CTRL[kind]);
  const n = await all.count();
  const wantVisible = kind !== 'file';
  const hits: Locator[] = [];
  for (let i = 0; i < n; i++) {
    const el = all.nth(i);
    if (!wantVisible || (await el.isVisible().catch(() => false))) hits.push(el);
  }
  // Fallback: some controls are hidden (custom-styled). Use them anyway.
  if (hits.length === 0) for (let i = 0; i < n; i++) hits.push(all.nth(i));
  return hits[index];
}

/**
 * Choose a <select> option by visible label, then value, then fuzzy contains.
 * Options are inspected first (fast) so a missing value fails immediately rather
 * than waiting out selectOption's action timeout.
 */
export async function selectByText(loc: Locator, value: string): Promise<boolean> {
  const opts = await loc.locator('option').all();
  const read = await Promise.all(
    opts.map(async (o) => ({
      text: (await o.textContent())?.trim() ?? '',
      value: (await o.getAttribute('value')) ?? '',
    })),
  );
  const pick = async (o: { text: string; value: string }) => {
    // Native selectOption when the control is visible; otherwise (hidden/custom) set it in the DOM.
    if (await loc.isVisible().catch(() => false)) {
      try {
        await loc.selectOption(o.value ? o.value : { label: o.text }, { timeout: 4000 });
        return true;
      } catch {
        /* fall through to DOM set */
      }
    }
    {
      await loc.evaluate((el, wanted) => {
        const sel = el as HTMLSelectElement;
        const opt = Array.from(sel.options).find(
          (x) => (x.textContent || '').trim() === wanted || x.value === wanted,
        );
        if (opt) {
          sel.value = opt.value || (opt.textContent || '').trim();
          sel.dispatchEvent(new Event('input', { bubbles: true }));
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, o.value || o.text);
    }
    return true;
  };
  for (const o of read) if (o.text === value) return pick(o);
  for (const o of read) if (o.value === value) return pick(o);
  for (const o of read) if (o.text && (o.text.includes(value) || value.includes(o.text))) return pick(o);
  return false;
}

/** Tick a checkbox/radio, even when it is hidden behind custom styling. */
export async function setChecked(loc: Locator): Promise<void> {
  if (await loc.isVisible().catch(() => false)) {
    try {
      await loc.check();
      return;
    } catch {
      /* fall through to DOM set */
    }
  }
  await loc.evaluate((el) => {
    const c = el as HTMLInputElement;
    if (!c.checked) {
      c.checked = true;
      c.dispatchEvent(new Event('input', { bubbles: true }));
      c.dispatchEvent(new Event('change', { bubbles: true }));
      c.dispatchEvent(new Event('click', { bubbles: true }));
    }
  });
}

/** Click a button/link/submit whose visible text (or value) matches. */
export async function clickByText(page: Page, text: string): Promise<boolean> {
  const re = new RegExp(escapeRe(text), 'i');
  const candidates = [
    page.getByRole('button', { name: re }),
    page.getByRole('link', { name: re }),
    page.locator(`input[type="submit"][value*="${text}" i], input[type="button"][value*="${text}" i], button`).filter({ hasText: re }),
    page.getByText(re),
  ];
  for (const c of candidates) {
    if ((await c.count()) > 0) {
      await c.first().click();
      return true;
    }
  }
  return false;
}
