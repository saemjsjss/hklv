/**
 * Central configuration, loaded from environment variables (and a local `.env`).
 *
 * Secrets never live in code. Real values go into a git-ignored `.env` file on
 * the machine that runs the agent — see `.env.example` for the full list.
 *
 * Loading is lazy and non-fatal: importing this module never throws, so tools
 * like the offline self-test and `tsc` work without any secrets present. Use
 * the `require*` helpers at the point a secret is actually needed.
 */
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { log } from './util/log.js';

// Load `.env` from the current working directory if present. Node 20.12+/22 has
// process.loadEnvFile; guard it so older runtimes (or a missing file) are fine.
function loadDotEnv(): void {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  try {
    if (typeof process.loadEnvFile === 'function') process.loadEnvFile(envPath);
  } catch (err) {
    log.warn('Could not load .env:', (err as Error).message);
  }
}
loadDotEnv();

function str(name: string, fallback = ''): string {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

function bool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
}

export interface Config {
  dashboard: {
    baseUrl: string;
    loginPath: string;
    /** CSS selectors for the login form; defaults cover common PHP login pages. */
    selectors: { user: string; pass: string; submit: string };
    adminUser: string;
    adminPass: string;
  };
  groq: {
    apiKey: string;
    baseUrl: string;
    /** Ordered model chain: first is primary, the rest are fallbacks. */
    models: string[];
    temperature: number;
  };
  telegram: {
    botToken: string;
    /** Numeric Telegram user id the bot will exclusively obey. */
    ownerId: string;
  };
  /** Which browser engine drives the dashboard. */
  driver: 'playwright' | 'selenium';
  headless: boolean;
  paths: {
    dataDir: string;
    sessionFile: string;
    snapshotsDir: string;
    auditLog: string;
  };
  /**
   * When set, the agent reads this local HTML file instead of the live site.
   * Enables a full offline dry-run (extract → brief) with no credentials.
   */
  offlineFixture: string;
}

const dataDir = resolve(process.cwd(), str('HKLV_DATA_DIR', 'data'));

export const config: Config = {
  dashboard: {
    baseUrl: str('HKLV_BASE_URL', 'https://hangeul.com.bd/admin').replace(/\/+$/, ''),
    loginPath: str('HKLV_LOGIN_PATH', 'login.php'),
    selectors: {
      user: str('HKLV_SEL_USER', 'input[name="username"], input[name="user"], input[type="email"], #username'),
      pass: str('HKLV_SEL_PASS', 'input[name="password"], input[type="password"], #password'),
      submit: str('HKLV_SEL_SUBMIT', 'button[type="submit"], input[type="submit"], button'),
    },
    adminUser: str('HKLV_ADMIN_USER'),
    adminPass: str('HKLV_ADMIN_PASS'),
  },
  groq: {
    apiKey: str('GROQ_API_KEY'),
    baseUrl: str('GROQ_BASE_URL', 'https://api.groq.com/openai/v1'),
    models: str('GROQ_MODELS', 'llama-3.3-70b-versatile,llama-3.1-8b-instant')
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean),
    temperature: Number(str('GROQ_TEMPERATURE', '0.2')),
  },
  telegram: {
    botToken: str('TELEGRAM_BOT_TOKEN'),
    ownerId: str('TELEGRAM_OWNER_ID'),
  },
  driver: (str('HKLV_DRIVER', 'playwright') === 'selenium' ? 'selenium' : 'playwright'),
  headless: bool('HKLV_HEADLESS', true),
  paths: {
    dataDir,
    sessionFile: join(dataDir, 'session.json'),
    snapshotsDir: join(dataDir, 'snapshots'),
    auditLog: join(dataDir, 'audit.log.jsonl'),
  },
  offlineFixture: str('HKLV_FIXTURE'),
};

/** URL of a dashboard page given its `*.php[?query]` path. */
export function pageUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${config.dashboard.baseUrl}/${path.replace(/^\/+/, '')}`;
}

export function requireGroqKey(): string {
  if (!config.groq.apiKey) {
    throw new Error('GROQ_API_KEY is not set. Add it to your .env (see .env.example).');
  }
  return config.groq.apiKey;
}

export function requireTelegram(): { botToken: string; ownerId: string } {
  const { botToken, ownerId } = config.telegram;
  if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN is not set. Add it to your .env.');
  if (!ownerId) throw new Error('TELEGRAM_OWNER_ID is not set. Add it to your .env.');
  return { botToken, ownerId };
}

export function requireAdminCreds(): { user: string; pass: string } {
  const { adminUser, adminPass } = config.dashboard;
  if (!adminUser || !adminPass) {
    throw new Error('HKLV_ADMIN_USER / HKLV_ADMIN_PASS are not set. Add them to your .env.');
  }
  return { user: adminUser, pass: adminPass };
}

/** True when the agent should read a local fixture instead of the live site. */
export function isOffline(): boolean {
  return Boolean(config.offlineFixture);
}
