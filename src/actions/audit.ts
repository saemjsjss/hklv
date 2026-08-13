/**
 * Append-only audit log.
 *
 * Every action the agent takes — and every confirmation decision — is recorded
 * locally as one JSON object per line. This is the agent's own record, separate
 * from (and complementary to) the dashboard's built-in audit_log.php.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from '../config.js';
import { log } from '../util/log.js';

export type AuditResult = 'read' | 'confirmed' | 'executed' | 'declined' | 'error';

export interface AuditEntry {
  at: string;
  kind: string;
  summary: string;
  result: AuditResult;
  detail?: unknown;
}

export function audit(entry: Omit<AuditEntry, 'at'>): void {
  const line = JSON.stringify({ at: new Date().toISOString(), ...entry });
  try {
    mkdirSync(dirname(config.paths.auditLog), { recursive: true });
    appendFileSync(config.paths.auditLog, line + '\n');
    log.debug('AUDIT', entry.result, entry.kind, '-', entry.summary);
  } catch (err) {
    log.warn('Could not write audit log:', (err as Error).message);
  }
}

export function readAudit(limit = 50): AuditEntry[] {
  if (!existsSync(config.paths.auditLog)) return [];
  const lines = readFileSync(config.paths.auditLog, 'utf8').trim().split('\n').filter(Boolean);
  return lines
    .slice(-limit)
    .map((l) => {
      try {
        return JSON.parse(l) as AuditEntry;
      } catch {
        return null;
      }
    })
    .filter((e): e is AuditEntry => e !== null);
}
