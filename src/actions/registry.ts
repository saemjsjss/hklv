/**
 * Action registry.
 *
 * Actions are things the agent can DO on the dashboard. Every action here is a
 * write (state-changing) operation and is therefore confirm-gated: the agent
 * always asks the manager in Telegram before running one (per the approved
 * "ask before every action" policy). Read-only capabilities live in ai/tools.ts.
 *
 * Because the exact markup of the action pages (reminders.php, notice.php) was
 * not available at build time, each action locates its controls defensively (by
 * visible text) and allows a selector override via env. On first use, run once
 * with HKLV_HEADLESS=false to confirm the controls are found.
 */
import { pageUrl } from '../config.js';
import { sleep } from '../util/async.js';
import type { BrowserDriver } from '../browser/driver.js';

export interface ActionContext {
  driver: BrowserDriver;
  args: Record<string, unknown>;
}

export interface ActionDef {
  id: string;
  /** Short description used in the AI tool spec. */
  description: string;
  /** JSON-schema parameters exposed to the AI. */
  parameters: Record<string, unknown>;
  risk: 'low' | 'medium' | 'high';
  /** Human-readable confirmation prompt shown in Telegram before running. */
  confirmPrompt: (args: Record<string, unknown>) => string;
  /** Perform the action; returns a short result summary. Throws on failure. */
  run: (ctx: ActionContext) => Promise<string>;
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

const sendReminders: ActionDef = {
  id: 'send_reminders',
  description:
    'Send document reminders to students who are missing required documents, via the Document Reminders page.',
  parameters: {
    type: 'object',
    properties: {
      note: { type: 'string', description: 'Optional extra note to include, if the page supports it.' },
    },
  },
  risk: 'medium',
  confirmPrompt: () =>
    'Send document reminders to the students who are missing documents?\n' +
    'I will open the Document Reminders page and trigger the send.',
  run: async ({ driver }) => {
    await driver.goto(pageUrl('reminders.php'));
    await sleep(500);
    const custom = process.env.HKLV_SEL_SEND_REMINDERS;
    if (custom) {
      await driver.click(custom);
    } else {
      const clicked =
        (await driver.clickByText('Send Reminders')) ||
        (await driver.clickByText('Send All')) ||
        (await driver.clickByText('Send Reminder')) ||
        (await driver.clickByText('Send'));
      if (!clicked) {
        throw new Error(
          'Could not find the send button on reminders.php. Set HKLV_SEL_SEND_REMINDERS in .env to its CSS selector.',
        );
      }
    }
    await sleep(1000);
    return 'Document reminders triggered on reminders.php.';
  },
};

const sendNotice: ActionDef = {
  id: 'send_notice',
  description: 'Post a broadcast notice to students via the Send Notice page.',
  parameters: {
    type: 'object',
    properties: {
      message: { type: 'string', description: 'The notice text to send.' },
      title: { type: 'string', description: 'Optional notice title/subject.' },
    },
    required: ['message'],
  },
  risk: 'high',
  confirmPrompt: (args) =>
    `Post this notice to students?\n\n${str(args.title) ? `Title: ${str(args.title)}\n` : ''}"${str(args.message)}"`,
  run: async ({ driver, args }) => {
    const message = str(args.message);
    if (!message) throw new Error('No message provided for the notice.');
    await driver.goto(pageUrl('notice.php'));
    await sleep(500);

    const titleSel = process.env.HKLV_SEL_NOTICE_TITLE ?? 'input[name="title"], input[name="subject"]';
    const msgSel =
      process.env.HKLV_SEL_NOTICE_MSG ?? 'textarea, textarea[name="message"], input[name="message"]';

    if (str(args.title) && (await driver.exists(titleSel))) {
      await driver.fill(titleSel, str(args.title));
    }
    if (!(await driver.exists(msgSel))) {
      throw new Error(
        'Could not find the notice message field on notice.php. Set HKLV_SEL_NOTICE_MSG in .env.',
      );
    }
    await driver.fill(msgSel, message);

    const custom = process.env.HKLV_SEL_NOTICE_SUBMIT;
    if (custom) {
      await driver.click(custom);
    } else {
      const clicked =
        (await driver.clickByText('Send Notice')) ||
        (await driver.clickByText('Publish')) ||
        (await driver.clickByText('Send'));
      if (!clicked) {
        throw new Error(
          'Could not find the submit button on notice.php. Set HKLV_SEL_NOTICE_SUBMIT in .env.',
        );
      }
    }
    await sleep(1000);
    return 'Notice posted on notice.php.';
  },
};

export const ACTIONS: Record<string, ActionDef> = {
  [sendReminders.id]: sendReminders,
  [sendNotice.id]: sendNotice,
};

export function isAction(name: string): boolean {
  return name in ACTIONS;
}
