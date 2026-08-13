/**
 * Morning briefing entrypoint — meant to be run by the OS scheduler.
 *
 *   npm run agent:morning
 *
 * Schedule it with cron (Linux/macOS) or Task Scheduler (Windows). Since it runs
 * on the manager's own computer, it only fires while that machine is on.
 * Example cron (08:00 daily):
 *   0 8 * * *  cd /path/to/hklv && npm run agent:morning >> data/morning.log 2>&1
 */
import { config } from '../config.js';
import { log } from '../util/log.js';
import { withDriver, collect, aiIntro } from '../pipeline.js';
import { createTelegram } from '../channel/telegram.js';

async function main(): Promise<void> {
  await withDriver(
    async (driver) => {
      const { text } = await collect(driver);
      const intro = await aiIntro(text);
      const out = intro ? `🌅 Good morning!\n📌 ${intro}\n\n${text}` : text;

      if (config.telegram.botToken && config.telegram.ownerId) {
        await createTelegram().sendOwner(out);
        log.info('Morning briefing sent to Telegram.');
      } else {
        console.log(out);
        log.warn('Telegram not configured — printed the briefing to the console instead.');
      }
    },
    { login: true },
  );
}

main().catch((err: unknown) => {
  log.error('Morning briefing failed:', (err as Error).message);
  process.exitCode = 1;
});
