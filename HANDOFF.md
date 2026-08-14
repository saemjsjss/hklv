# HKLV Dashboard Agent — Handoff

> A complete context transfer so another AI (or engineer) can continue this project without re-deriving anything. Read this top to bottom first.

---

## 1. Goals (what we are building and why)

**Who:** The user is a **manager at Hangeul Korean Language & Visa (HKLV)** — a Bangladesh-based study-abroad + Korean student-visa consultancy. Their CEO built and frequently updates an internal admin dashboard at `https://hangeul.com.bd/admin/`.

**The goal:** a **personal AI operations assistant** for that dashboard that does three things:

1. **Understands** the whole dashboard and keeps up as the CEO changes it (near-daily).
2. **Briefs** the manager in plain English and tells them their **prioritized duties** — both automatically each morning and on demand.
3. **Acts** on the manager's behalf inside the dashboard when asked — **always asking for confirmation before doing anything** (state-changing actions are gated behind a Yes/No).

**How the manager interacts with it:** a private **Telegram bot** (phone-friendly).
**Where it runs:** the manager's **own Windows PC**.
**AI brain:** **Groq** (OpenAI-compatible API), model chain `llama-3.3-70b-versatile` → `llama-3.1-8b-instant` (failover).

**Locked-in product decisions (do not re-litigate):**
| Decision | Choice |
|---|---|
| Acting policy | **Ask before every action** (all writes confirm in Telegram) |
| Interaction | Morning briefing **and** on-demand chat |
| Channel | Telegram bot (owner-locked to one user id) |
| Runtime | Manager's own PC (briefing only fires while PC is on) |
| Login | Manager's admin credentials (no OTP observed) |
| AI | Groq Llama-3.3-70B primary + fallback |
| Focus areas | Audit everything, keep CEO/board updated, Students & Documents, Leads & Consultations, Team & Tasks, B2B/Partners |

---

## 2. Current status (as of this handoff)

- ✅ **Built and merged.** The full agent (PR #1) is merged into `main` of `github.com/saemjsjss/hklv`.
- ✅ **Verified against the LIVE dashboard.** `npm run agent:login` logs in and reads 8/8 pages. Real briefing produced, e.g.: `Total Students: 175 · Pending Payment: 2 · Verified: 172 · Missing Documents: 172 · Consultation Requests: 11`.
- ✅ **Offline self-test passes** (`npm run agent:selftest`) and `npm run typecheck` is clean.
- 🔧 **Telegram chat + morning briefing:** code complete, needs the user to run `npm run agent:serve` and confirm the round-trip on their phone.
- ⚠️ **Write actions (`send_reminders`, `send_notice`): implemented but UNVERIFIED.** Their button/field selectors on `reminders.php` / `notice.php` were guessed (those pages' DOM was never seen). They are confirm-gated and fail safe, but need real tuning — see §7.

### Where the human is right now
On Windows (`C:\Users\Computer Garage\hklv`), setup essentially done. Login works, briefing works. Their **next action** is `npm run agent:serve` → open bot **@Hklvmanager_bot** in Telegram → send "what needs my attention today?". Be patient and concrete; they are non-technical.

---

## 3. Hard-won facts about the live environment (IMPORTANT)

These were discovered this session and are not obvious from the code:

- **Login page:** `https://hangeul.com.bd/admin/login.php`. The form has an **Admin/Staff tab toggle**, a Username field, a Password field (with a **Show/Hide** button), a red **“Login to Admin”** submit button, and a “Forgot password?” link. Admin tab is the default. **No OTP.**
- **The generic submit selector clicked the wrong button** (the tab / Show button) so login silently failed. **Fix that is required in `.env`:**
  ```
  HKLV_SEL_SUBMIT=button:has-text('Login')
  ```
  This is a Playwright text selector and it works. **TODO for next AI:** bake a more robust submit into `src/browser/session.ts` defaults (e.g. `clickByText('Login')` and/or pressing Enter in the password field) so future users don't hit this.
- **Windows gotchas hit during setup** (document these for any future onboarding):
  - PowerShell blocks scripts by default → run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` (answer `Y`).
  - `npm warn allow-scripts` about `esbuild` postinstall is **harmless** (binary comes via optional deps; `tsx` still works).
  - Notepad must **Save As → All files** with name exactly `.env` (not `.env.example`, not `.env.txt`).
  - First login with `HKLV_HEADLESS=false` to watch/handle anything; then `HKLV_HEADLESS=true` to run quietly (session is saved after first login).
- **Cloud dev-container caveat:** the Claude Code sandbox proxy **blocks `hangeul.com.bd` (403)**, so the live site cannot be reached from the cloud environment. All live testing must happen on the user's machine (or any host with open network).
- **PII:** the real dashboard HTML contains actual student names. **Never commit it.** A synthetic, safe fixture exists at `fixtures/dashboard.sample.html` for tests/offline runs.

---

## 4. Architecture

```
Telegram (owner) ⇄ Agent core ⇄ Groq brain (Llama-70B + fallback)
                       │
        ┌──────────────┼───────────────┐
   Browser layer   Knowledge base   Action layer
 (Playwright 1º,   (sitemap +       (read tools +
  Selenium 2º;     snapshots +      confirm-gated
  saved session)   change-diff)     writes + audit)
```

**Key idea — structural extraction:** the dashboard is read by driving a logged-in browser and extracting data by **stable CSS class names** (`.sb-item`/`.sb-badge` for nav+counts, `.stat-card` for metrics, `.wf-item` for pipeline counts, `.tbl` for tables). This survives the CEO's daily content changes. The same in-page extractor runs on both the live site and offline fixtures, and under both Playwright and Selenium.

**Change detection:** each run snapshots structure + counts and diffs against the previous snapshot → the briefing leads with “what changed since last time.”

**Confirm-before-every-action:** the AI may *call* action tools, but the agent intercepts them, sends a Yes/No to Telegram, and only runs on approval. Every decision is written to a local audit log.

---

## 5. Repository map

```
src/
  config.ts              # loads .env; typed config; requireX() guards; pageUrl()
  types.ts               # NavItem, Metric, TableData, PageSnapshot, Snapshot, Change, Duty
  util/log.ts            # tiny leveled logger (LOG_LEVEL)
  util/async.ts          # sleep(), withRetry() exponential backoff
  browser/
    extractors.ts        # extractAllInPage() (browser-safe), inPageScript() (adds __name shim),
                         #   toPageSnapshot() + structureHash()
    driver.ts            # BrowserDriver interface + PlaywrightDriver + createDriver()
    driver.selenium.ts   # Selenium fallback (same contract, executeScript)
    session.ts           # isLoggedIn(), ensureLoggedIn() — login + storageState persistence
  dashboard/
    sitemap.ts           # ROUTES + DEFAULT_CRAWL (which pages the crawler reads)
    crawler.ts           # crawl(driver) -> Snapshot (also offline fixture mode)
    knowledge.ts         # saveSnapshot/latestSnapshot + knowledge.md generation
    changes.ts           # diffSnapshots(prev, curr) -> Change[]
  ai/
    brain.ts             # Groq client: chat(), ask(); model failover; tool-calling
    tools.ts             # read-tool specs + runReadTool(); buildToolSpecs()
    briefing.ts          # computeDuties(), selectHeadline(), renderBriefing()
  actions/
    registry.ts          # ACTIONS: send_reminders, send_notice (confirm-gated writes)
    confirm.ts?          # (confirmation flow lives in agent.ts + serve.ts)
    audit.ts             # append-only JSONL audit log
  channel/telegram.ts    # dependency-free Telegram client (fetch): poll/send/answerCallback, owner lock, chunking
  agent.ts               # handleUserMessage(): chat ⇄ tools ⇄ confirm-gated actions; buildSystemPrompt()
  pipeline.ts            # withDriver(), collect() (crawl+diff+save+render), aiIntro()
  cli/
    selftest.ts          # OFFLINE end-to-end test against the fixture (no creds) — npm run agent:selftest
    login.ts             # log in + print live briefing — npm run agent:login
    brief.ts             # briefing on demand (--send to Telegram, --ai for AI intro)
    serve.ts             # the Telegram bot loop (poller/worker + confirm) — npm run agent:serve
  schedule/morning.ts    # morning briefing entrypoint for cron/Task Scheduler — npm run agent:morning
fixtures/dashboard.sample.html   # synthetic (safe) fixture mirroring the real DOM
.env.example             # documented template (no secrets)
```

**Stack:** Node 22, TypeScript, `tsx` runner. **Zero runtime dependencies added** — native `fetch` for Groq + Telegram, Playwright (installed) for the browser, Selenium (installed) as fallback. `data/` (sessions, snapshots, audit log, knowledge.md) is git-ignored.

**Dashboard model (11-stage pipeline):** Consultation → Sign-up → Payment Verified → Documents Reviewed → University Application & Interview → DHL Delivery → Admission & Tuition → VIN → Embassy Submission → Visa Result → Admitted/Completed. Student list pages use stable query params: `students.php?status=` / `?filter_docs=` / `?stage=` / `?prog=` / `?uni=` / `?source=`.

---

## 6. Configuration (`.env`)

Real values live ONLY in the user's local `.env` (git-ignored). Do not print secrets into any committed file or shared doc. Variables:

| Var | Purpose |
|---|---|
| `HKLV_ADMIN_USER`, `HKLV_ADMIN_PASS` | dashboard login |
| `HKLV_BASE_URL` (`https://hangeul.com.bd/admin`), `HKLV_LOGIN_PATH` (`login.php`) | site location |
| `HKLV_SEL_SUBMIT=button:has-text('Login')` | **required** login-button fix (see §3) |
| `HKLV_SEL_USER`, `HKLV_SEL_PASS` | login field selectors (defaults worked) |
| `GROQ_API_KEY`, `GROQ_MODELS` | AI brain |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_OWNER_ID` | bot + owner numeric id (bot obeys only this id) |
| `HKLV_DRIVER` (`playwright`), `HKLV_HEADLESS` (`true` after first login) | engine/runtime |
| `HKLV_FIXTURE` | offline mode: path to a saved dashboard HTML |
| `HKLV_SEL_SEND_REMINDERS`, `HKLV_SEL_NOTICE_*` | overrides for write-action controls (see §7) |

The user's bot is **@Hklvmanager_bot**. Their admin account has **Finance locked** (read scope excludes it).

---

## 7. What's left to do (roadmap / next steps)

**Immediate (finish go-live):**
1. Help the user run `npm run agent:serve` and confirm the Telegram round-trip (message in, briefing out).
2. Set up the morning briefing on Windows **Task Scheduler** running `npm run agent:morning` (a `morning.bat` that `cd`s to the folder and calls it). Note: only fires while the PC is on.

**Harden (real bugs/gaps):**
3. **Bake the login-submit fix into code** (`src/browser/session.ts`) so `HKLV_SEL_SUBMIT` isn't required — try `clickByText('Login')` then press Enter in the password field.
4. **Verify & tune the write actions** against the real `reminders.php` and `notice.php`. Run once headful, inspect the actual send button / message field, and set `HKLV_SEL_SEND_REMINDERS` / `HKLV_SEL_NOTICE_MSG` / `HKLV_SEL_NOTICE_SUBMIT`, or update `src/actions/registry.ts`. They are confirm-gated and fail safe today, but shouldn't be trusted until tested.

**Extend (product roadmap):**
5. More actions: assign a task (`tasks.php`), reply to a partner message (`partner_messages.php`), move a student's stage.
6. **Phase 6 — CEO/board upward reporting:** a capability that drafts a status update the manager approves and forwards (later: auto-send to a CEO channel). Confirm-gated like any send.
7. Optional: move to an always-on host so the morning briefing/bot don't depend on the PC being on.

**Security housekeeping (with the user):**
8. Rotate the **Groq key** (regenerate at console.groq.com) and **Telegram token** (`@BotFather → /revoke`) — both were shown on screen during setup.
9. **Dashboard password: the user CANNOT change it** (constraint). Mitigation agreed: it lives only in the local git-ignored `.env`, is never committed, and isn't shared further; if ever feasible, ask the CEO for a dedicated “agent” login instead. Do **not** keep pushing them to change it.

---

## 8. How to run & test

```bash
# one-time on the user's PC
npm install
npx playwright install chromium
# (Windows) Set-ExecutionPolicy -Scope CurrentUser RemoteSigned

npm run typecheck        # tsc --noEmit, must stay clean
npm run agent:selftest   # OFFLINE end-to-end vs fixture (no creds needed) — good smoke test
npm run agent:login      # live: log in + print briefing (needs .env)
npm run agent:brief      # briefing on demand;  -- --send (Telegram),  -- --ai (AI intro)
npm run agent:serve      # start the Telegram bot loop
npm run agent:morning    # one-shot morning briefing (for the scheduler)
```

Offline dev without touching the live site: set `HKLV_FIXTURE=fixtures/dashboard.sample.html` (or a saved real page kept OUTSIDE the repo) and run `agent:brief`.

---

## 9. Working style with this user

- They are **non-technical**; give exact clicks/commands, one thing at a time, and confirm each step before moving on.
- They have shared credentials in screenshots/chat during setup — **never echo secret values back**; refer to env var names.
- They value the **confirm-before-acting** safety guarantee — keep every state-changing action gated.

---

*End of handoff. The repo is the source of truth; this file is the map.*
