/**
 * Knowledge base: persistence for snapshots plus a human-readable summary.
 *
 * Snapshots are stored as timestamped JSON under `data/snapshots/`. The most
 * recent prior snapshot is what change-detection diffs against. A `knowledge.md`
 * summary (sitemap + current KPIs) is regenerated for humans and as compact AI
 * context.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config.js';
import { log } from '../util/log.js';
import type { Snapshot } from '../types.js';

function ensureDir(): void {
  mkdirSync(config.paths.snapshotsDir, { recursive: true });
}

/** Save a snapshot; returns the file path written. */
export function saveSnapshot(snap: Snapshot): string {
  ensureDir();
  const name = `${snap.capturedAt.replace(/[:.]/g, '-')}.json`;
  const file = join(config.paths.snapshotsDir, name);
  writeFileSync(file, JSON.stringify(snap, null, 2));
  writeKnowledgeBase(snap);
  log.debug('Snapshot saved:', file);
  return file;
}

function snapshotFiles(): string[] {
  ensureDir();
  return readdirSync(config.paths.snapshotsDir)
    .filter((f) => f.endsWith('.json'))
    .sort();
}

/** The most recent stored snapshot, if any (used as the diff baseline). */
export function latestSnapshot(): Snapshot | undefined {
  const files = snapshotFiles();
  const last = files.at(-1);
  if (!last) return undefined;
  return JSON.parse(readFileSync(join(config.paths.snapshotsDir, last), 'utf8')) as Snapshot;
}

/** Regenerate the human/AI-readable knowledge summary from a snapshot. */
export function writeKnowledgeBase(snap: Snapshot): void {
  ensureDir();
  const lines: string[] = [];
  lines.push('# HKLV Dashboard — Knowledge Base');
  lines.push('');
  lines.push(`_Last updated ${snap.capturedAt} from ${snap.source}_`);
  lines.push('');
  lines.push('## Sitemap (from live sidebar)');
  const byGroup = new Map<string, string[]>();
  for (const n of snap.nav) {
    const arr = byGroup.get(n.group) ?? [];
    const badge = n.badge !== undefined ? ` (${n.badge})` : '';
    arr.push(`- ${n.label}${badge}`);
    byGroup.set(n.group, arr);
  }
  for (const [group, items] of byGroup) {
    lines.push(`### ${group}`);
    lines.push(...items);
    lines.push('');
  }
  lines.push('## Headline numbers');
  for (const m of snap.headline) lines.push(`- ${m.label}: ${m.value}`);
  lines.push('');
  writeFileSync(join(config.paths.dataDir, 'knowledge.md'), lines.join('\n'));
}

/** Load an arbitrary snapshot JSON file (for tooling/tests). */
export function readSnapshotFile(path: string): Snapshot {
  if (!existsSync(path)) throw new Error(`Snapshot not found: ${path}`);
  return JSON.parse(readFileSync(path, 'utf8')) as Snapshot;
}
