/**
 * Tiny dependency-free logger.
 *
 * Levels are controlled by the LOG_LEVEL env var (debug|info|warn|error).
 * Everything is written to stderr so stdout can stay clean for machine-readable
 * output (e.g. a JSON snapshot) when a command wants that.
 */
type Level = 'debug' | 'info' | 'warn' | 'error';

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function threshold(): number {
  const raw = (process.env.LOG_LEVEL ?? 'info').toLowerCase();
  return ORDER[raw as Level] ?? ORDER.info;
}

function stamp(): string {
  return new Date().toISOString().replace('T', ' ').replace('Z', '');
}

function emit(level: Level, args: unknown[]): void {
  if (ORDER[level] < threshold()) return;
  const tag = level.toUpperCase().padEnd(5);
  // eslint-disable-next-line no-console
  console.error(`${stamp()} ${tag}`, ...args);
}

export const log = {
  debug: (...args: unknown[]) => emit('debug', args),
  info: (...args: unknown[]) => emit('info', args),
  warn: (...args: unknown[]) => emit('warn', args),
  error: (...args: unknown[]) => emit('error', args),
};
