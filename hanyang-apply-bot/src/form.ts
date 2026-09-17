/**
 * Field map (English portal labels) and the per-student fill routine. Labels are
 * matched exactly against the form's row labels; `occurrence` disambiguates the
 * ones that repeat across sections (E-mail: General/Agent; Name: Personal/Emergency).
 */
import type { Locator, Page } from 'playwright';
import { control, rowFor, selectByText } from './browser.js';
import { resolveUpload } from './uploads.js';
import { generatePassword } from './password.js';
import { log } from './log.js';
import type { FileField, FormField, Student } from './types.js';

const FIELDS: FormField[] = [
  // General Information
  { key: 'accountEmail', label: 'E-mail', kind: 'text', occurrence: 0 },
  // Registration Information
  { key: 'semesters', label: 'Number of Semester Applying', kind: 'select' },
  { key: 'classTime', label: 'Prefered Class Time for the first semester', kind: 'select' },
  { key: 'levelTest', label: 'Level Test Participation', kind: 'select' },
  { key: 'preKorean', label: 'Applying for Pre-Korean Class', kind: 'select' },
  { key: 'dormitory', label: 'Whether apply for the dormitory or not', kind: 'select' },
  { key: 'payment', label: 'How to pay the tuition and the dormitory fee', kind: 'select' },
  // Personal Details
  { key: 'studentEmail', label: 'student email address', kind: 'text' },
  { key: 'givenName', label: 'Name', kind: 'text', occurrence: 0, index: 0 },
  { key: 'familyName', label: 'Name', kind: 'text', occurrence: 0, index: 1 },
  { key: 'gender', label: 'Gender', kind: 'select' },
  { key: 'nationality', label: 'Nationality', kind: 'select' },
  { key: 'dob', label: 'Date of Birth', kind: 'date' },
  { key: 'passportNo', label: 'Passport Number', kind: 'text', index: 0 },
  { key: 'homeCountryAddress', label: 'Address in Home Country', kind: 'text' },
  { key: 'addressKorea', label: 'Address in Korea', kind: 'text' },
  { key: 'homeCountryPhone', label: 'Phone Number in Home Country', kind: 'text' },
  { key: 'messengerType', label: 'Kakao/Wechat/Line', kind: 'select' },
  { key: 'messengerId', label: 'Kakao/Wechat/Line', kind: 'text' },
  { key: 'mobileKR', label: 'Phone Number in Korea', kind: 'phone3' },
  { key: 'hanyangId', label: 'Hanyang University Student Number', kind: 'text' },
  { key: 'prefLanguage', label: 'Preferred Language', kind: 'select' },
  // Highest Level of Education Completed
  { key: 'schoolName', label: 'Name of the School graduated', kind: 'text' },
  { key: 'eduCompletionDate', label: 'Date of degree obtained', kind: 'date' },
  { key: 'highestEdu', label: 'Highest level of Education Achieved', kind: 'select' },
  // VISA application
  { key: 'visaApplying', label: 'Applying for Student D-4 VISA', kind: 'select' },
  { key: 'visaStatus', label: 'VISA status', kind: 'select' },
  { key: 'visaNo', label: 'VISA number', kind: 'text' },
  { key: 'visaExpiry', label: 'VISA expiring date', kind: 'date' },
  // Korean Learning Experience
  { key: 'learningExp', label: 'Learning Experience', kind: 'select' },
  { key: 'instituteName', label: 'Name of Institute', kind: 'text' },
  { key: 'studyPeriod', label: 'Period of Study', kind: 'text' },
  { key: 'completedLevel', label: 'Completed Level', kind: 'text' },
  { key: 'textbookName', label: 'Name of Textbook', kind: 'text' },
  // Study Plan (choices)
  { key: 'purposeOfStudy', label: 'Purpose of Study', kind: 'select' },
  { key: 'aimingLevel', label: 'Aiming Level to Achieve', kind: 'select' },
  { key: 'estimatedPeriod', label: 'Estimated period of enrollemnt at Hanyang University IIE', kind: 'select' },
  // Emergency Contact Details
  { key: 'emergencyName', label: 'Name', kind: 'text', occurrence: 1, index: 0 },
  { key: 'emergencyRelation', label: 'Relation to the Applicant', kind: 'text' },
  { key: 'emergencyContact', label: 'Contact', kind: 'text' },
  // Agent Information
  { key: 'agentCompany', label: 'Name of Company', kind: 'text' },
  { key: 'agentPhone', label: 'Phone Number', kind: 'text' },
  { key: 'agentEmail', label: 'E-mail', kind: 'text', occurrence: 1 },
];

const REQUIRED = new Set([
  'applyCourse', 'accountEmail', 'studentEmail', 'givenName', 'familyName',
  'gender', 'nationality', 'dob',
]);

const FILES: FileField[] = [
  { label: 'Photo', base: 'photo' },
  { label: 'Passport file', base: 'passport' },
  { label: 'Proof of gap period', base: 'gap' },
  { label: 'Documents of the last degree achieved', base: 'education' },
  { label: 'Financial Statement', base: 'financial' },
  { label: 'Family Relationship documents', base: 'family' },
  { label: 'Other documents', base: 'other' },
];

const norm = (s: string) => s.replace(/\s+/g, '');

async function setText(loc: Locator, value: string): Promise<void> {
  try {
    await loc.fill(value);
  } catch {
    await loc.evaluate((el, v) => {
      (el as HTMLInputElement).value = v as string;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
  }
}

/** Pick the "Applying Course" radio matching the course text (else the first). */
async function selectCourse(page: Page, text: string): Promise<boolean> {
  let radios = (await rowFor(page, 'Applying Course')).locator('input[type="radio"]');
  // Fallback: the form has a single course radio — take any visible one.
  if ((await radios.count()) === 0) radios = page.locator('input[type="radio"]:visible');
  const n = await radios.count();
  if (n === 0) return false;
  if (text) {
    for (let i = 0; i < n; i++) {
      const r = radios.nth(i);
      const ctx =
        (await r.locator('xpath=ancestor::label[1]').textContent().catch(() => null)) ??
        (await r.locator('xpath=..').textContent().catch(() => null));
      if (ctx && norm(ctx).includes(norm(text))) {
        await r.check();
        return true;
      }
    }
  }
  await radios.first().check();
  return true;
}

async function fillPhone3(page: Page, value: string): Promise<boolean> {
  const parts = value.split(/\D+/).filter(Boolean);
  const inputs = (await rowFor(page, 'Phone Number in Korea')).locator(
    'input[type="text"], input[type="tel"], input[type="number"], input:not([type])',
  );
  const n = await inputs.count();
  if (n >= 3 && parts.length >= 3) {
    for (let i = 0; i < 3; i++) await setText(inputs.nth(i), parts[i]);
    return true;
  }
  if (n >= 1) {
    await setText(inputs.first(), value);
    return true;
  }
  return false;
}

/** Fill one student into the currently-open form. Returns notes on anything skipped. */
export async function fillStudent(
  page: Page,
  s: Student,
  uploadsDir: string,
): Promise<{ notes: string[] }> {
  const notes: string[] = [];
  const miss = (msg: string, required = false) => {
    notes.push(msg);
    (required ? log.warn : log.info)('   ', msg);
  };

  if (s.applyCourse && !(await selectCourse(page, s.applyCourse))) miss('Applying Course radio not found', true);

  if (!s.password) s.password = generatePassword();
  for (const label of ['Password', 'Password(check)']) {
    const loc = await control(page, label, 'text');
    if (loc) await setText(loc, s.password);
    else miss(`${label} field not found`);
  }

  for (const f of FIELDS) {
    const value = String(s[f.key] ?? '').trim();
    if (!value) {
      if (REQUIRED.has(f.key)) miss(`${f.label} is empty (required)`, true);
      continue;
    }
    if (f.kind === 'phone3') {
      if (!(await fillPhone3(page, value))) miss(`${f.label} inputs not found`);
      continue;
    }
    const loc = await control(page, f.label, f.kind === 'date' ? 'date' : (f.kind as any), f.index ?? 0, f.occurrence ?? 0);
    if (!loc) {
      miss(`${f.label} control not found`, REQUIRED.has(f.key));
      continue;
    }
    if (f.kind === 'select') {
      if (!(await selectByText(loc, value))) miss(`${f.label}: no option matching "${value}"`);
    } else {
      await setText(loc, value);
    }
  }

  // "No Passport Number" checkbox.
  if (/^(yes|y|true|1)$/i.test(s.noPassport)) {
    const box = await control(page, 'Passport Number', 'checkbox');
    if (box) await box.check();
    else miss('No Passport Number checkbox not found');
  }

  // Statements (two big text areas, in document order: Personal Statement, Study Plan).
  const areas = page.locator('textarea');
  const na = await areas.count();
  if (s.personalStatement && na >= 1) await setText(areas.nth(0), s.personalStatement);
  if (s.studyPlanText && na >= 2) await setText(areas.nth(1), s.studyPlanText);

  // Uploads from the student's folder.
  for (const file of FILES) {
    const path = resolveUpload(uploadsDir, s.folder, file.base);
    if (!path) continue;
    const input = await control(page, file.label, 'file');
    if (input) await input.setInputFiles(path);
    else miss(`${file.label} upload input not found (have ${file.base})`);
  }

  return { notes };
}
