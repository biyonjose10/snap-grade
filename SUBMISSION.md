# Second Reader — submission kit (drafts)

Everything marked **TODO** needs a real number, quote or clip before submitting. Nothing in the video may show something the live app doesn't do.

---

## 1. Devpost fields

**Name:** Second Reader
**Tagline (≤ 200 chars):** Photograph a handwritten answer script; Nemotron reads it and proposes marks against your rubric, code adds it up and flags doubts, and the teacher approves every mark.
**Track:** Best Apps & Agents
**Built with:** Nebius Token Factory, NVIDIA Nemotron 3.5 Super VL, NVIDIA Nemotron 3 Ultra, Next.js, TypeScript, Vercel
**Demo:** https://second-reader-two.vercel.app · **Repo:** https://github.com/biyonjose10/snap-grade (public at submission)

### Story

**Inspiration**
Faculty mark internal-test scripts by hand, a stack at a time, and mistakes happen at scale: Bangalore University blacklisted 50 evaluators for erroneous marking (Deccan Herald, 9 Jan 2025), and universities run re-totalling as its own process because marks get added up wrong. Reading the handwriting and checking it against the scheme of valuation is slow; the judgement is the teacher's. We wanted a first reader, not a grader.

**What it does**
Snap each page; Nemotron 3.5 Super VL reads every answer; Nemotron 3 Ultra proposes a mark and a reason against the teacher's own rubric; code caps, rounds, totals and flags anything blank, unclear or uncertain. The teacher reviews flagged answers first, adjusts with −½/+½, approves, and moves to the next script. A totalling-check mode catches addition mistakes on scripts already marked by hand.

**How we built it**
Next.js on Vercel. Super VL with thinking off reads pages, answer keys and margin marks (about 5 s a page); Ultra with thinking on proposes marks; a TypeScript auditor owns every number. Photos are resized on the phone and never stored. Unit tests cover the auditor, the agreement score, the class insight, the totalling check and parsing marks like "1½".

**Challenges**
- Models send question numbers as `1` rather than `"1"`, and marks as "1½"; untreated, every answer would have been dropped.
- Nemotron reasons by default; turning it off for transcription made reading fast and cheap, while marking keeps it on.
- Keeping the teacher in charge: nothing exports until every graded script is approved.

**Accomplishments**
- A full read → mark → audit in **10 s** for about **₹0.5** per script.
- On five synthetic test scripts written to known marks (handwriting-style fonts, not real handwriting): **within ½ mark on 20 of 20 answers, exact on 19**.
- The totalling check caught a deliberate slip (written 9, marks add to 8.5); a photographed answer key became the rubric exactly.

**What we learned**
Vision and judgement are different jobs: Super VL transcribes reliably when it doesn't think, Ultra marks better when it does. Rubrics written as marking points ("statement (1), V = IR (1)") make the marker's reasons checkable at a glance.

**What's next**
Testing on more handwriting, diagrams, and a scheme-of-valuation import for whole question papers.

---

## 2. Feedback section

Same as Unclaimed's (one Token Factory account), plus: image input with base64 data URLs worked first time on Super VL; ~1,900 image tokens per page.

---

## 3. Video script (≤ 3:00, screen recording only)

| Time | Shot (screen) | Voiceover |
|---|---|---|
| 0:00–0:10 | A pile of handwritten scripts (photo, no names) → phone opening the app | "Forty scripts, every weekend. Second Reader reads them first; the teacher still decides." |
| 0:10–0:30 | Test editor: "Fill from a photo of the answer key" (only if tested live by then), else the typed rubric | "Set up the test once: questions, maximum marks, and your own rubric." |
| 0:30–0:55 | Phone: Snap two pages of DEMO-01 → Read and mark → steps light up with Super VL and Ultra chips | "Snap each page. Nemotron 3.5 Super VL reads the handwriting; Nemotron 3 Ultra proposes marks against your rubric." |
| 0:55–1:25 | Review: "2 of 4 answers need your eye", flag labels, transcription under the page photos, the red-pen reasons | "Code adds it up and puts anything blank, hard to read or uncertain first. Every mark has a one-line reason you can check." |
| 1:25–1:45 | Tap +½, Approve → "Checked ✓" → Next script | "You adjust, approve, and move on." |
| 1:45–2:05 | Register → "One question, whole class" → class insight line | "Mark one question across the class, and see which question lost the most marks." |
| 2:05–2:25 | "Check it against my own hand marks" with the real agreement sentence | TODO real agreement number from the 5 mock scripts. |
| 2:25–2:45 | Totalling check on a hand-marked script → "Please look again · off by 1" (only if tested live) | "Already marked by hand? It reads your marks and checks the total." |
| 2:45–3:00 | Title card · URL · "Nebius Token Factory · NVIDIA Nemotron" | "Second Reader. It reads first. You decide." |

Recording notes: use the volunteers' mock scripts only (dummy roll numbers, no names). Show real runs; if the totalling check or answer-key fill haven't been run live, cut those shots.

---

## 4. To collect (you)

- 5 mock scripts from volunteers (`../mock-test-for-volunteers.html`), each hand-marked by you first; photos of every page.
- One script you've marked by hand with a deliberate totalling slip; one photo of a typed answer key.
- One faculty quote if possible (first name + department).
