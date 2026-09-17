/**
 * Batch runner: read the spreadsheet, then fill (and optionally submit) every
 * student one after another until finished.
 *
 *   npm run fill                 # dry run — fills each, screenshots, DOES NOT submit
 *   HY_SUBMIT=true npm run fill  # actually submit each application
 *   HY_ONLY=<email> npm run fill # just one student   |   HY_LIMIT=1 for the first N
 */
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { config } from './config.js';
import { launch } from './browser.js';
import { readStudents } from './students.js';
import { agreePledge, navigateToForm, submitForm } from './flow.js';
import { fillStudent } from './form.js';
import { recordSubmission, readSubmitted } from './ledger.js';
import { log } from './log.js';
import type { Student } from './types.js';

function selected(all: Student[], submitted: Set<string>): Student[] {
  let list = all;
  if (config.only) {
    const q = config.only.toLowerCase();
    list = list.filter(
      (s) => s.studentEmail.toLowerCase() === q || s.folder.toLowerCase() === q || s.accountEmail.toLowerCase() === q,
    );
  }
  if (config.submit && config.skipSubmitted) {
    list = list.filter((s) => !submitted.has(s.studentEmail.toLowerCase()));
  }
  if (config.limit > 0) list = list.slice(0, config.limit);
  return list;
}

async function main(): Promise<void> {
  const templatePath = resolve(process.cwd(), config.template);
  const uploadsDir = resolve(process.cwd(), config.uploadsDir);
  const outputDir = resolve(process.cwd(), config.outputDir);
  const shotsDir = join(outputDir, 'screenshots');
  mkdirSync(shotsDir, { recursive: true });

  const submitted = config.submit && config.skipSubmitted ? readSubmitted(outputDir) : new Set<string>();
  const students = selected(readStudents(templatePath, config.dataStart), submitted);
  if (students.length === 0) {
    log.warn('No students to process (check the spreadsheet, HY_ONLY / HY_LIMIT, and whether everyone is already submitted).');
    return;
  }

  log.info(`Loaded ${students.length} student(s) from ${config.template}.`);
  if (submitted.size) log.info(`Skipping ${submitted.size} already-submitted (from submissions.csv).`);
  log.info(config.submit ? '⚠ SUBMIT mode: applications WILL be submitted.' : 'Dry run: filling only, NOT submitting. Set HY_SUBMIT=true to submit.');

  const { browser, page } = await launch(config);
  let ok = 0;
  const failures: string[] = [];

  for (let i = 0; i < students.length; i++) {
    const s = students[i];
    const who = s.folder || s.studentEmail || `row ${s.rowNum}`;
    log.info(`[${i + 1}/${students.length}] ${who} — ${s.givenName} ${s.familyName}`);
    let status = 'filled';
    let notesStr = '';
    try {
      await navigateToForm(page, config.url);
      const { notes } = await fillStudent(page, s, uploadsDir);
      notesStr = notes.join('; ');

      const safeFolder = (s.folder || 'student').replace(/[^A-Za-z0-9_-]+/g, '_').slice(-40);
      const shot = join(shotsDir, `${String(s.rowNum).padStart(3, '0')}_${safeFolder}.png`);
      await page.screenshot({ path: shot, fullPage: true }).catch(() => {});

      if (config.submit) {
        await agreePledge(page).catch(() => {});
        status = (await submitForm(page, config.submitText)) ? 'submitted' : 'filled (submit button not found)';
        await page.waitForTimeout(1500);
      }
      ok++;
      log.ok(`   ${who}: ${status}${notesStr ? ` — notes: ${notesStr}` : ''}`);
    } catch (err) {
      status = 'ERROR';
      notesStr = (err as Error).message;
      failures.push(`${who}: ${notesStr}`);
      log.error(`   ${who}: ${notesStr}`);
      await page.screenshot({ path: join(shotsDir, `ERROR_${s.rowNum}.png`), fullPage: true }).catch(() => {});
    }
    recordSubmission(outputDir, {
      rowNum: s.rowNum,
      folder: s.folder,
      accountEmail: s.accountEmail,
      studentEmail: s.studentEmail,
      password: s.password,
      status,
      notes: notesStr,
    });
  }

  await browser.close().catch(() => {});
  log.info('────────────────────────────────────────');
  log.info(`Done. ${ok}/${students.length} processed. Ledger: ${join(config.outputDir, 'submissions.csv')}`);
  if (failures.length) {
    log.warn(`${failures.length} failure(s):`);
    for (const f of failures) log.warn('  -', f);
  }
}

main().catch((err) => {
  log.error(err);
  process.exit(1);
});
