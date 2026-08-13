/**
 * Minimal Telegram Bot API client (dependency-free, via fetch).
 *
 * Covers exactly what the agent needs: long-poll for updates, send messages
 * (optionally with inline Yes/No buttons), and answer callback queries. The bot
 * is locked to a single owner id — updates from anyone else are ignored.
 */
import { config } from '../config.js';
import { log } from '../util/log.js';
import { withRetry } from '../util/async.js';

export interface TgMessage {
  chatId: number;
  fromId: number;
  text: string;
}

export interface TgCallback {
  id: string;
  fromId: number;
  data: string;
  messageId: number;
  chatId: number;
}

export interface TgUpdate {
  updateId: number;
  message?: TgMessage;
  callback?: TgCallback;
}

interface RawUpdate {
  update_id: number;
  message?: { chat: { id: number }; from?: { id: number }; text?: string };
  callback_query?: {
    id: string;
    from: { id: number };
    data?: string;
    message?: { message_id: number; chat: { id: number } };
  };
}

/** Split text into <= maxLen chunks, preferring line boundaries. */
function splitText(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let current = '';
  for (const line of text.split('\n')) {
    if (line.length > maxLen) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      for (let i = 0; i < line.length; i += maxLen) chunks.push(line.slice(i, i + maxLen));
      continue;
    }
    if ((current + '\n' + line).length > maxLen) {
      chunks.push(current);
      current = line;
    } else {
      current = current ? `${current}\n${line}` : line;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export class Telegram {
  private offset = 0;
  constructor(
    private readonly token: string,
    readonly ownerId: string,
  ) {}

  private api(method: string): string {
    return `https://api.telegram.org/bot${this.token}/${method}`;
  }

  private async call<T>(method: string, body: Record<string, unknown>): Promise<T> {
    return withRetry(
      async () => {
        const res = await fetch(this.api(method), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as { ok: boolean; result?: T; description?: string };
        if (!data.ok) throw new Error(`Telegram ${method} failed: ${data.description}`);
        return data.result as T;
      },
      { retries: 3, baseMs: 1000, label: `telegram:${method}` },
    );
  }

  /**
   * Send a plain-text message, optionally with inline buttons `[label,data]`.
   * Long text is split into Telegram-sized chunks; buttons attach to the last.
   */
  async send(chatId: number | string, text: string, buttons?: [string, string][]): Promise<number> {
    const chunks = splitText(text, 3900);
    let lastId = 0;
    for (let i = 0; i < chunks.length; i++) {
      const isLast = i === chunks.length - 1;
      const body: Record<string, unknown> = {
        chat_id: chatId,
        text: chunks[i],
        disable_web_page_preview: true,
      };
      if (isLast && buttons?.length) {
        body.reply_markup = {
          inline_keyboard: [buttons.map(([label, data]) => ({ text: label, callback_data: data }))],
        };
      }
      const msg = await this.call<{ message_id: number }>('sendMessage', body);
      lastId = msg.message_id;
    }
    return lastId;
  }

  /** Send to the configured owner. */
  async sendOwner(text: string, buttons?: [string, string][]): Promise<number> {
    return this.send(this.ownerId, text, buttons);
  }

  async answerCallback(id: string, text = ''): Promise<void> {
    await this.call('answerCallbackQuery', { callback_query_id: id, text });
  }

  /** Long-poll for the next batch of updates from the owner. */
  async poll(timeoutSec = 30): Promise<TgUpdate[]> {
    const raw = await this.call<RawUpdate[]>('getUpdates', {
      offset: this.offset,
      timeout: timeoutSec,
      allowed_updates: ['message', 'callback_query'],
    });
    const updates: TgUpdate[] = [];
    for (const u of raw) {
      this.offset = Math.max(this.offset, u.update_id + 1);
      const upd: TgUpdate = { updateId: u.update_id };
      if (u.message?.text && u.message.from) {
        upd.message = {
          chatId: u.message.chat.id,
          fromId: u.message.from.id,
          text: u.message.text,
        };
      }
      if (u.callback_query?.message) {
        upd.callback = {
          id: u.callback_query.id,
          fromId: u.callback_query.from.id,
          data: u.callback_query.data ?? '',
          messageId: u.callback_query.message.message_id,
          chatId: u.callback_query.message.chat.id,
        };
      }
      // Owner lock: drop anything not from the configured owner.
      const fromId = upd.message?.fromId ?? upd.callback?.fromId;
      if (fromId !== undefined && String(fromId) !== this.ownerId) {
        log.warn(`Ignoring update from non-owner id ${fromId}.`);
        continue;
      }
      if (upd.message || upd.callback) updates.push(upd);
    }
    return updates;
  }
}

export function createTelegram(): Telegram {
  return new Telegram(config.telegram.botToken, config.telegram.ownerId);
}
