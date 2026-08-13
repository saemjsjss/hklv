# hklv

Browser automation and end-to-end testing with **Playwright** and **Selenium WebDriver**, in TypeScript.

Both frameworks are installed side by side so you can use whichever fits the job:

- **[Playwright](https://playwright.dev/)** (`@playwright/test`) — modern E2E test runner with auto-waiting, tracing, and its own managed browsers.
- **[Selenium WebDriver](https://www.selenium.dev/)** (`selenium-webdriver`) — the W3C WebDriver standard, useful for cross-browser grids and existing Selenium infrastructure.

## HKLV Dashboard AI Agent

This repo also contains a custom AI agent that logs into the Hangeul admin
dashboard, understands it, briefs the manager in plain English, and takes
actions on request — **always asking for confirmation first**. It runs on your
own computer and talks to you through a private Telegram bot, with a
Groq-hosted Llama model (70B, with automatic fallback) as its brain. No paid
SDKs — it uses Node's built-in `fetch`, Playwright, and Selenium only.

### What it does

- **Understands** every dashboard section by reading the live sidebar, KPI cards
  and list tables. The extraction is structure-based (keys off stable CSS
  classes, not fixed text), so it keeps working as the CEO changes the dashboard
  day to day — see `src/browser/extractors.ts`.
- **Detects changes** between runs by diffing snapshots, so the briefing can
  lead with "what changed since last time" (`src/dashboard/changes.ts`).
- **Briefs you** with a prioritized duty list derived from the live numbers
  (`src/ai/briefing.ts`), delivered on demand or as a scheduled morning message.
- **Chats & acts** over Telegram: answer questions, and perform actions such as
  sending document reminders or posting a notice. Every action is confirmed by
  you first and written to a local audit log (`data/audit.log.jsonl`).

Architecture: Telegram ⇄ agent core (`src/agent.ts`) ⇄ Groq brain
(`src/ai/brain.ts`) ⇄ browser layer (`src/browser/`, Playwright primary /
Selenium fallback) and a confirm-gated action layer (`src/actions/`).

### Setup (one time)

1. `npm install` and, on a fresh machine, `npx playwright install --with-deps chromium`.
2. `cp .env.example .env` and fill it in. **Never commit `.env`.**
3. Create a Telegram bot with **@BotFather** → `TELEGRAM_BOT_TOKEN`; get your
   numeric id from **@userinfobot** → `TELEGRAM_OWNER_ID` (the bot obeys only you).
4. Add your **Groq** API key → `GROQ_API_KEY`, plus your dashboard login
   (`HKLV_ADMIN_USER` / `HKLV_ADMIN_PASS`).
5. First login: `HKLV_HEADLESS=false npm run agent:login` — lets you complete any
   one-time code by hand; the session is then saved and reused.

### Commands

| Command | What it does |
| --- | --- |
| `npm run agent:selftest` | Offline end-to-end test against a synthetic fixture — no credentials needed. |
| `npm run agent:login` | Log in and print the current dashboard briefing (read-only). |
| `npm run agent:brief` | Produce a briefing now. Add `-- --send` to also send it to Telegram, `-- --ai` for an AI focus line. |
| `npm run agent:serve` | Start the Telegram chat bot — ask questions, request actions. |
| `npm run agent:morning` | One-shot morning briefing to Telegram; schedule via cron / Task Scheduler. |

Schedule the morning briefing (example, 8:00 daily):

```cron
0 8 * * *  cd /path/to/hklv && npm run agent:morning >> data/morning.log 2>&1
```

### Try it with no credentials

Point the agent at a saved dashboard HTML file and everything but login/actions
runs offline:

```bash
HKLV_FIXTURE=fixtures/dashboard.sample.html npm run agent:brief
```

### Safety

- Secrets live only in the git-ignored `.env`; nothing sensitive is committed.
- Every state-changing action is confirmed over Telegram before it runs and is
  recorded in the audit log.
- The bot ignores messages from anyone but your Telegram id.

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
