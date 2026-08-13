/**
 * Shared runtime pipeline used by the CLIs and the scheduler.
 *
 * `withDriver` handles launch → (login) → teardown. `collect` performs one full
 * read: crawl, diff against the previous snapshot, persist, and render the
 * briefing. `aiIntro` optionally adds a one-line AI summary on top.
 */
import { isOffline } from './config.js';
import { createDriver, type BrowserDriver } from './browser/driver.js';
import { ensureLoggedIn } from './browser/session.js';
import { crawl } from './dashboard/crawler.js';
import { diffSnapshots } from './dashboard/changes.js';
import { latestSnapshot, saveSnapshot } from './dashboard/knowledge.js';
import { computeDuties, renderBriefing } from './ai/briefing.js';
import { aiConfigured, ask } from './ai/brain.js';
import type { Change, Duty, Snapshot } from './types.js';

export async function withDriver<T>(
  fn: (driver: BrowserDriver) => Promise<T>,
  opts: { login?: boolean } = {},
): Promise<T> {
  const driver = await createDriver();
  await driver.launch();
  try {
    if (opts.login && !isOffline()) await ensureLoggedIn(driver);
    return await fn(driver);
  } finally {
    await driver.close();
  }
}

export interface Collected {
  snap: Snapshot;
  changes: Change[];
  duties: Duty[];
  text: string;
}

/** One full read: crawl, diff vs previous, persist, render. */
export async function collect(driver: BrowserDriver): Promise<Collected> {
  const previous = latestSnapshot();
  const snap = await crawl(driver);
  const changes = previous ? diffSnapshots(previous, snap) : [];
  saveSnapshot(snap);
  const duties = computeDuties(snap);
  const text = renderBriefing(snap, changes, duties);
  return { snap, changes, duties, text };
}

/**
 * Optional one-line AI summary to sit atop the deterministic briefing. Kept
 * separate so the reliable, number-accurate briefing is never rewritten by the
 * model — the AI only adds a short focus line.
 */
export async function aiIntro(briefing: string): Promise<string | null> {
  if (!aiConfigured()) return null;
  try {
    const line = await ask(
      'You are the operations assistant for a manager at a Korean study-abroad/visa consultancy. ' +
        'In ONE short, friendly sentence, tell them the single most important thing to focus on today. ' +
        'Do not repeat raw numbers and do not invent facts — base it only on the briefing.',
      briefing,
      { maxTokens: 120 },
    );
    return line.trim() || null;
  } catch {
    return null;
  }
}
