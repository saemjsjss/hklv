# Hanyang IEI — Agency Application Bot

A standalone tool that fills the **Hanyang University International Education
Institute** application (한양대학교 국제교육원 원서접수시스템) for a study agency, one
student per spreadsheet row. Built to handle **~60–70 applications per semester**.

It is deliberately **separate** from the dashboard agent — its own project, no
shared code.

## The flow it automates

```
portal.hanyang.ac.kr/haksa/wons/wonsH.do?yim=1
   → click 지원서작성 (Write application)
   → tick 동의함 (필수정보) consent → 다음
   → "Study Agency Insert Mode" form  → fill from the spreadsheet
   → pause for your confirmation before the final submit
```

Runs in **Chrome (headed)** so you can watch it work.

## What you fill in

1. **`Hanyang_Students_Template.xlsx`** — one row per student. See the **Guide**
   tab inside it for every rule; the **Students** tab is where you type.
2. **`uploads/<folder>/`** — one folder per student, named to match the
   `Student Folder` column (e.g. `01_RAHMAN_SAEM`), containing standard filenames
   the bot uploads automatically:

   | File in the folder | Uploaded to | Notes |
   | --- | --- | --- |
   | `photo.jpg` | 사진 | JPEG only, **20KB or less** |
   | `passport.jpg` | 여권파일 | jpg or pdf |
   | `education.pdf` | 최종학력서류 | final education document |
   | `gap.pdf` | 공백기 증명 | gap-period proof, only if applicable |

## Design decisions

- **Registration dropdowns (등록정보)** — 등록학기수, 희망 수업 시간대, 레벨테스트, 자모반,
  기숙사, 납부방법 — are **left as-is** (not filled per student). Say the word if any
  should vary per student and they become spreadsheet columns.
- **Passwords** — leave the `Password` column blank and the bot generates a
  compliant 10–15 char password and records it, so the student can later edit
  their application (지원서수정). Or set your own.
- **Privacy** — real photos, passports, education documents and filled sheets are
  git-ignored; only the blank template and an example upload folder are tracked.

## To confirm against the live form

Exact dropdown option text (Gender, Highest Education, Visa Type, Preferred
Language), the Nationality list, and placement of the amber "Visa & other"
fields. Save the logged-in form page (Chrome → Save Page As → *Webpage,
Complete*) and share the HTML to lock these down.

## Status

- [x] Student spreadsheet template + per-student upload convention
- [ ] Bot: Chrome automation of the flow above (next)
