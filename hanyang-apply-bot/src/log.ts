/** Tiny timestamped console logger. */
const ts = () => new Date().toISOString().slice(11, 19);
export const log = {
  info: (...a: unknown[]) => console.log(`[${ts()}]`, ...a),
  warn: (...a: unknown[]) => console.warn(`[${ts()}] ⚠`, ...a),
  error: (...a: unknown[]) => console.error(`[${ts()}] ✖`, ...a),
  ok: (...a: unknown[]) => console.log(`[${ts()}] ✓`, ...a),
};
