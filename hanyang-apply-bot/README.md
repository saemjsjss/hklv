# Hanyang IEI — Agency Application Bot

A standalone tool that fills the **Hanyang University International Education
Institute** application (한양대학교 국제교육원 원서접수시스템) for a study agency, one
student per spreadsheet row. Built for **~60–70 applications per semester** — you
drop in the Excel file and the files, run it once, and it works through every
student one after another until finished.

It is deliberately **separate** from the dashboard agent — its own project, no
shared code.

## The flow it automates

```
portal.hanyang.ac.kr/haksa/wons/wonsH.do?yim=1
   → click 지원서작성 (Write application)
   → tick 동의함 (필수정보) consent → 다음
   → "Study Agency Insert Mode" form  → fill from the spreadsheet
   → (dry run) pause / (submit mode) submit → next student…
```

Runs in **Chrome (headed)** so you can watch it work.

## What you provide

1. **`Hanyang_Students_Template.xlsx`** — one row per student. See the **Guide**
   tab for every rule; type students on the **Students** tab from row 4.
2. **`uploads/<folder>/`** — one folder per student, named to match the
   `Student Folder` column (e.g. `01_RAHMAN_SAEM`), with standard filenames:

   | File in the folder | Uploaded to | Notes |
   | --- | --- | --- |
   | `photo.jpg` | Photo | JPEG only, **20KB or less** |
   | `passport.jpg` | Passport file | jpg or pdf |
   | `gap.pdf` | Proof of gap period | if applicable |
   | `education.pdf` | Documents of the last degree | final education document |
   | `financial.pdf` | Financial Statement | |
   | `family.pdf` | Family Relationship documents | |
   | `other.pdf` | Other documents | optional |

The template mirrors the whole portal, section by section (General → Registration
→ Personal → Education → VISA → Korean Learning Experience → Study Plan →
Emergency Contact → Agent → Statements), with every dropdown as a column.

## How to run (Windows)

1. One-time setup: install [Node.js 20+](https://nodejs.org). Double-click
   **`RUN_TEST_ONE.bat`** once — it installs everything on first run.
2. **`RUN_TEST_ONE.bat`** — fills just the first student, does **not** submit.
   Use this to sanity-check against the live form.
3. **`RUN_FILL_ALL.bat`** — fills **every** student, still does not submit;
   saves a screenshot per student to `output/screenshots/`.
4. **`RUN_SUBMIT_ALL.bat`** — the real run: fills **and submits** each
   application until finished (asks you to type YES first).

On macOS/Linux use `./run.sh` (dry run) or `HY_SUBMIT=true ./run.sh`.

Every run appends `output/submissions.csv` with each student's account email,
the (auto-generated if blank) **password**, and the status — keep this; the
student needs the password to edit their application later (지원서수정).

Configuration lives in `.env` (copy from `.env.example`): the URL, Chrome vs
bundled Chromium, submit on/off, `HY_ONLY` / `HY_LIMIT` filters, etc.

## Design decisions

- **Registration dropdowns (등록정보)** — 등록학기수, 희망 수업 시간대, 레벨테스트, 자모반,
  기숙사, 납부방법 — are **left as-is** (not filled per student). Say the word if any
  should vary per student and they become spreadsheet columns.
- **Label-based selectors** — the bot finds each field by its Korean row label,
  not brittle ids, so it survives the SPA's generated markup.
- **Safe by default** — dry run fills without submitting; submission is opt-in.
- **Passwords** — blank in the sheet → a compliant 10–15 char password is
  generated and recorded in `output/submissions.csv`.
- **Privacy** — real photos, passports, education documents, filled sheets, and
  the output ledger are all git-ignored.

## Offline self-test

`npm run selftest` drives a local HTML fixture through the whole flow + fill
code and asserts every field lands (no network, no credentials). Use it after
any change.

## To finalize against the live form

Run **`PROBE_FORM.bat`** with the portal in **English** — it saves
`output/form.html` with every field label, dropdown option, and button text.
Send me `form.html` and I'll:
- replace the `(confirm)` option lists (Level Test, Payment, Purpose, Estimated
  Period, VISA status) and the Nationality list with the portal's exact text, and
- wire the bot's field map to fill **all** the portal's sections (the reader and
  template already cover them; the fill map is being extended to the full English
  form and the newer sections next).

## Status

- [x] Spreadsheet template mirrors the whole portal (49 fields) + 7-file upload convention
- [x] Reader parses all sections; offline self-test green (30/30)
- [x] Bot: Chrome automation, batch runner — fills the core fields today
- [ ] Extend the fill map to every section + exact dropdown text (from `form.html`)
