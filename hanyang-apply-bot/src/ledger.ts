/** Append one line per student to output/submissions.csv (git-ignored). */
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface LedgerRow {
  rowNum: number;
  folder: string;
  accountEmail: string;
  studentEmail: string;
  password: string;
  status: string;
  notes: string;
}

const esc = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;

export function recordSubmission(outputDir: string, rec: LedgerRow): void {
  mkdirSync(outputDir, { recursive: true });
  const file = join(outputDir, 'submissions.csv');
  if (!existsSync(file)) {
    writeFileSync(file, 'timestamp,rowNum,folder,accountEmail,studentEmail,password,status,notes\n');
  }
  const line = [
    new Date().toISOString(),
    rec.rowNum,
    rec.folder,
    rec.accountEmail,
    rec.studentEmail,
    rec.password,
    rec.status,
    rec.notes,
  ]
    .map(esc)
    .join(',');
  appendFileSync(file, line + '\n');
}
