import { Builder, Browser, By, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import { existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Standalone Selenium WebDriver example.
 *
 * Run it with:  npm run test:selenium
 *
 * Selenium needs two things: a Chrome/Chromium *browser* and a matching
 * *chromedriver*. On a normal machine, Selenium Manager (built into
 * selenium-webdriver v4) auto-downloads the chromedriver that matches your
 * installed browser, so this "just works". For the browser itself we reuse the
 * Chromium that Playwright already installed when one is available, so no extra
 * download is needed in this dev container.
 *
 * In locked-down / offline / CI environments where Selenium Manager cannot
 * reach the driver download servers, provide a matching chromedriver yourself.
 * Either run `npm run driver:chrome` (writes it to .drivers/chromedriver, which
 * this script auto-detects) or point these environment variables at binaries
 * you already have:
 *   SELENIUM_BROWSER_BINARY=/path/to/chrome        (or CHROME_BINARY=...)
 *   CHROMEDRIVER_PATH=/path/to/chromedriver        (or SELENIUM_CHROMEDRIVER=...)
 */
function findChromeBinary(): string | undefined {
  const fromEnv = process.env.SELENIUM_BROWSER_BINARY ?? process.env.CHROME_BINARY;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  // Reuse a Chromium installed by Playwright, if present.
  const pwRoot = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (pwRoot && existsSync(pwRoot)) {
    for (const entry of readdirSync(pwRoot)) {
      if (!entry.startsWith('chromium-')) continue;
      const candidate = join(pwRoot, entry, 'chrome-linux', 'chrome');
      if (existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}

function findChromedriver(): string | undefined {
  const fromEnv = process.env.CHROMEDRIVER_PATH ?? process.env.SELENIUM_CHROMEDRIVER;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  // A driver fetched by `npm run driver:chrome`.
  for (const name of ['chromedriver', 'chromedriver.exe']) {
    const candidate = join(repoRoot, '.drivers', name);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

async function main(): Promise<void> {
  const options = new chrome.Options();
  options.addArguments('--headless=new', '--no-sandbox', '--disable-dev-shm-usage');

  const binary = findChromeBinary();
  if (binary) {
    console.log(`Using Chrome binary: ${binary}`);
    options.setChromeBinaryPath(binary);
  } else {
    console.log('No explicit Chrome binary found; letting Selenium Manager resolve one.');
  }

  const builder = new Builder().forBrowser(Browser.CHROME).setChromeOptions(options);

  // Use an explicit chromedriver if one is available; otherwise Selenium Manager
  // resolves (and downloads, if needed) a matching driver automatically.
  const driverPath = findChromedriver();
  if (driverPath) {
    console.log(`Using chromedriver: ${driverPath}`);
    builder.setChromeService(new chrome.ServiceBuilder(driverPath));
  } else {
    console.log('No explicit chromedriver set; Selenium Manager will resolve one.');
  }

  const driver = await builder.build();

  try {
    // Load a self-contained page via a data: URL so the demo needs no network.
    const html = `
      <!doctype html>
      <html>
        <head><title>hklv selenium demo</title></head>
        <body>
          <h1>Hello Selenium</h1>
          <button id="go" onclick="document.getElementById('status').textContent='clicked'">Click me</button>
          <p id="status">idle</p>
        </body>
      </html>`;
    await driver.get('data:text/html;charset=utf-8,' + encodeURIComponent(html));

    const title = await driver.getTitle();
    console.log(`Page title: ${title}`);
    if (title !== 'hklv selenium demo') {
      throw new Error(`Unexpected title: "${title}"`);
    }

    const status = driver.findElement(By.id('status'));
    await driver.findElement(By.id('go')).click();
    await driver.wait(until.elementTextIs(status, 'clicked'), 5000);
    console.log(`Status after click: ${await status.getText()}`);

    console.log('\n✅ Selenium example completed successfully.');
  } finally {
    await driver.quit();
  }
}

main().catch((err: unknown) => {
  console.error('\n❌ Selenium example failed:');
  console.error(err);
  process.exitCode = 1;
});
