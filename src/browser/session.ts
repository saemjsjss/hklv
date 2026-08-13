/**
 * Login and session management.
 *
 * The agent reuses a saved browser session so it does not log in on every run.
 * When the session is gone it logs in with the admin credentials from `.env`.
 * The flow is defensive about form markup and surfaces an OTP prompt clearly if
 * the dashboard ever asks for one.
 */
import { config, pageUrl, requireAdminCreds } from '../config.js';
import { log } from '../util/log.js';
import { sleep } from '../util/async.js';
import type { BrowserDriver } from './driver.js';

const OTP_SELECTOR =
  'input[name="otp"], input[name="code"], input[name="token"], input[autocomplete="one-time-code"]';

/** Heuristic: the sidebar nav is present and we are not on the login page. */
export async function isLoggedIn(driver: BrowserDriver): Promise<boolean> {
  const hasNav = (await driver.exists('.sb-nav')) || (await driver.exists('a.sb-item'));
  if (!hasNav) return false;
  const url = await driver.currentUrl();
  return !/login|signin|auth/i.test(url);
}

/**
 * Ensure the driver holds a logged-in dashboard session, logging in if needed.
 * On success the session is saved so subsequent runs skip the login.
 */
export async function ensureLoggedIn(driver: BrowserDriver): Promise<void> {
  const { user, pass } = requireAdminCreds();

  await driver.goto(pageUrl('index.php'));
  if (await isLoggedIn(driver)) {
    log.info('Already logged in (reused saved session).');
    return;
  }

  log.info('No valid session — logging in…');
  await driver.goto(pageUrl(config.dashboard.loginPath));

  const foundForm = await driver.waitForSelector(config.dashboard.selectors.user, 10_000);
  if (!foundForm) {
    throw new Error(
      `Could not find the login form at ${pageUrl(config.dashboard.loginPath)}. ` +
        'Set HKLV_LOGIN_PATH and HKLV_SEL_USER/PASS/SUBMIT in your .env to match the real page.',
    );
  }

  await driver.fill(config.dashboard.selectors.user, user);
  await driver.fill(config.dashboard.selectors.pass, pass);
  await driver.click(config.dashboard.selectors.submit);
  await sleep(2000); // allow the post + redirect to settle

  if (await isLoggedIn(driver)) {
    await driver.saveSession();
    log.info('Login succeeded — session saved for next time.');
    return;
  }

  if (await driver.exists(OTP_SELECTOR)) {
    throw new Error(
      'The dashboard asked for a one-time code (OTP). Run once with HKLV_HEADLESS=false ' +
        'to complete the OTP by hand — the saved session is then reused going forward.',
    );
  }

  throw new Error(
    'Login failed. Double-check HKLV_ADMIN_USER / HKLV_ADMIN_PASS, or adjust the login ' +
      'selectors (HKLV_SEL_*) in your .env if the form markup differs.',
  );
}
