/**
 * Browser driver abstraction.
 *
 * The agent talks to the dashboard through this interface so the engine can be
 * swapped. Playwright is the primary engine (better auto-waiting and session
 * persistence); Selenium is a fallback if a dashboard change breaks Playwright.
 * Both run the SAME in-page extractor, so read results are identical.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { config } from '../config.js';
import { log } from '../util/log.js';
import { inPageScript, type RawPage } from './extractors.js';

export interface BrowserDriver {
  launch(): Promise<void>;
  goto(url: string): Promise<void>;
  currentUrl(): Promise<string>;
  extract(): Promise<RawPage>;
  /** Full page HTML — used as a fallback when a selector can't be found. */
  content(): Promise<string>;
  fill(selector: string, value: string): Promise<void>;
  click(selector: string): Promise<void>;
  /** Click a button/link/submit whose visible text (or value) matches. */
  clickByText(text: string): Promise<boolean>;
  exists(selector: string): Promise<boolean>;
  waitForSelector(selector: string, timeoutMs?: number): Promise<boolean>;
  /** Persist cookies/localStorage so we don't log in every run. */
  saveSession(): Promise<void>;
  screenshot(path: string): Promise<void>;
  close(): Promise<void>;
}

export class PlaywrightDriver implements BrowserDriver {
  private browser?: Browser;
  private context?: BrowserContext;
  private page?: Page;

  async launch(): Promise<void> {
    this.browser = await chromium.launch({ headless: config.headless });
    const hasSession = existsSync(config.paths.sessionFile);
    this.context = await this.browser.newContext(
      hasSession ? { storageState: config.paths.sessionFile } : {},
    );
    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(20_000);
    log.debug(`Playwright launched (headless=${config.headless}, session=${hasSession}).`);
  }

  private get p(): Page {
    if (!this.page) throw new Error('Driver not launched. Call launch() first.');
    return this.page;
  }

  async goto(url: string): Promise<void> {
    await this.p.goto(url, { waitUntil: 'domcontentloaded' });
  }

  async currentUrl(): Promise<string> {
    return this.p.url();
  }

  async extract(): Promise<RawPage> {
    return (await this.p.evaluate(inPageScript())) as RawPage;
  }

  async content(): Promise<string> {
    return this.p.content();
  }

  async fill(selector: string, value: string): Promise<void> {
    await this.p.locator(selector).first().fill(value);
  }

  async click(selector: string): Promise<void> {
    await this.p.locator(selector).first().click();
  }

  async clickByText(text: string): Promise<boolean> {
    const re = new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const val = text.replace(/["\\]/g, '');
    const candidates = [
      this.p.getByRole('button', { name: re }),
      this.p.getByRole('link', { name: re }),
      this.p.locator(`input[type="submit"][value*="${val}" i], input[type="button"][value*="${val}" i]`),
      this.p.getByText(re),
    ];
    for (const loc of candidates) {
      if ((await loc.count()) > 0) {
        await loc.first().click();
        return true;
      }
    }
    return false;
  }

  async exists(selector: string): Promise<boolean> {
    return (await this.p.locator(selector).count()) > 0;
  }

  async waitForSelector(selector: string, timeoutMs = 15_000): Promise<boolean> {
    try {
      await this.p.locator(selector).first().waitFor({ state: 'visible', timeout: timeoutMs });
      return true;
    } catch {
      return false;
    }
  }

  async saveSession(): Promise<void> {
    if (!this.context) return;
    mkdirSync(dirname(config.paths.sessionFile), { recursive: true });
    await this.context.storageState({ path: config.paths.sessionFile });
    log.debug('Session saved to', config.paths.sessionFile);
  }

  async screenshot(path: string): Promise<void> {
    mkdirSync(dirname(path), { recursive: true });
    await this.p.screenshot({ path, fullPage: true });
  }

  async close(): Promise<void> {
    await this.context?.close().catch(() => {});
    await this.browser?.close().catch(() => {});
  }
}

/** Build the configured driver. Selenium is loaded lazily to avoid its cost. */
export async function createDriver(): Promise<BrowserDriver> {
  if (config.driver === 'selenium') {
    const { SeleniumDriver } = await import('./driver.selenium.js');
    return new SeleniumDriver();
  }
  return new PlaywrightDriver();
}
