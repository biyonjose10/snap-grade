# Snap-Grade — progress log

Resume order: `../PLAN.md` → this file → `features.json` → `git log`.
One entry per working session or verified feature: time (IST), what changed, evidence.

## 2026-10-28 03:00 IST
- Idea picked by user. PLAN.md + features.json written. No code yet.
- Starts Thu 29 Oct 12:00 IST, only if entry A passes the gate (deployed and working end to end in incognito).
- Next: smoke test B01 (Super VL accepts images via Token Factory). If that fails, B is not viable — see PLAN.md risks.

## 2026-10-28 ~03:30–04:00 IST — early scaffold (before the Thu gate; entry A was blocked on the Nebius key)
Built: sample test + rubric editor (`sample.ts`), Auditor (`auditor.ts`: half-mark rounding, max caps, blank /
illegible / unsure / not-read / extra-answer flags, CSV), Super VL Reader + Ultra Marker prompts and the
`/api/grade` SSE route, capture with on-phone resize, marks register, review/approve screen, call log.
Private repo biyonjose10/snap-grade; Vercel project `second-reader` → https://second-reader-two.vercel.app
(protection off; page HTTP 200; `/api/grade` with an empty body → 400).

Evidence (dev server, fixture mode `start.ps1 -Fixture`, every model step labelled "dev fixture — not a real run"):
- B03 resize: injected a 2400×3400 JPEG → stored at 1129×1600, ~24 KB per page. (Real phone still to test → B03 stays false.)
- B06 auditor: `npm test` 3/3; review screen shows Q3 illegible (45%) + unsure (40%), Q4 blank; total 4/10 by code.
- B07 review: edited Q3 to 2 → total 4.5; export disabled until approved; typing "1.5" now works (draft input).
- B08 CSV after approve: `Roll no,Q1 (/2),Q2 (/2),Q3 (/4),Q4 (/2),Total (/10)` / `DEMO-01,1.5,1,2,0,4.5`.
- B11 layout: 1280 px and 375 px; fixed a 35 px phone overflow (grid min-width) → scrollWidth 375 = clientWidth.
- B02 test editor: sample test loads; edits persist to localStorage.

Not verified (needs NEBIUS_API_KEY / a real phone): B01, B03 on a phone, B04, B05, B09 with real calls, B10, B12, B13.
- B02 verified properly: edited the title → reload → editor shows the saved title. Found and fixed a bug on the way:
  after a reload, grading used the sample test unless the editor was reopened. Now `grade()` loads the saved test
  first; verified: saved a 2-question test, reloaded, graded (fixture) → review shows 2 questions, 2.5/4.
