/**
 * Live-form probe — no spreadsheet, no submit. Opens the real agency form and
 * reports exactly what it finds so the field map can be pinned:
 *   - every <select> with its row label and option texts
 *   - every row label and every button/submit text
 * Saves output/form.html and output/form.png for offline inspection.
 *
 *   npm run probe
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { config } from './config.js';
import { launch } from './browser.js';
import { navigateToForm } from './flow.js';
import { log } from './log.js';

async function main(): Promise<void> {
  const outputDir = resolve(process.cwd(), config.outputDir);
  mkdirSync(outputDir, { recursive: true });

  const { browser, page } = await launch(config);
  try {
    log.info(`Opening ${config.url}`);
    await navigateToForm(page, config.url);

    const html = await page.content();
    writeFileSync(join(outputDir, 'form.html'), html);
    await page.screenshot({ path: join(outputDir, 'form.png'), fullPage: true }).catch(() => {});

    const data = await page.evaluate(() => {
      // tsx/esbuild injects a __name helper for named in-page functions; shim it.
      (globalThis as any).__name = (globalThis as any).__name || ((f: unknown) => f);
      const rowLabel = (el: Element): string => {
        const tr = el.closest('tr');
        if (tr) {
          const th = tr.querySelector('th');
          if (th?.textContent) return th.textContent.trim();
          const td = tr.querySelector('td');
          if (td?.textContent) return td.textContent.trim().slice(0, 24);
        }
        return '(no label)';
      };
      const selects = Array.from(document.querySelectorAll('select')).map((s) => ({
        label: rowLabel(s),
        options: Array.from(s.options).map((o) => (o.textContent ?? '').trim()).filter(Boolean),
      }));
      const labels = Array.from(document.querySelectorAll('th'))
        .map((th) => (th.textContent ?? '').trim())
        .filter(Boolean);
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'))
        .map((b) => ((b as HTMLElement).textContent || (b as HTMLInputElement).value || '').trim())
        .filter(Boolean);
      return { selects, labels, buttons };
    });

    log.info('──────── DROPDOWNS (label → options) ────────');
    for (const s of data.selects) log.info(`  ${s.label}: ${s.options.join(' | ')}`);
    log.info('──────── ROW LABELS ────────');
    log.info('  ' + data.labels.join('  ·  '));
    log.info('──────── BUTTONS ────────');
    log.info('  ' + data.buttons.join('  ·  '));
    log.ok(`Saved ${join(config.outputDir, 'form.html')} and form.png — send me form.html to finalize.`);

    if (!config.headless) await page.waitForTimeout(8000); // leave the window up briefly
  } finally {
    await browser.close().catch(() => {});
  }
}

main().catch((err) => {
  log.error(err);
  process.exit(1);
});
