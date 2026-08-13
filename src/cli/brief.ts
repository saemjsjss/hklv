/**
 * Produce a briefing on demand.
 *
 *   npm run agent:brief            # print to the console
 *   npm run agent:brief -- --send  # also send it to Telegram
 *   npm run agent:brief -- --ai    # prepend a one-line AI focus summary
 *
 * Works offline too: set HKLV_FIXTURE to a saved dashboard HTML file.
 */
import { config } from '../config.js';
import { withDriver, collect, aiIntro } from '../pipeline.js';
import { createTelegram } from '../channel/telegram.js';

async function main(): Promise<void> {
  const wantSend = process.argv.includes('--send');
  const wantAi = process.argv.includes('--ai');

  await withDriver(
    async (driver) => {
      const { text } = await collect(driver);
      let out = text;
      if (wantAi) {
        const intro = await aiIntro(text);
        if (intro) out = `📌 ${intro}\n\n${text}`;
      }
      console.log('\n' + out + '\n');

      if (wantSend) {
        if (!config.telegram.botToken || !config.telegram.ownerId) {
          console.error('Telegram is not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_OWNER_ID); not sending.');
          return;
        }
        await createTelegram().sendOwner(out);
        console.error('Briefing sent to Telegram.');
      }
    },
    { login: true },
  );
}

main().catch((err: unknown) => {
  console.error('\n❌ brief failed:', (err as Error).message);
  process.exitCode = 1;
});
