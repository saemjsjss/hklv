/**
 * Read students from the Excel template's "Students" sheet.
 *
 * Row 1 = section bands, row 2 = headers, row 3 = sample, real data from
 * `dataStart` (row 4). Columns are matched by their English header, so reordering
 * or extra columns are tolerated.
 */
import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import type { Student } from './types.js';

/** English header (row 2, minus the ★) -> Student key, matching the template. */
const TEMPLATE_COLS: { key: keyof Student; hdr: string }[] = [
  { key: 'applyCourse', hdr: 'Applying Course' },
  { key: 'accountEmail', hdr: 'E-mail' },
  { key: 'password', hdr: 'Password' },
  { key: 'semesters', hdr: 'Number of Semester Applying' },
  { key: 'classTime', hdr: 'Prefered Class Time' },
  { key: 'levelTest', hdr: 'Level Test Participation' },
  { key: 'preKorean', hdr: 'Applying for Pre-Korean Class' },
  { key: 'dormitory', hdr: 'Apply for Dormitory' },
  { key: 'payment', hdr: 'Tuition Payment Method' },
  { key: 'folder', hdr: 'Student Folder' },
  { key: 'studentEmail', hdr: 'Student Email Address' },
  { key: 'givenName', hdr: 'First Name' },
  { key: 'familyName', hdr: 'Last Name' },
  { key: 'gender', hdr: 'Gender' },
  { key: 'nationality', hdr: 'Nationality' },
  { key: 'dob', hdr: 'Date of Birth' },
  { key: 'passportNo', hdr: 'Passport Number' },
  { key: 'noPassport', hdr: 'No Passport Number' },
  { key: 'homeCountryAddress', hdr: 'Address in Home Country' },
  { key: 'addressKorea', hdr: 'Address in Korea' },
  { key: 'homeCountryPhone', hdr: 'Phone in Home Country' },
  { key: 'messengerType', hdr: 'Kakao/Wechat/Line' },
  { key: 'messengerId', hdr: 'Messenger ID' },
  { key: 'mobileKR', hdr: 'Phone in Korea' },
  { key: 'hanyangId', hdr: 'Hanyang Student Number' },
  { key: 'prefLanguage', hdr: 'Preferred Language' },
  { key: 'schoolName', hdr: 'School Graduated' },
  { key: 'eduCompletionDate', hdr: 'Date of Degree Obtained' },
  { key: 'highestEdu', hdr: 'Highest Education Level' },
  { key: 'visaApplying', hdr: 'Applying for D-4 VISA' },
  { key: 'visaStatus', hdr: 'VISA Status' },
  { key: 'visaNo', hdr: 'VISA Number' },
  { key: 'visaExpiry', hdr: 'VISA Expiring Date' },
  { key: 'learningExp', hdr: 'Learning Experience' },
  { key: 'instituteName', hdr: 'Name of Institute' },
  { key: 'studyPeriod', hdr: 'Period of Study' },
  { key: 'completedLevel', hdr: 'Completed Level' },
  { key: 'textbookName', hdr: 'Name of Textbook' },
  { key: 'purposeOfStudy', hdr: 'Purpose of Study' },
  { key: 'aimingLevel', hdr: 'Aiming Level to Achieve' },
  { key: 'estimatedPeriod', hdr: 'Estimated Enrollment Period' },
  { key: 'emergencyName', hdr: 'Emergency Contact Name' },
  { key: 'emergencyRelation', hdr: 'Relation to Applicant' },
  { key: 'emergencyContact', hdr: 'Emergency Contact Number' },
  { key: 'agentCompany', hdr: 'Agent Company Name' },
  { key: 'agentPhone', hdr: 'Agent Phone Number' },
  { key: 'agentEmail', hdr: 'Agent E-mail' },
  { key: 'personalStatement', hdr: 'Personal Statement' },
  { key: 'studyPlanText', hdr: 'Study Plan' },
];

const headerText = (h: unknown): string => String(h ?? '').replace(/^[★*\s]+/, '').trim();

/** Columns the portal treats as calendar dates. */
const DATE_KEYS = new Set<keyof Student>(['dob', 'eduCompletionDate', 'visaExpiry']);
const pad = (n: number) => String(n).padStart(2, '0');

/** Excel date serial (1900 system) -> YYYY-MM-DD, in UTC to avoid timezone drift. */
export function excelSerialToISO(serial: number): string {
  const d = new Date(Math.round((serial - 25569) * 86_400_000));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Normalize a cell to a string, converting date-formatted cells to YYYY-MM-DD. */
function cellToStr(key: keyof Student, raw: unknown): string {
  if (raw == null || raw === '') return '';
  if (raw instanceof Date) return `${raw.getUTCFullYear()}-${pad(raw.getUTCMonth() + 1)}-${pad(raw.getUTCDate())}`;
  if (DATE_KEYS.has(key) && typeof raw === 'number') return excelSerialToISO(raw);
  return String(raw).trim();
}

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
    const col = TEMPLATE_COLS.find((c) => c.hdr === headerText(h));
    if (col && !colOf.has(col.key)) colOf.set(col.key, j);
  });

  const out: Student[] = [];
  for (let i = dataStart - 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const s = emptyStudent(i + 1);
    for (const [key, j] of colOf) s[key] = cellToStr(key, row[j]);
    if (!s.studentEmail && !s.givenName && !s.familyName && !s.folder) continue; // skip blanks
    out.push(s);
  }
  return out;
}
