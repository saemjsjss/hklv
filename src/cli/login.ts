/**
 * Phase-1 deliverable: log in and print the current dashboard state.
 *
 *   npm run agent:login
 *
 * Reuses a saved session if present, otherwise logs in with the admin
 * credentials from `.env`, then crawls the in-scope pages and prints a briefing
 * whose numbers should match the live site. Read-only — nothing is changed.
 */
import { withDriver, collect } from '../pipeline.js';
import { isOffline } from '../config.js';

async function main(): Promise<void> {
  await withDriver(
    async (driver) => {
      const { text, snap } = await collect(driver);
      console.log('\n' + text + '\n');
      const readable = Object.values(snap.pages).filter((p) => !p.error).length;
      console.error(
        `Read ${readable}/${Object.keys(snap.pages).length} page(s) from ${snap.source}` +
          (isOffline() ? ' (offline fixture).' : '.'),
      );
    },
    { login: true },
  );
}

main().catch((err: unknown) => {
  console.error('\n❌ login/read failed:');
  console.error((err as Error).message);
  process.exitCode = 1;
});
