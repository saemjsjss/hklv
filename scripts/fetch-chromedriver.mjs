#!/usr/bin/env node
/**
 * Fetch a chromedriver that matches the local Chrome/Chromium.
 *
 * You normally do NOT need this: on a machine with Chrome installed, Selenium
 * Manager (bundled with selenium-webdriver) downloads the right driver on its
 * own. This helper exists for locked-down / offline / CI environments where
 * Selenium Manager can't reach the Chrome-for-Testing metadata host but the
 * binary storage host is reachable.
 *
 * It detects the browser version, downloads the matching chromedriver from the
 * Chrome-for-Testing storage bucket, and writes it to .drivers/chromedriver —
 * which selenium/example.ts auto-detects.
 *
 * Requirements: `curl` (honors the proxy) and `unzip`, both standard on Linux
 * and macOS. Point at a specific browser with SELENIUM_BROWSER_BINARY or
 * CHROME_BINARY.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const driversDir = join(repoRoot, '.drivers');

/** Locate a Chrome/Chromium binary to read the version from. */
function findChromeBinary() {
  const fromEnv = process.env.SELENIUM_BROWSER_BINARY ?? process.env.CHROME_BINARY;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

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

/** Map the current OS/arch to a Chrome-for-Testing platform id. */
function cftPlatform() {
  const { platform, arch } = process;
  if (platform === 'linux') return { id: 'linux64', driver: 'chromedriver' };
  if (platform === 'darwin') return { id: arch === 'arm64' ? 'mac-arm64' : 'mac-x64', driver: 'chromedriver' };
  if (platform === 'win32') return { id: 'win64', driver: 'chromedriver.exe' };
  throw new Error(`Unsupported platform: ${platform}/${arch}`);
}

function main() {
  const binary = findChromeBinary();
  if (!binary) {
    console.error('No Chrome/Chromium binary found. Set SELENIUM_BROWSER_BINARY or CHROME_BINARY.');
    process.exit(1);
  }

  const versionOutput = execFileSync(binary, ['--version'], { encoding: 'utf8' });
  const match = versionOutput.match(/\d+\.\d+\.\d+\.\d+/);
  if (!match) {
    console.error(`Could not parse browser version from: ${versionOutput.trim()}`);
    process.exit(1);
  }
  const version = match[0];
  const { id: platform, driver } = cftPlatform();
  console.log(`Browser: ${versionOutput.trim()}  (version ${version}, platform ${platform})`);

  const url = `https://storage.googleapis.com/chrome-for-testing-public/${version}/${platform}/chromedriver-${platform}.zip`;
  mkdirSync(driversDir, { recursive: true });
  const zipPath = join(driversDir, 'chromedriver.zip');

  console.log(`Downloading ${url}`);
  // curl honors HTTPS_PROXY; -f fails loudly on HTTP errors (e.g. 404).
  execFileSync('curl', ['-fsSL', '-o', zipPath, url], { stdio: ['ignore', 'inherit', 'inherit'] });

  console.log('Extracting...');
  execFileSync('unzip', ['-o', '-q', zipPath, '-d', driversDir], { stdio: 'inherit' });

  const extractedDriver = join(driversDir, `chromedriver-${platform}`, driver);
  const finalDriver = join(driversDir, driver);
  renameSync(extractedDriver, finalDriver);
  if (process.platform !== 'win32') execFileSync('chmod', ['+x', finalDriver]);

  // Clean up the archive and the now-empty extraction folder.
  rmSync(zipPath, { force: true });
  rmSync(join(driversDir, `chromedriver-${platform}`), { recursive: true, force: true });

  console.log(`\n✅ chromedriver ready at: ${finalDriver}`);
  console.log('   Run the Selenium example with:  npm run test:selenium');
}

main();
