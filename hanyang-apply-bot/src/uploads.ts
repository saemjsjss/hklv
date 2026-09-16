/** Resolve a student's upload files from their folder by standard base name. */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Find `<base>.jpg|jpeg|png|pdf` (case-insensitive) inside uploadsDir/folder. */
export function resolveUpload(
  uploadsDir: string,
  folder: string,
  base: string,
): string | undefined {
  if (!folder) return undefined;
  const dir = join(uploadsDir, folder);
  if (!existsSync(dir)) return undefined;
  const rx = new RegExp(`^${base}\\.(jpe?g|png|pdf)$`, 'i');
  const match = readdirSync(dir).find((f) => rx.test(f));
  return match ? join(dir, match) : undefined;
}
