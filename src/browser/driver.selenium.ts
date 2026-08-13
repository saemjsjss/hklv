/**
 * Selenium WebDriver fallback engine.
 *
 * Implements the same BrowserDriver contract as PlaywrightDriver, running the
 * identical in-page extractor via `executeScript`. Browser/driver binary
 * resolution mirrors `selenium/example.ts` (reuse Playwright's Chromium; allow
 * env overrides for locked-down environments).
 *
 * Selenium can only persist cookies (not full storage state), so sessions are
 * saved to a sibling cookie file and restored on the first navigation.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { Builder, Browser, By, until, type WebDriver } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import { config } from '../config.js';
import { log } from '../util/log.js';
import { inPageScript, type RawPage } from './extractors.js';
import type { BrowserDriver } from './driver.js';

const cookieFile = config.paths.sessionFile.replace(/\.json$/, '.selenium.json');

function findChromeBinary(): string | undefined {
  const fromEnv = process.env.SELENIUM_BROWSER_BINARY ?? process.env.CHROME_BINARY;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  const pwRoot = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (pwRoot && existsSync(pwRoot)) {
    for (const entry of readdirSync(pwRoot)) {
      if (!entry.startsWith('chromium-')) continue;
      const candidate = `${pwRoot}/${entry}/chrome-linux/chrome`;
      if (existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}

function findChromedriver(): string | undefined {
  const fromEnv = process.env.CHROMEDRIVER_PATH ?? process.env.SELENIUM_CHROMEDRIVER;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  for (const name of ['chromedriver', 'chromedriver.exe']) {
    const candidate = `${process.cwd()}/.drivers/${name}`;
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

export class SeleniumDriver implements BrowserDriver {
  private driver?: WebDriver;
  private restored = false;

  async launch(): Promise<void> {
    const options = new chrome.Options();
    if (config.headless) options.addArguments('--headless=new');
    options.addArguments('--no-sandbox', '--disable-dev-shm-usage', '--window-size=1400,1000');
    const binary = findChromeBinary();
    if (binary) options.setChromeBinaryPath(binary);

    const builder = new Builder().forBrowser(Browser.CHROME).setChromeOptions(options);
    const driverPath = findChromedriver();
    if (driverPath) builder.setChromeService(new chrome.ServiceBuilder(driverPath));
    this.driver = await builder.build();
    log.debug('Selenium launched.');
  }

  private get d(): WebDriver {
    if (!this.driver) throw new Error('Driver not launched. Call launch() first.');
    return this.driver;
  }

  async goto(url: string): Promise<void> {
    await this.d.get(url);
    if (!this.restored && existsSync(cookieFile)) {
      this.restored = true;
      try {
        const cookies = JSON.parse(readFileSync(cookieFile, 'utf8')) as Record<string, unknown>[];
        for (const c of cookies) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await this.d.manage().addCookie(c as any).catch(() => {});
        }
        await this.d.get(url);
      } catch (err) {
        log.warn('Could not restore Selenium cookies:', (err as Error).message);
      }
    }
  }

  async currentUrl(): Promise<string> {
    return this.d.getCurrentUrl();
  }

  async extract(): Promise<RawPage> {
    return this.d.executeScript(`return ${inPageScript()};`) as Promise<RawPage>;
  }

  async content(): Promise<string> {
    return this.d.getPageSource();
  }

  async fill(selector: string, value: string): Promise<void> {
    const el = await this.d.findElement(By.css(selector));
    await el.clear();
    await el.sendKeys(value);
  }

  async click(selector: string): Promise<void> {
    await this.d.findElement(By.css(selector)).click();
  }

  async clickByText(text: string): Promise<boolean> {
    const t = text.replace(/'/g, ''); // keep the XPath literal simple
    const xpath =
      `//button[contains(normalize-space(.), '${t}')]` +
      ` | //a[contains(normalize-space(.), '${t}')]` +
      ` | //input[(@type='submit' or @type='button') and contains(@value, '${t}')]`;
    const els = await this.d.findElements(By.xpath(xpath));
    if (els.length === 0) return false;
    await els[0].click();
    return true;
  }

  async exists(selector: string): Promise<boolean> {
    return (await this.d.findElements(By.css(selector))).length > 0;
  }

  async waitForSelector(selector: string, timeoutMs = 15_000): Promise<boolean> {
    try {
      await this.d.wait(until.elementLocated(By.css(selector)), timeoutMs);
      return true;
    } catch {
      return false;
    }
  }

  async saveSession(): Promise<void> {
    const cookies = await this.d.manage().getCookies();
    mkdirSync(dirname(cookieFile), { recursive: true });
    writeFileSync(cookieFile, JSON.stringify(cookies, null, 2));
    log.debug('Session (cookies) saved to', cookieFile);
  }

  async screenshot(path: string): Promise<void> {
    const b64 = await this.d.takeScreenshot();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, Buffer.from(b64, 'base64'));
  }

  async close(): Promise<void> {
    await this.driver?.quit().catch(() => {});
  }
}
