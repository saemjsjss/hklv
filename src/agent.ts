/**
 * Agent core.
 *
 * Wires the Telegram conversation to the Groq brain and the tool/action layer.
 * Read tools run automatically; write actions are always confirmed with the
 * manager first (the "ask before every action" policy) and every decision is
 * audited.
 */
import type { Change, Duty, Snapshot } from './types.js';
import type { BrowserDriver } from './browser/driver.js';
import { chat, type ChatMessage } from './ai/brain.js';
import { buildToolSpecs, runReadTool } from './ai/tools.js';
import { ACTIONS } from './actions/registry.js';
import { audit } from './actions/audit.js';
import { computeDuties } from './ai/briefing.js';

export interface AgentContext {
  snap: Snapshot;
  duties: Duty[];
  changes: Change[];
}

export interface AgentDeps {
  driver: BrowserDriver;
  context: AgentContext;
  /** Ask the manager to approve an action; resolves true only on explicit yes. */
  confirm: (prompt: string) => Promise<boolean>;
  /** Send an interim status line to the manager. */
  say: (text: string) => Promise<void>;
}

function buildSystemPrompt(ctx: AgentContext): string {
  const duties = ctx.duties.length
    ? ctx.duties.map((d, i) => `${i + 1}. ${d.title} — ${d.detail}`).join('\n')
    : 'Nothing urgent right now.';
  const headline = ctx.snap.headline.map((m) => `${m.label}: ${m.value}`).join(', ');
  const changes = ctx.changes.length
    ? ctx.changes.map((c) => c.summary).join('; ')
    : 'No changes since the last check.';
  const nav = ctx.snap.nav.map((n) => n.label).join(', ');

  return [
    'You are the operations assistant for a manager at Hangeul Korean Language & Visa (HKLV),',
    'a Bangladesh-based study-abroad and Korean student-visa consultancy. You help the manager',
    'understand and run their admin dashboard: summarizing status, telling them their duties, and',
    'performing actions on the dashboard when asked.',
    '',
    'Style: reply in short, plain English. Be concrete and cite the real numbers below. Never invent',
    'numbers — if you are unsure, use the read_page or refresh_dashboard tools to check live.',
    '',
    'Acting policy: you may call action tools (e.g. send_reminders, send_notice), but the system will',
    'ALWAYS ask the manager to confirm before anything actually happens, so never claim an action is',
    'done unless the tool result says it was executed. If the manager declines, do not retry.',
    '',
    `Current dashboard source: ${ctx.snap.source}`,
    `Headline numbers: ${headline}`,
    `What changed since last check: ${changes}`,
    `Today's duties:\n${duties}`,
    '',
    `Available dashboard sections: ${nav}`,
  ].join('\n');
}

function parseArgs(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw || '{}') as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Handle one user message. `history` holds prior user/assistant turns (text
 * only). Returns the assistant's final reply. Does not mutate `history`.
 */
export async function handleUserMessage(
  text: string,
  history: ChatMessage[],
  deps: AgentDeps,
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(deps.context) },
    ...history,
    { role: 'user', content: text },
  ];
  const tools = buildToolSpecs();

  for (let step = 0; step < 6; step++) {
    const res = await chat(messages, { tools, toolChoice: 'auto' });

    if (res.toolCalls.length === 0) {
      return res.content || '(no reply)';
    }

    // Record the assistant's tool-call turn, then resolve each call.
    messages.push({ role: 'assistant', content: res.content || null, tool_calls: res.toolCalls });

    for (const call of res.toolCalls) {
      const name = call.function.name;
      const args = parseArgs(call.function.arguments);
      let content: string;

      if (name in ACTIONS) {
        const action = ACTIONS[name];
        const prompt = action.confirmPrompt(args);
        const approved = await deps.confirm(prompt);
        if (!approved) {
          audit({ kind: name, summary: prompt, result: 'declined', detail: args });
          content = 'The manager DECLINED this action. Do not attempt it again.';
        } else {
          audit({ kind: name, summary: prompt, result: 'confirmed', detail: args });
          try {
            await deps.say('Working on it…');
            const result = await action.run({ driver: deps.driver, args });
            audit({ kind: name, summary: result, result: 'executed', detail: args });
            content = `Executed. ${result}`;
          } catch (err) {
            const msg = (err as Error).message;
            audit({ kind: name, summary: msg, result: 'error', detail: args });
            content = `Action failed: ${msg}`;
          }
        }
      } else {
        try {
          const readResult = await runReadTool(name, args, deps.driver);
          content = readResult ?? `Unknown tool: ${name}`;
          audit({ kind: name, summary: `read ${JSON.stringify(args)}`, result: 'read' });
        } catch (err) {
          content = `Read failed: ${(err as Error).message}`;
        }
      }

      messages.push({ role: 'tool', tool_call_id: call.id, content });
    }
  }

  return 'I hit the tool-step limit before finishing. Please try rephrasing or ask me to do one thing at a time.';
}

/** Recompute the agent context (duties) from a fresh snapshot. */
export function contextFromSnapshot(snap: Snapshot, changes: Change[]): AgentContext {
  return { snap, duties: computeDuties(snap), changes };
}
