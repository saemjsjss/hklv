/**
 * Offline self-test — the verification path that needs no credentials.
 *
 * Launches real Chromium (via Playwright), runs the full read pipeline against
 * the synthetic fixture, and asserts the extractor, duties engine, change
 * detector and briefing renderer all work end-to-end.
 *
 *   npm run agent:selftest
 */
import { PlaywrightDriver } from '../browser/driver.js';
import { crawl } from '../dashboard/crawler.js';
import { diffSnapshots } from '../dashboard/changes.js';
import { computeDuties, renderBriefing } from '../ai/briefing.js';
import type { Snapshot } from '../types.js';

const FIXTURE = process.env.HKLV_FIXTURE || 'fixtures/dashboard.sample.html';

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(`SELF-TEST FAILED: ${msg}`);
}

async function main(): Promise<void> {
  const driver = new PlaywrightDriver();
  await driver.launch();
  try {
    const snap = await crawl(driver, { offlineFixture: FIXTURE });

    console.log('\n=== EXTRACTION ===');
    console.log(`Source:           ${snap.source}`);
    console.log(`Nav items:        ${snap.nav.length}`);
    console.log(`Headline metrics: ${snap.headline.length}`);
    console.log(`Tables on index:  ${snap.pages['index.php']?.tables.length ?? 0}`);
    assert(snap.nav.length >= 5, 'expected sidebar nav items to be extracted');
    assert(snap.headline.length >= 4, 'expected headline metrics to be extracted');
    assert((snap.pages['index.php']?.tables.length ?? 0) >= 1, 'expected the students table');
    assert(
      snap.nav.some((n) => n.label === 'Consultation Requests' && n.badge === 7),
      'expected the Consultation Requests badge (7) to be parsed',
    );

    const duties = computeDuties(snap);
    console.log('\n=== DUTIES ===');
    for (const d of duties) console.log(`[p${d.priority}] ${d.title}`);
    assert(duties.length >= 2, 'expected at least two duties');
    assert(duties.some((d) => d.action === 'send_reminders'), 'expected a missing-documents duty');

    // Simulate the CEO changing the dashboard between runs, then diff.
    const previous: Snapshot = JSON.parse(JSON.stringify(snap));
    const missing = previous.headline.find((m) => /missing documents/i.test(m.label));
    if (missing) missing.value -= 5;
    previous.nav = previous.nav.filter((n) => n.label !== 'Send Notice');
    const changes = diffSnapshots(previous, snap);
    console.log('\n=== CHANGES (simulated previous run) ===');
    for (const c of changes) console.log(`• ${c.summary}`);
    assert(changes.length >= 2, 'expected simulated metric + nav changes to be detected');
    assert(changes.some((c) => c.kind === 'nav-added'), 'expected the re-added menu item');

    console.log('\n=== BRIEFING PREVIEW ===\n');
    console.log(renderBriefing(snap, changes, duties));

    console.log('\n✅ Self-test passed.\n');
  } finally {
    await driver.close();
  }
}

main().catch((err: unknown) => {
  console.error('\n❌ Self-test error:');
  console.error(err);
  process.exitCode = 1;
});
