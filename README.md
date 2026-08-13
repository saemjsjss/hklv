# hklv

Browser automation and end-to-end testing with **Playwright** and **Selenium WebDriver**, in TypeScript.

Both frameworks are installed side by side so you can use whichever fits the job:

- **[Playwright](https://playwright.dev/)** (`@playwright/test`) — modern E2E test runner with auto-waiting, tracing, and its own managed browsers.
- **[Selenium WebDriver](https://www.selenium.dev/)** (`selenium-webdriver`) — the W3C WebDriver standard, useful for cross-browser grids and existing Selenium infrastructure.

## Requirements

- Node.js 20+ (developed against Node 22)
- For Playwright: browser binaries (see below)
- For Selenium: a Chrome/Chromium browser + a matching `chromedriver` (usually handled automatically)

## Setup

```bash
npm install
```

### Playwright browsers

Playwright manages its own browser binaries. On a fresh machine, install them once:

```bash
npx playwright install --with-deps chromium
```

> In this project's dev container the browsers are already pre-installed, so this step is skipped there.

## Project layout

```
.
├── playwright.config.ts        # Playwright test-runner config (testDir: ./tests)
├── tests/
│   └── example.spec.ts         # Playwright example tests
├── selenium/
│   └── example.ts              # Standalone Selenium WebDriver example
├── scripts/
│   └── fetch-chromedriver.mjs  # Helper to fetch a matching chromedriver (offline/CI)
└── tsconfig.json
```

## Running

### Playwright

```bash
npm test                # run the Playwright tests (headless)
npm run test:pw:headed  # run them in a headed browser
npm run pw:report       # open the HTML report from the last run
```

### Selenium

```bash
npm run test:selenium
```

On a normal machine with Chrome installed, **Selenium Manager** (bundled with `selenium-webdriver`) downloads the matching `chromedriver` automatically — no extra steps.

The example resolves a browser in this order: `SELENIUM_BROWSER_BINARY` / `CHROME_BINARY`, then a Chromium installed by Playwright, then whatever Selenium Manager finds.

#### Restricted / offline / CI environments

Where Selenium Manager can't reach the driver download servers, fetch a matching driver yourself:

```bash
npm run driver:chrome     # downloads chromedriver to .drivers/chromedriver
npm run test:selenium     # auto-detects .drivers/chromedriver
```

Or point the example at binaries you already have:

```bash
SELENIUM_BROWSER_BINARY=/path/to/chrome \
CHROMEDRIVER_PATH=/path/to/chromedriver \
npm run test:selenium
```

## npm scripts

| Script | What it does |
| --- | --- |
| `npm test` / `npm run test:pw` | Run Playwright tests |
| `npm run test:pw:headed` | Run Playwright tests in a headed browser |
| `npm run pw:report` | Open the Playwright HTML report |
| `npm run test:selenium` | Run the Selenium WebDriver example |
| `npm run driver:chrome` | Download a `chromedriver` matching the local browser |
| `npm run typecheck` | Type-check the project with `tsc` |
