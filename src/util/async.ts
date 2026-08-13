/** Small async helpers shared across the agent. */
import { log } from './log.js';

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an async operation with exponential backoff. Used for flaky network
 * calls (Groq, Telegram). Re-throws the last error if all attempts fail.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; baseMs?: number; label?: string } = {},
): Promise<T> {
  const { retries = 3, baseMs = 500, label = 'operation' } = opts;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries) break;
      const wait = baseMs * 2 ** attempt;
      log.warn(`${label} failed (attempt ${attempt + 1}/${retries + 1}); retrying in ${wait}ms:`, (err as Error).message);
      await sleep(wait);
    }
  }
  throw lastErr;
}
