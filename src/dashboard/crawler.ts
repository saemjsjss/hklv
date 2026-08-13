/**
 * Read-only crawler.
 *
 * Visits the in-scope dashboard pages, runs the shared extractor on each, and
 * assembles a Snapshot. In offline mode it reads the local fixture once (as the
 * dashboard/index page) so the whole pipeline can run without credentials.
 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { config, isOffline, pageUrl } from '../config.js';
import { log } from '../util/log.js';
import type { Metric, NavItem, PageSnapshot, Snapshot } from '../types.js';
import { toPageSnapshot } from '../browser/extractors.js';
import type { BrowserDriver } from '../browser/driver.js';
import { DEFAULT_CRAWL } from './sitemap.js';

function dedupeMetrics(metrics: Metric[]): Metric[] {
  const seen = new Set<string>();
  const out: Metric[] = [];
  for (const m of metrics) {
    const key = `${m.section ?? ''}:${m.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

function errorPage(path: string, err: unknown): PageSnapshot {
  return {
    url: path,
    title: '',
    structureHash: 'error',
    metrics: [],
    tables: [],
    capturedAt: new Date().toISOString(),
    error: (err as Error).message,
  };
}

export interface CrawlOptions {
  /** Paths to visit; defaults to the sitemap's DEFAULT_CRAWL. */
  paths?: string[];
  /** Force offline mode against this fixture file (overrides config). */
  offlineFixture?: string;
}

/** Crawl the dashboard (or the offline fixture) into a Snapshot. */
export async function crawl(driver: BrowserDriver, opts: CrawlOptions = {}): Promise<Snapshot> {
  const pages: Record<string, PageSnapshot> = {};
  let nav: NavItem[] = [];
  const fixture = opts.offlineFixture ?? config.offlineFixture;
  const offline = Boolean(opts.offlineFixture) || isOffline();

  if (offline) {
    const fileUrl = pathToFileURL(resolve(fixture)).href;
    log.info('Offline mode — reading fixture:', fixture);
    await driver.goto(fileUrl);
    const snap = toPageSnapshot(await driver.extract(), 'index.php', { includeNav: true });
    pages['index.php'] = snap;
    nav = snap.nav ?? [];
  } else {
    const paths = opts.paths ?? DEFAULT_CRAWL;
    for (const path of paths) {
      const isIndex = path === 'index.php';
      try {
        await driver.goto(pageUrl(path));
        const snap = toPageSnapshot(await driver.extract(), path, { includeNav: isIndex });
        pages[path] = snap;
        if (isIndex && snap.nav) nav = snap.nav;
        log.debug(`Read ${path}: ${snap.metrics.length} metrics, ${snap.tables.length} tables.`);
      } catch (err) {
        pages[path] = errorPage(path, err);
        log.warn(`Failed to read ${path}:`, (err as Error).message);
      }
    }
  }

  const index = pages['index.php'];
  const headline = dedupeMetrics(
    index ? index.metrics : Object.values(pages).flatMap((p) => p.metrics),
  );

  return {
    capturedAt: new Date().toISOString(),
    source: offline ? `fixture:${fixture}` : config.dashboard.baseUrl,
    pages,
    headline,
    nav,
  };
}
