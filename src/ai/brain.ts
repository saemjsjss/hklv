/**
 * The AI "brain": a thin, dependency-free client for Groq's OpenAI-compatible
 * chat API, with automatic model failover and tool-calling support.
 *
 * The model chain comes from config (primary first, fallbacks after). If the
 * primary is rate-limited or errors, the next model is tried automatically.
 */
import { config, requireGroqKey } from '../config.js';
import { log } from '../util/log.js';
import { withRetry } from '../util/async.js';

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolSpec {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatOptions {
  tools?: ToolSpec[];
  toolChoice?: 'auto' | 'none' | 'required';
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResult {
  content: string;
  toolCalls: ToolCall[];
  model: string;
}

/** Whether a Groq key is configured (callers can fall back to templates if not). */
export function aiConfigured(): boolean {
  return Boolean(config.groq.apiKey);
}

async function callGroq(
  key: string,
  model: string,
  messages: ChatMessage[],
  opts: ChatOptions,
): Promise<ChatResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(`${config.groq.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts.temperature ?? config.groq.temperature,
        max_tokens: opts.maxTokens ?? 1024,
        ...(opts.tools ? { tools: opts.tools, tool_choice: opts.toolChoice ?? 'auto' } : {}),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Groq ${res.status} ${res.statusText}: ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[];
    };
    const msg = data.choices?.[0]?.message;
    return {
      content: msg?.content ?? '',
      toolCalls: msg?.tool_calls ?? [],
      model,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Send a chat completion, trying each model in the chain until one succeeds.
 * Transient network errors are retried per model with backoff.
 */
export async function chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
  const key = requireGroqKey();
  let lastErr: unknown;
  for (const model of config.groq.models) {
    try {
      return await withRetry(() => callGroq(key, model, messages, opts), {
        retries: 2,
        baseMs: 800,
        label: `groq:${model}`,
      });
    } catch (err) {
      lastErr = err;
      log.warn(`Model "${model}" failed; falling back to next in chain.`);
    }
  }
  throw new Error(`All Groq models failed. Last error: ${(lastErr as Error)?.message}`);
}

/** Convenience: a single system+user prompt returning plain text. */
export async function ask(system: string, user: string, opts: ChatOptions = {}): Promise<string> {
  const res = await chat(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    opts,
  );
  return res.content;
}
