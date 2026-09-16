/**
 * Read students from the Excel template's "Students" sheet.
 *
 * Row 1 = section bands, row 2 = headers (bilingual "English\nKorean"), row 3 =
 * sample, real data from `dataStart` (row 4). Columns are matched by the Korean
 * part of each header, so reordering or extra columns are tolerated.
 */
import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import type { Student } from './types.js';

/** Korean header label -> Student key, matching the generated template. */
const TEMPLATE_COLS: { key: keyof Student; ko: string }[] = [
  { key: 'applyCourse', ko: '지원과정' },
  { key: 'accountEmail', ko: '이메일' },
  { key: 'password', ko: '비밀번호' },
  { key: 'folder', ko: '파일 폴더명' },
  { key: 'studentEmail', ko: '유학원 학생 이메일' },
  { key: 'givenName', ko: '이름' },
  { key: 'familyName', ko: '성' },
  { key: 'gender', ko: '성별' },
  { key: 'nationality', ko: '국적' },
  { key: 'dob', ko: '생년월일' },
  { key: 'passportNo', ko: '여권번호' },
  { key: 'noPassport', ko: '여권번호 없음' },
  { key: 'homeCountryAddress', ko: '본국주소' },
  { key: 'addressKorea', ko: '한국 내 주소' },
  { key: 'homeCountryPhone', ko: '본국 전화번호' },
  { key: 'messengerType', ko: 'Kakao/Wechat/Line' },
  { key: 'messengerId', ko: '메신저 아이디' },
  { key: 'mobileKR', ko: '내 전화번호' },
  { key: 'hanyangId', ko: '한양대학교 학번' },
  { key: 'prefLanguage', ko: '선호언어' },
  { key: 'schoolName', ko: '출신학교명' },
  { key: 'eduCompletionDate', ko: '최종학력취득일' },
  { key: 'highestEdu', ko: '최종취득학력' },
  { key: 'visaApplying', ko: '어학연수 비자 신청여부' },
  { key: 'visaType', ko: '비자구분' },
  { key: 'visaNo', ko: '비자번호' },
  { key: 'visaExpiry', ko: '비자만료일' },
  { key: 'homeAddress', ko: '자택주소' },
  { key: 'homeLandline', ko: '자택전화번호' },
];

const koPart = (header: unknown): string => {
  const parts = String(header ?? '').split('\n');
  return (parts[parts.length - 1] ?? '').replace(/^[★*\s]+/, '').trim();
};

const emptyStudent = (rowNum: number): Student =>
  Object.fromEntries(
    [['rowNum', rowNum], ...TEMPLATE_COLS.map((c) => [c.key, ''])],
  ) as unknown as Student;

export function readStudents(templatePath: string, dataStart: number): Student[] {
  const wb = XLSX.read(readFileSync(templatePath), { type: 'buffer' });
  const ws = wb.Sheets['Students'];
  if (!ws) throw new Error(`No "Students" sheet in ${templatePath}`);
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, defval: '' });

  const header = rows[1] ?? []; // row 2
  const colOf = new Map<keyof Student, number>();
  header.forEach((h, j) => {
    const ko = koPart(h);
    const col = TEMPLATE_COLS.find((c) => c.ko === ko);
    if (col && !colOf.has(col.key)) colOf.set(col.key, j);
  });

  const out: Student[] = [];
  for (let i = dataStart - 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const s = emptyStudent(i + 1);
    for (const [key, j] of colOf) s[key] = String(row[j] ?? '').trim();
    // Skip blank rows: need at least an identifying value.
    if (!s.studentEmail && !s.givenName && !s.familyName && !s.folder) continue;
    out.push(s);
  }
  return out;
}
