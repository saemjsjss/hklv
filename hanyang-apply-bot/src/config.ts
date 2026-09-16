/** Configuration from environment (+ optional local .env). Never throws on import. */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadDotEnv(): void {
  const p = resolve(process.cwd(), '.env');
  if (existsSync(p) && typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile(p);
    } catch {
      /* ignore */
    }
  }
}
loadDotEnv();

const str = (n: string, d = '') => {
  const v = process.env[n];
  return v === undefined || v === '' ? d : v;
};
const bool = (n: string, d: boolean) => {
  const v = process.env[n];
  return v === undefined || v === '' ? d : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
};
const num = (n: string, d: number) => {
  const v = Number(process.env[n]);
  return Number.isFinite(v) ? v : d;
};

export const config = {
  url: str('HY_URL', 'https://portal.hanyang.ac.kr/haksa/wons/wonsH.do?yim=1'),
  channel: str('HY_CHANNEL', 'chrome'), // '' => bundled chromium
  headless: bool('HY_HEADLESS', false),
  slowMo: num('HY_SLOWMO', 0),
  template: str('HY_TEMPLATE', 'Hanyang_Students_Template.xlsx'),
  uploadsDir: str('HY_UPLOADS_DIR', 'uploads'),
  outputDir: str('HY_OUTPUT_DIR', 'output'),
  dataStart: num('HY_DATA_START', 4),
  submit: bool('HY_SUBMIT', false),
  submitText: str('HY_SUBMIT_TEXT', 'Save & Submit'),
  only: str('HY_ONLY', ''),
  limit: num('HY_LIMIT', 0),
  login: { user: str('HY_LOGIN_USER'), pass: str('HY_LOGIN_PASS') },
};
export type Config = typeof config;
