/** Resolve a student's upload files from their folder by standard base name. */
import { existsSync, readdirSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

/** The student's upload directory: a full path if given, else a name under uploads/. */
export function studentDir(uploadsDir: string, folder: string): string {
  const f = folder.trim().replace(/[\\/]+$/, '');
  return isAbsolute(f) ? f : join(uploadsDir, f);
}

/** Find `<base>.jpg|jpeg|png|pdf` (case-insensitive) inside the student's folder. */
export function resolveUpload(
  uploadsDir: string,
  folder: string,
  base: string,
): string | undefined {
  if (!folder) return undefined;
  const dir = studentDir(uploadsDir, folder);
  if (!existsSync(dir)) return undefined;
  const rx = new RegExp(`^${base}\\.(jpe?g|png|pdf)$`, 'i');
  const match = readdirSync(dir).find((f) => rx.test(f));
  return match ? join(dir, match) : undefined;
}
