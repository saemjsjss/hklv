/**
 * The field map (spreadsheet key -> Korean form label) and the per-student fill
 * routine. Registration (등록정보) dropdowns are intentionally NOT here — the bot
 * leaves them as-is, per the agency's workflow.
 */
import type { Locator, Page } from 'playwright';
import { control, rowFor, selectByText } from './browser.js';
import { resolveUpload } from './uploads.js';
import { generatePassword } from './password.js';
import { log } from './log.js';
import type { FileField, FormField, Student } from './types.js';

const FIELDS: FormField[] = [
  { key: 'accountEmail', label: '이메일', kind: 'text' },
  { key: 'studentEmail', label: '유학원 학생 이메일', kind: 'text' },
  { key: 'givenName', label: '성명', kind: 'text', index: 0 },
  { key: 'familyName', label: '성명', kind: 'text', index: 1 },
  { key: 'gender', label: '성별', kind: 'select' },
  { key: 'nationality', label: '국적', kind: 'select' },
  { key: 'dob', label: '생년월일', kind: 'date' },
  { key: 'passportNo', label: '여권번호', kind: 'text', index: 0 },
  { key: 'homeCountryAddress', label: '본국주소', kind: 'text' },
  { key: 'addressKorea', label: '한국 내 주소', kind: 'text' },
  { key: 'homeCountryPhone', label: '본국 전화번호', kind: 'text' },
  { key: 'messengerType', label: 'Kakao/Wechat/Line', kind: 'select' },
  { key: 'messengerId', label: 'Kakao/Wechat/Line', kind: 'text' },
  { key: 'mobileKR', label: '내 전화번호', kind: 'phone3' },
  { key: 'hanyangId', label: '한양대학교 학번', kind: 'text' },
  { key: 'prefLanguage', label: '선호언어', kind: 'select' },
  { key: 'schoolName', label: '출신학교명', kind: 'text' },
  { key: 'eduCompletionDate', label: '최종학력취득일', kind: 'date' },
  { key: 'highestEdu', label: '최종취득학력', kind: 'select' },
  { key: 'visaApplying', label: '어학연수 비자 신청여부', kind: 'select' },
  { key: 'visaType', label: '비자구분', kind: 'select' },
  { key: 'visaNo', label: '비자번호', kind: 'text' },
  { key: 'visaExpiry', label: '비자만료일', kind: 'date' },
  { key: 'homeAddress', label: '자택주소', kind: 'text' },
  { key: 'homeLandline', label: '자택전화번호', kind: 'text' },
];

const REQUIRED = new Set([
  'applyCourse', 'accountEmail', 'studentEmail', 'givenName', 'familyName',
  'gender', 'nationality', 'dob',
]);

const FILES: FileField[] = [
  { label: '사진', base: 'photo' },
  { label: '여권파일', base: 'passport' },
  { label: '최종학력서류', base: 'education' },
  { label: '공백기 증명', base: 'gap' },
];

const norm = (s: string) => s.replace(/\s+/g, '');

async function setText(loc: Locator, value: string): Promise<void> {
  try {
    await loc.fill(value);
  } catch {
    // Read-only / picker-backed input: set the value directly and notify.
    await loc.evaluate((el, v) => {
      (el as HTMLInputElement).value = v as string;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
  }
}

/** Pick the 지원과정 radio matching the course text (else the first radio). */
async function selectCourse(page: Page, text: string): Promise<boolean> {
  const radios = (await rowFor(page, '지원과정')).locator('input[type="radio"]');
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
  const inputs = (await rowFor(page, '내 전화번호')).locator(
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

  // Course radio.
  if (s.applyCourse && !(await selectCourse(page, s.applyCourse))) {
    miss('지원과정 radio not found', true);
  }

  // Password (+ confirm). Generate a compliant one if the sheet left it blank.
  if (!s.password) s.password = generatePassword();
  for (const label of ['비밀번호', '비밀번호(체크)']) {
    const loc = await control(page, label, 'text');
    if (loc) await setText(loc, s.password);
    else miss(`${label} field not found`);
  }

  // Straightforward fields.
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
    const loc = await control(page, f.label, f.kind === 'date' ? 'date' : (f.kind as any), f.index ?? 0);
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

  // "No passport" checkbox.
  if (/^(yes|y|true|1|없음)$/i.test(s.noPassport)) {
    const box = await control(page, '여권번호', 'checkbox');
    if (box) await box.check();
    else miss('여권번호 없음 checkbox not found');
  }

  // Uploads from the student's folder.
  for (const file of FILES) {
    const path = resolveUpload(uploadsDir, s.folder, file.base);
    if (!path) continue; // optional; absence is fine
    const input = await control(page, file.label, 'file');
    if (input) await input.setInputFiles(path);
    else miss(`${file.label} upload input not found (have ${file.base})`);
  }

  return { notes };
}
