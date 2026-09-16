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
   | `photo.jpg` | 사진 | JPEG only, **20KB or less** |
   | `passport.jpg` | 여권파일 | jpg or pdf |
   | `education.pdf` | 최종학력서류 | final education document |
   | `gap.pdf` | 공백기 증명 | gap-period proof, only if applicable |

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

## To confirm against the live form

Exact dropdown option text (Gender, 최종취득학력, 비자구분, 선호언어), the full 국적
list, and the final submit button text (`HY_SUBMIT_TEXT`, default `저장`). The
first `RUN_TEST_ONE.bat` against the live form will surface any mismatch — send
me a saved copy of the page (Chrome → Save Page As → *Webpage, Complete*) and I
lock them down.

## Status

- [x] Student spreadsheet template + per-student upload convention
- [x] Bot: Chrome automation of the flow, batch runner, offline self-test (29/29)
- [ ] Field selectors / dropdown values verified against the live portal
