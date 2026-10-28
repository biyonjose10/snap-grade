// Prompts for the two model roles: the Reader (Super VL) and the Marker (Ultra).
import type { Reading, TestPaper } from "./types";

export const READER_SYSTEM = `You transcribe handwritten answer scripts from Indian college internal tests. You only read; you never judge or mark.

Reply with JSON only:
{"answers": [{"questionNo": string, "text": string, "legibility": number, "present": boolean}]}

Rules:
1. One entry per question on the test, in the test's numbering (e.g. "1", "2", "3a"). Students label answers "Q1", "1)", "Ans 1" and so on; map them to the test's numbers.
2. "text": what the student wrote, as faithfully as you can, keeping their wording and mistakes. Write formulas in plain text (V = IR, 1/R = 1/4 + 1/6). Describe a diagram in square brackets, e.g. [circuit diagram: two resistors in parallel].
3. "legibility": 0 to 1, how sure you are of your transcription. Below 0.6 means a teacher should read it themself. Mark unclear words as [?].
4. "present": false if the question has no answer on any page. Then text is "".
5. Ignore crossed-out text. If an answer continues on a later page, join it.
6. If a page contains an answer to a question that is not on the test, include it with its own label.
7. Never fix, complete or improve an answer.`;

export function readerText(test: TestPaper, pageCount: number): string {
  return `Test: ${test.title}
Questions:
${test.questions.map((q) => `${q.no}. ${q.prompt} [${q.maxMarks} marks]`).join("\n")}

The next ${pageCount} image${pageCount === 1 ? " is" : "s are"} the student's answer pages, in order.`;
}

export const MARKER_SYSTEM = `You propose marks for a student's answers in an Indian college internal test, strictly against the teacher's rubric. A teacher reviews and approves every mark; you are the first reader, not the final word.

Reply with JSON only:
{"marks": [{"questionNo": string, "awarded": number, "reason": string, "confidence": number}]}

Rules:
1. Follow the rubric's marking points exactly. Award a point only when the answer contains it, in any wording. Half marks are allowed.
2. Never award more than the question's maximum.
3. "reason": one sentence a teacher can check quickly, naming which rubric points were met and which were missed.
4. "confidence": 0 to 1. Lower it when the transcription has [?] or low legibility, when the answer is ambiguous, or when the rubric doesn't cover what the student wrote.
5. A blank answer gets 0 with reason "No answer".
6. Spelling and grammar do not lose marks unless the rubric says so. Units count if the rubric asks for them.
7. Do not reward length; reward the marking points.`;

export function markerUser(test: TestPaper, readings: Reading[]): string {
  const byNo = new Map(readings.map((r) => [r.questionNo, r]));
  return `Test: ${test.title}

${test.questions
  .map((q) => {
    const r = byNo.get(q.no);
    return `Question ${q.no} [max ${q.maxMarks}]: ${q.prompt}
Rubric: ${q.rubric}
Student's answer (legibility ${r ? Math.round(r.legibility * 100) + "%" : "n/a"}): ${r ? (r.present ? r.text : "(blank)") : "(not found)"}`;
  })
  .join("\n\n")}`;
}

// ---- Totalling check: read a script the teacher has ALREADY marked (Super VL) ----

export const TOTALS_SYSTEM = `You read the marks a teacher has written on an already-marked answer script from an Indian college internal test. You only read numbers; you never mark or add.

Reply with JSON only:
{"marks": [{"questionNo": string, "mark": number | null, "legibility": number}], "writtenTotal": number | null, "totalLegibility": number}

Rules:
1. One entry per question on the test, in the test's numbering. Teachers write marks in the margin or beside the answer, often circled, sometimes as "1½" or "1.5" (both mean 1.5).
2. "mark": the number the teacher wrote for that question. null if there is no mark for it. If a mark is crossed out and rewritten, use the rewritten one.
3. "writtenTotal": the total the teacher wrote, usually on the first page or in a marks box. null if none.
4. "legibility" and "totalLegibility": 0 to 1, how sure you are of each number.
5. Do not add anything up and do not correct the teacher's numbers. Report exactly what is written.`;

export function totalsText(test: TestPaper, pageCount: number): string {
  return `Test: ${test.title}
Questions and maximum marks:
${test.questions.map((q) => `${q.no} [max ${q.maxMarks}]`).join("\n")}

The next ${pageCount} image${pageCount === 1 ? " is" : "s are"} the marked script, in order.`;
}

// ---- Rubric from a photo of the answer key (Super VL) ----

export const KEY_SYSTEM = `You turn a photo of a teacher's answer key or scheme of valuation for an Indian college internal test into a structured rubric. You only transcribe; you never add marking points of your own.

Reply with JSON only:
{"title": string, "questions": [{"no": string, "maxMarks": number, "prompt": string, "rubric": string}]}

Rules:
1. "no": the question number as printed ("1", "2a").
2. "maxMarks": the marks for that question as printed. If not printed, use 0.
3. "prompt": the question text if it is on the key, otherwise "".
4. "rubric": the expected answer and marking points exactly as written, with their marks, e.g. "Statement (1); V = IR (½); constant temperature (½)".
5. Keep the key's order. Skip anything that is not a question.`;
