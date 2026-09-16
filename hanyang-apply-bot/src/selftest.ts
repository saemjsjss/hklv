/**
 * Offline self-test — no credentials, no network. Drives the local fixture
 * through the real flow + fill code and asserts every field landed. Also proves
 * the spreadsheet reader and the "leave 등록정보 as-is" rule.
 *
 *   npm run selftest
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch, control, rowFor } from './browser.js';
import { navigateToForm } from './flow.js';
import { fillStudent } from './form.js';
import { readStudents } from './students.js';
import { log } from './log.js';
import type { Student } from './types.js';

let pass = 0;
let fail = 0;
async function check(name: string, fn: () => Promise<unknown>, expected?: unknown): Promise<void> {
  try {
    const v = await fn();
    const ok =
      typeof expected === 'function'
        ? Boolean((expected as (x: unknown) => boolean)(v))
        : expected === undefined
          ? Boolean(v)
          : v === expected;
    if (ok) {
      pass++;
      log.ok(`${name} = ${JSON.stringify(v)}`);
    } else {
      fail++;
      log.error(`${name} = ${JSON.stringify(v)} (expected ${JSON.stringify(expected)})`);
    }
  } catch (err) {
    fail++;
    log.error(`${name} threw: ${(err as Error).message}`);
  }
}

const val = (label: string, kind: 'text' | 'select' | 'date', i = 0) => async () =>
  (await (await control((globalThis as any).__page, label, kind, i))?.inputValue()) ?? null;

async function main(): Promise<void> {
  const cwd = process.cwd();
  const templatePath = resolve(cwd, 'Hanyang_Students_Template.xlsx');
  const fixture = pathToFileURL(resolve(cwd, 'fixtures/agency-form.sample.html')).href;

  // Use the template's sample row (row 3) as the test student — exercises the reader.
  let student: Student;
  try {
    student = readStudents(templatePath, 3)[0];
    log.info(`Read sample student from template: ${student.givenName} ${student.familyName} (${student.folder})`);
  } catch (err) {
    log.warn(`Could not read template (${(err as Error).message}); using a built-in sample.`);
    student = { rowNum: 3, applyCourse: '2026 겨울학기 한국어과정(02)', accountEmail: 'hy.saem01@example.com', password: 'Abc12345!@', folder: '01_RAHMAN_SAEM', studentEmail: 'saem.rahman@example.com', givenName: 'SAEM', familyName: 'RAHMAN', gender: 'Male', nationality: 'Bangladesh', dob: '1999-05-15', passportNo: 'A01234567', noPassport: '', homeCountryAddress: 'Dhaka', addressKorea: '', homeCountryPhone: '+8801712345678', messengerType: 'Kakao', messengerId: 'saem_kakao', mobileKR: '010-1234-5678', hanyangId: '', prefLanguage: 'Korean', schoolName: 'Dhaka College', eduCompletionDate: '2018-05-30', highestEdu: 'High school diploma', visaApplying: 'YES', visaType: 'D-4 (language training)', visaNo: 'C123456789', visaExpiry: '2027-06-30', homeAddress: '', homeLandline: '02-9876543' } as Student;
  }

  // Dummy per-student upload folder.
  const uploadsDir = mkdtempSync(join(tmpdir(), 'hy-upl-'));
  const sdir = join(uploadsDir, student.folder);
  mkdirSync(sdir, { recursive: true });
  for (const f of ['photo.jpg', 'passport.jpg', 'education.pdf', 'gap.pdf']) writeFileSync(join(sdir, f), 'dummy');

  const { browser, page } = await launch({ channel: '', headless: true, slowMo: 0 });
  (globalThis as any).__page = page;
  try {
    await navigateToForm(page, fixture);
    await fillStudent(page, student, uploadsDir);

    await check('accountEmail', val('이메일', 'text'), student.accountEmail);
    await check('studentEmail', val('유학원 학생 이메일', 'text'), student.studentEmail);
    await check('givenName', val('성명', 'text', 0), student.givenName);
    await check('familyName', val('성명', 'text', 1), student.familyName);
    await check('gender', val('성별', 'select'), student.gender);
    await check('nationality', val('국적', 'select'), student.nationality);
    await check('dob', val('생년월일', 'date'), student.dob);
    await check('passportNo', val('여권번호', 'text', 0), student.passportNo);
    await check('homeCountryAddress', val('본국주소', 'text'), student.homeCountryAddress);
    await check('homeCountryPhone', val('본국 전화번호', 'text'), student.homeCountryPhone);
    await check('messengerType', val('Kakao/Wechat/Line', 'select'), student.messengerType);
    await check('messengerId', val('Kakao/Wechat/Line', 'text'), student.messengerId);
    await check('prefLanguage', val('선호언어', 'select'), student.prefLanguage);
    await check('schoolName', val('출신학교명', 'text'), student.schoolName);
    await check('highestEdu', val('최종취득학력', 'select'), student.highestEdu);
    await check('visaApplying', val('어학연수 비자 신청여부', 'select'), student.visaApplying);
    await check('visaType', val('비자구분', 'select'), student.visaType);
    await check('visaNo', val('비자번호', 'text'), student.visaNo);

    // Mobile split into 3 boxes.
    const phone = (await rowFor(page, '내 전화번호')).locator('input[type="text"]');
    await check('mobile[0]', async () => phone.nth(0).inputValue(), '010');
    await check('mobile[1]', async () => phone.nth(1).inputValue(), '1234');
    await check('mobile[2]', async () => phone.nth(2).inputValue(), '5678');

    // Password: filled, matching confirm, 10–15 chars.
    await check('password 10–15 chars', val('비밀번호', 'text'), (v: unknown) => typeof v === 'string' && v.length >= 10 && v.length <= 15);
    await check('password == confirm', async () => (await val('비밀번호', 'text')()) === (await val('비밀번호(체크)', 'text')()), true);

    // Course radio picked.
    await check('course radio checked', async () => (await rowFor(page, '지원과정')).locator('input[type="radio"]').first().isChecked(), true);

    // Uploads attached.
    for (const label of ['사진', '여권파일', '최종학력서류', '공백기 증명']) {
      await check(`upload ${label}`, async () => (await control(page, label, 'file'))?.evaluate((el) => (el as HTMLInputElement).files?.length ?? 0), (n: unknown) => Number(n) > 0);
    }

    // Registration dropdown left as-is (default empty).
    await check('등록학기수 left as-is', val('등록학기수', 'select'), '');
  } finally {
    await browser.close().catch(() => {});
  }

  log.info('────────────────────────────────────────');
  log[fail === 0 ? 'ok' : 'error'](`Self-test: ${pass} passed, ${fail} failed.`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  log.error(err);
  process.exit(1);
});
