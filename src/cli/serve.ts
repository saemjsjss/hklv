/**
 * On-demand chat: run the Telegram bot loop.
 *
 *   npm run agent:serve
 *
 * Architecture: a detached POLLER reads Telegram updates continuously — it
 * resolves confirmation button-presses immediately and enqueues text messages.
 * A WORKER processes one message at a time. Keeping them separate is what lets a
 * write action pause for a Yes/No confirmation without deadlocking the poll.
 */
import { requireGroqKey, requireTelegram } from '../config.js';
import { log } from '../util/log.js';
import { sleep } from '../util/async.js';
import { withDriver, collect } from '../pipeline.js';
import { createTelegram } from '../channel/telegram.js';
import { handleUserMessage, contextFromSnapshot, type AgentContext } from '../agent.js';
import type { ChatMessage } from '../ai/brain.js';

const HELP = [
  'HKLV agent — what I can do:',
  '• Ask me anything, e.g. "what needs my attention today?", "how many students are missing documents?"',
  '• I can act on the dashboard (send reminders, post a notice). I will ALWAYS ask you to confirm first.',
  '',
  'Commands:',
  '/brief — fresh briefing right now',
  '/help — this message',
  '/stop — shut the agent down',
].join('\n');

/** Tiny single-consumer async queue. */
class AsyncQueue<T> {
  private items: T[] = [];
  private waiters: ((v: T) => void)[] = [];
  push(item: T): void {
    const w = this.waiters.shift();
    if (w) w(item);
    else this.items.push(item);
  }
  pop(): Promise<T> {
    const it = this.items.shift();
    if (it !== undefined) return Promise.resolve(it);
    return new Promise((resolve) => this.waiters.push(resolve));
  }
}

async function main(): Promise<void> {
  requireTelegram();
  requireGroqKey();
  const tg = createTelegram();

  await withDriver(
    async (driver) => {
      let collected = await collect(driver);
      let ctx: AgentContext = contextFromSnapshot(collected.snap, collected.changes);
      const history: ChatMessage[] = [];
      const queue = new AsyncQueue<string>();
      // Single outstanding confirmation; a mutable ref so both the worker
      // (which sets it) and the poller (which clears it) share one slot.
      const confirmState: { resolve: ((approved: boolean) => void) | null } = { resolve: null };
      let running = true;

      const confirm = (prompt: string): Promise<boolean> =>
        new Promise<boolean>((resolve) => {
          const timer = setTimeout(
            () => {
              if (confirmState.resolve) {
                confirmState.resolve = null;
                resolve(false);
              }
            },
            5 * 60 * 1000,
          );
          confirmState.resolve = (approved) => {
            clearTimeout(timer);
            resolve(approved);
          };
          void tg
            .sendOwner(`⚠️ Confirm action:\n\n${prompt}\n\n(Auto-cancels in 5 minutes.)`, [
              ['✅ Yes', 'confirm:yes'],
              ['❌ No', 'confirm:no'],
            ])
            .catch((err) => log.error('Failed to send confirmation:', (err as Error).message));
        });

      const say = (text: string): Promise<void> => tg.sendOwner(text).then(() => undefined);

      // Detached poller.
      const poller = (async () => {
        while (running) {
          let updates;
          try {
            updates = await tg.poll(30);
          } catch (err) {
            log.warn('Telegram poll error:', (err as Error).message);
            await sleep(2000);
            continue;
          }
          for (const u of updates) {
            if (u.callback) {
              const yes = u.callback.data === 'confirm:yes';
              await tg.answerCallback(u.callback.id, yes ? 'Approved ✅' : 'Cancelled ❌').catch(() => {});
              const cb = confirmState.resolve;
              confirmState.resolve = null;
              if (cb) cb(yes);
            } else if (u.message) {
              queue.push(u.message.text.trim());
            }
          }
        }
      })().catch((err) => log.error('Poller crashed:', (err as Error).message));

      await tg.sendOwner(
        '🤖 HKLV agent online. Ask me "what needs my attention?" or send /brief. /help for more.',
      );
      log.info('Agent serving. Waiting for messages…');

      // Worker: one message at a time.
      while (running) {
        const text = await queue.pop();
        if (!text) continue;

        if (text === '/help' || text === '/start') {
          await tg.sendOwner(HELP);
          continue;
        }
        if (text === '/stop') {
          await tg.sendOwner('Shutting down. 👋');
          running = false;
          break;
        }
        if (text === '/brief') {
          collected = await collect(driver);
          ctx = contextFromSnapshot(collected.snap, collected.changes);
          await tg.sendOwner(collected.text);
          continue;
        }

        try {
          const reply = await handleUserMessage(text, history, { driver, context: ctx, confirm, say });
          history.push({ role: 'user', content: text }, { role: 'assistant', content: reply });
          while (history.length > 12) history.shift();
          await tg.sendOwner(reply);
        } catch (err) {
          await tg.sendOwner(`⚠️ ${(err as Error).message}`);
        }
      }

      await poller.catch(() => undefined);
    },
    { login: true },
  );
}

main().catch((err: unknown) => {
  log.error('serve failed:', (err as Error).message);
  process.exitCode = 1;
});
