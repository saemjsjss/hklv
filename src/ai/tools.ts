/**
 * Tool specifications and read-tool dispatch for the AI brain.
 *
 * Read tools run freely; write actions (from the action registry) are exposed
 * to the model too, but the agent intercepts them for confirmation before they
 * run — see agent.ts.
 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { config, isOffline, pageUrl } from '../config.js';
import { toPageSnapshot } from '../browser/extractors.js';
import type { BrowserDriver } from '../browser/driver.js';
import { crawl } from '../dashboard/crawler.js';
import { ACTIONS } from '../actions/registry.js';
import { computeDuties } from './briefing.js';
import type { ToolSpec } from './brain.js';

export const READ_TOOLS: ToolSpec[] = [
  {
    type: 'function',
    function: {
      name: 'read_page',
      description:
        'Read a specific dashboard page live and return its metrics and any list table. ' +
        'Pass a path like "students.php?status=pending", "tasks.php", "partner_messages.php" or "audit_log.php".',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'The *.php[?query] path to read.' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'refresh_dashboard',
      description: 'Re-read the dashboard home for the latest headline numbers and duties.',
      parameters: { type: 'object', properties: {} },
    },
  },
];

/** All tool specs offered to the model (read tools + confirm-gated actions). */
export function buildToolSpecs(): ToolSpec[] {
  const actionSpecs: ToolSpec[] = Object.values(ACTIONS).map((a) => ({
    type: 'function',
    function: { name: a.id, description: a.description, parameters: a.parameters },
  }));
  return [...READ_TOOLS, ...actionSpecs];
}

/** Run a read-only tool. Returns null if `name` is not a read tool. */
export async function runReadTool(
  name: string,
  args: Record<string, unknown>,
  driver: BrowserDriver,
): Promise<string | null> {
  if (name === 'read_page') {
    const path = String(args.path ?? 'index.php');
    if (isOffline()) {
      await driver.goto(pathToFileURL(resolve(config.offlineFixture)).href);
    } else {
      await driver.goto(pageUrl(path));
    }
    const snap = toPageSnapshot(await driver.extract(), path, { includeNav: false });
    return JSON.stringify({
      title: snap.title,
      metrics: snap.metrics,
      tables: snap.tables.map((t) => ({
        columns: t.columns,
        rowCount: t.rowCount,
        sample: t.rows.slice(0, 5),
      })),
    });
  }

  if (name === 'refresh_dashboard') {
    const snap = await crawl(driver, { paths: ['index.php'] });
    return JSON.stringify({ source: snap.source, headline: snap.headline, duties: computeDuties(snap) });
  }

  return null;
}
