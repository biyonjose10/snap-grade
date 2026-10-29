# Second Reader

**First-pass marking for handwritten answer scripts. It reads first; the teacher decides.**

Live demo: https://second-reader-two.vercel.app · Built for the Nebius x NVIDIA Global AI Hackathon · MIT licence

A teacher photographs each page of a student's script on their phone. **NVIDIA Nemotron 3.5 Super VL** on Nebius Token Factory reads the handwriting question by question, **Nemotron 3 Ultra** proposes marks strictly against the teacher's rubric with a one-line reason, and **plain code** caps marks, rounds to half marks, adds the total and highlights anything blank, unclear or uncertain. Nothing is final until the teacher approves it; then the marks register downloads as CSV.

---

## The problem

Indian college faculty mark stacks of handwritten internal-test scripts by hand, often over a weekend, and a mark added up wrong is a classic reason for re-evaluation requests. Marking needs a teacher's judgement, but reading forty scripts' worth of handwriting, checking each answer against the scheme of valuation and totalling it is slow, repetitive work.

## What it does

**First-pass marking**
1. Set up the test: questions, maximum marks and the rubric, typed or **filled from a photo of the answer key**.
2. Snap each page of a script (resized on the phone to about 1600 px before upload). Roll number only, no names.
3. **Read** (Nemotron 3.5 Super VL): each answer transcribed, with how sure it is.
4. **Mark** (Nemotron 3 Ultra): a proposed mark and a one-line reason per answer, against the rubric.
5. **Audit** (code): caps at the maximum, half-mark rounding, totals, and flags: left blank, hard to read, marker unsure, over max, not read, extra answer.
6. **Review**: flagged answers first, confident ones folded away, the page photos above with tap-to-zoom, −½/+½ buttons or typing, then **Approve** and **Next script**. Snap the next script while one is still being read.
7. **Marks register** (CSV) once every graded script is approved; **mark one question across the whole class**; the question that lost the class the most marks; time and cost per script.
8. **Check against my own hand marks**: type your paper marks and see how far the first pass was, and whether the big gaps were already flagged.

**Totalling check**
Photograph a script you've already marked. Super VL reads only the numbers you wrote; code adds them up and compares with your written total, and flags marks over the maximum or not in half marks.

## Which model does what, and why

| Step | Model / tool | Why |
|---|---|---|
| Read handwriting, answer keys, margin marks | `nvidia/Nemotron-3.5-Super-VL`, thinking off | Vision; transcription is copying, not reasoning (~5 s per page) |
| Propose marks | `nvidia/Nemotron-3-Ultra-550b-a55b`, thinking on | The judgement step: partial credit against a rubric (~4 s) |
| Caps, rounding, totals, flags, agreement, totalling check | TypeScript (`auditor.ts`, `classwork.ts`) | Arithmetic and money-like decisions belong in code |

All calls go through Token Factory's OpenAI-compatible API; images are sent as base64 data URLs.

## Measured so far

- **29 Oct, real calls:** Super VL transcribed a test page exactly in 5.4 s (including "1/R = 1/4 + 1/6 = 5/12"). The full read → mark → audit took **10 s**. Ultra gave Q1 2/2, docked Q2 a mark for the missing heating-effect definition (and accepted Imax/1.414 as Imax/√2), gave Q4 2/2, and the audit flagged the blank Q3.
- **Cost:** about **$0.006 per script** (≈ ₹0.5) at list prices.
- **Agreement with hand marking:** TODO, measured on 5 mock scripts written by volunteers and hand-marked first.

## Run it locally

Key in `../.env` (outside this repo): `NEBIUS_API_KEY=...`

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1           # http://localhost:3001
powershell -ExecutionPolicy Bypass -File .\start.ps1 -Fixture  # layout-only sample reading, no API calls, development only
npm test                                                      # auditor, agreement, class insight, totalling check, mark parsing, cost
npm run smoke:vl -- path\to\page.jpg                          # one Super VL call on a photo
```

## Limitations

- **Not tested on real student handwriting yet** at the time of writing: the test page used a handwriting-style font. Messy handwriting, diagrams and crossed-out text will lower legibility; low-legibility answers are flagged for the teacher to read.
- **The marker can be strict.** On a live test it gave 1/4 where a teacher might give 2, because the rubric asked for fuller descriptions. That's why every mark is a proposal and the agreement check exists.
- **Totalling check and answer-key reading** are built and tested with sample data; their real-model runs come next.
- **Photos stay in the browser** and are sent only to be read; nothing is stored. Use dummy roll numbers.
- **The spend guard is in-memory per server instance**: a brake, not a wall.

## Licence

MIT — see `LICENSE`.
