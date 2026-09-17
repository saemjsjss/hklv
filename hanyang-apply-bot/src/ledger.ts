/** Append one line per student to output/submissions.csv (git-ignored). */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

/** Emails of students already recorded as submitted, so a re-run won't double-submit. */
export function readSubmitted(outputDir: string): Set<string> {
  const set = new Set<string>();
  const file = join(outputDir, 'submissions.csv');
  if (!existsSync(file)) return set;
  const lines = readFileSync(file, 'utf8').split(/\r?\n/).slice(1); // drop header
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = parseCsvLine(line); // timestamp,rowNum,folder,accountEmail,studentEmail,password,status,notes
    const email = (cols[4] ?? '').trim().toLowerCase();
    const status = (cols[6] ?? '').toLowerCase();
    if (email && status.includes('submitted')) set.add(email);
  }
  return set;
}

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
