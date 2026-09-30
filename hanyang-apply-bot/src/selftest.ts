/**
 * Offline self-test — no credentials, no network. Drives the local English
 * fixture through the real flow + fill code and asserts every field lands,
 * including labels that repeat across sections (E-mail, Name), the two text
 * areas, and all seven uploads. Also smoke-checks the spreadsheet reader.
 *
 *   npm run selftest
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Page } from 'playwright';
import { launch, control, rowFor } from './browser.js';
import { navigateToForm } from './flow.js';
import { fillStudent } from './form.js';
import { readStudents, excelSerialToISO } from './students.js';
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
    (ok ? (pass++, log.ok) : (fail++, log.error))(`${name} = ${JSON.stringify(v)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
  } catch (err) {
    fail++;
    log.error(`${name} threw: ${(err as Error).message}`);
  }
}

const TEST: Student = {
  rowNum: 3, applyCourse: '2026 Winter Korean Language and culture(02)', accountEmail: 'hy.saem01@example.com',
  password: 'Abc12345!@', semesters: '2', classTime: 'Afternoon Class (14:00~18:00)', levelTest: 'Participate',
  preKorean: 'No', dormitory: 'No', payment: 'Lump-sum payment', folder: '01_RAHMAN_SAEM',
  studentEmail: 'saem.rahman@example.com', givenName: 'SAEM', familyName: 'RAHMAN', gender: 'Male',
  nationality: 'Bangladesh', dob: '1999-05-15', passportNo: 'A01234567', noPassport: '',
  homeCountryAddress: 'House 12, Road 5, Dhanmondi, Dhaka', addressKorea: 'Seoul', homeCountryPhone: '+8801712345678',
  messengerType: 'Kakao', messengerId: 'saem_kakao', mobileKR: '010-1234-5678', hanyangId: '', prefLanguage: 'Korean',
  schoolName: 'Dhaka College', eduCompletionDate: '2018-05-30', highestEdu: 'High School', visaApplying: 'No',
  visaStatus: '', visaNo: '', visaExpiry: '', learningExp: 'No', instituteName: '', studyPeriod: '', completedLevel: '',
  textbookName: '', purposeOfStudy: 'Enter a university', aimingLevel: 'Level 6', estimatedPeriod: '2 semesters',
  emergencyName: 'KARIM RAHMAN', emergencyRelation: 'Father', emergencyContact: '+8801787654321',
  agentCompany: 'HANGEUL KOREAN LANGUAGE AND VISA', agentPhone: '+8801000000000', agentEmail: 'agency@example.com',
  personalStatement: 'I want to study Korean at Hanyang University.', studyPlanText: 'My plan is to reach Level 6.',
} as unknown as Student;

async function main(): Promise<void> {
  const cwd = process.cwd();
  const templatePath = resolve(cwd, 'Hanyang_Students_Template.xlsx');
  const fixture = pathToFileURL(resolve(cwd, 'fixtures/agency-form.sample.html')).href;

  // Reader smoke-check against the real 49-column template.
  try {
    const parsed = readStudents(templatePath, 3);
    const s0 = parsed[0];
    const ok = parsed.length >= 1 && !!(s0 && s0.studentEmail && s0.semesters && s0.agentCompany && s0.personalStatement);
    (ok ? (pass++, log.ok) : (fail++, log.error))(`reader parsed template: ${parsed.length} row(s), sections mapped`);
  } catch (err) {
    fail++;
    log.error(`reader threw: ${(err as Error).message}`);
  }

  // Excel date-serial -> ISO (a date-formatted cell reads back as a serial number).
  await check('excelSerialToISO(36526)', async () => excelSerialToISO(36526), '2000-01-01');

  // Per-student upload folder with all seven standard files.
  const uploadsDir = mkdtempSync(join(tmpdir(), 'hy-upl-'));
  const sdir = join(uploadsDir, TEST.folder);
  mkdirSync(sdir, { recursive: true });
  for (const f of ['photo.jpg', 'passport.jpg', 'gap.pdf', 'education.pdf', 'financial.pdf', 'family.pdf', 'other.pdf']) {
    writeFileSync(join(sdir, f), 'dummy');
  }

  const { browser, page } = await launch({ channel: '', headless: true, slowMo: 0 });
  const val = (label: string, kind: 'text' | 'select' | 'date', index = 0, occ = 0) => async () =>
    (await (await control(page, label, kind, index, occ))?.inputValue()) ?? null;
  try {
    await navigateToForm(page, fixture);
    await fillStudent(page, TEST, uploadsDir);

    // Labels that repeat across sections — occurrence must disambiguate.
    await check('accountEmail (E-mail #0)', val('E-mail', 'text', 0, 0), TEST.accountEmail);
    await check('agentEmail (E-mail #1)', val('E-mail', 'text', 0, 1), TEST.agentEmail);
    await check('givenName (Name #0)', val('Name', 'text', 0, 0), TEST.givenName);
    await check('familyName (Name #0)', val('Name', 'text', 1, 0), TEST.familyName);
    await check('emergencyName (Name #1)', val('Name', 'text', 0, 1), TEST.emergencyName);

    await check('studentEmail', val('student email address', 'text'), TEST.studentEmail);
    await check('semesters', val('Number of Semester Applying', 'select'), TEST.semesters);
    await check('classTime', val('Prefered Class Time for the first semester', 'select'), TEST.classTime);
    await check('levelTest', val('Level Test Participation', 'select'), TEST.levelTest);
    await check('dormitory', val('Whether apply for the dormitory or not', 'select'), TEST.dormitory);
    await check('payment', val('How to pay the tuition and the dormitory fee', 'select'), TEST.payment);
    await check('gender', val('Gender', 'select'), TEST.gender);
    await check('nationality', val('Nationality', 'select'), TEST.nationality);
    await check('dob', val('Date of Birth', 'date'), TEST.dob);
    await check('passportNo', val('Passport Number', 'text', 0), TEST.passportNo);
    await check('highestEdu', val('Highest level of Education Achieved', 'select'), TEST.highestEdu);
    await check('visaApplying', val('Applying for Student D-4 VISA', 'select'), TEST.visaApplying);
    await check('purposeOfStudy', val('Purpose of Study', 'select'), TEST.purposeOfStudy);
    await check('aimingLevel', val('Aiming Level to Achieve', 'select'), TEST.aimingLevel);
    await check('estimatedPeriod', val('Estimated period of enrollemnt at Hanyang University IIE', 'select'), TEST.estimatedPeriod);
    await check('prefLanguage', val('Preferred Language', 'select'), TEST.prefLanguage);
    await check('messengerType', val('Kakao/Wechat/Line', 'select'), TEST.messengerType);
    await check('schoolName', val('Name of the School graduated', 'text'), TEST.schoolName);
    await check('emergencyRelation', val('Relation to the Applicant', 'text'), TEST.emergencyRelation);
    await check('emergencyContact', val('Contact', 'text'), TEST.emergencyContact);
    await check('agentCompany', val('Name of Company', 'text'), TEST.agentCompany);
    await check('agentPhone', val('Phone Number', 'text'), TEST.agentPhone);

    const phone = (await rowFor(page, 'Phone Number in Korea')).locator('input[type="text"]');
    await check('mobile[0]', async () => phone.nth(0).inputValue(), '010');
    await check('mobile[2]', async () => phone.nth(2).inputValue(), '5678');

    await check('password 10–15', val('Password', 'text'), (v: unknown) => typeof v === 'string' && v.length >= 10 && v.length <= 15);
    await check('password == confirm', async () => (await val('Password', 'text')()) === (await val('Password(check)', 'text')()), true);
    await check('course radio', async () => (await rowFor(page, 'Applying Course')).locator('input[type="radio"]').first().isChecked(), true);

    const areas = page.locator('textarea');
    await check('personalStatement', async () => areas.nth(0).inputValue(), TEST.personalStatement);
    await check('studyPlan', async () => areas.nth(1).inputValue(), TEST.studyPlanText);

    for (const label of ['Photo', 'Passport file', 'Proof of gap period', 'Documents of the last degree achieved', 'Financial Statement', 'Family Relationship documents', 'Other documents']) {
      await check(`upload ${label}`, async () => (await control(page, label, 'file'))?.evaluate((el) => (el as HTMLInputElement).files?.length ?? 0), (n: unknown) => Number(n) > 0);
    }
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
