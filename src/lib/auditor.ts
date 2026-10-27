// The Auditor. Plain code: the model proposes marks, but caps, rounding, totals and
// every "please look at this" flag are decided here, so the arithmetic is never a model's.
import type { Audit, AuditedQuestion, Flag, ProposedMark, Reading, TestPaper } from "./types";

export const LEGIBILITY_FLOOR = 0.6;
export const CONFIDENCE_FLOOR = 0.6;

function key(no: string): string {
  return no.trim().toLowerCase().replace(/^q(uestion)?\.?\s*/, "").replace(/[().\s]/g, "");
}

export function roundHalf(n: number): number {
  return Math.round(n * 2) / 2;
}

export function audit(test: TestPaper, readings: Reading[], marks: ProposedMark[]): Audit {
  const flags: Flag[] = [];
  const readingBy = new Map(readings.map((r) => [key(r.questionNo), r]));
  const markBy = new Map(marks.map((m) => [key(m.questionNo), m]));
  const known = new Set(test.questions.map((q) => key(q.no)));

  for (const r of readings) {
    if (!known.has(key(r.questionNo)) && r.present) {
      flags.push({ questionNo: r.questionNo, kind: "extra_answer", message: `An answer labelled "${r.questionNo}" isn't on this test; check the numbering.` });
    }
  }

  const questions: AuditedQuestion[] = test.questions.map((q) => {
    const reading = readingBy.get(key(q.no)) ?? null;
    const mark = markBy.get(key(q.no)) ?? null;
    let flagged = false;
    const flag = (kind: Flag["kind"], message: string) => {
      flags.push({ questionNo: q.no, kind, message });
      flagged = true;
    };

    if (!reading) {
      flag("not_read", `Q${q.no}: no answer was found on the pages. Check whether a page is missing.`);
      return { questionNo: q.no, max: q.maxMarks, reading: null, proposed: null, reason: "Not read", flagged };
    }
    if (!reading.present) {
      flag("missing", `Q${q.no}: left blank.`);
      return { questionNo: q.no, max: q.maxMarks, reading, proposed: 0, reason: "No answer written", flagged };
    }
    if (reading.legibility < LEGIBILITY_FLOOR) {
      flag("illegible", `Q${q.no}: handwriting hard to read (${Math.round(reading.legibility * 100)}%). Please read this one yourself.`);
    }
    if (!mark) {
      flag("not_read", `Q${q.no}: no mark was proposed.`);
      return { questionNo: q.no, max: q.maxMarks, reading, proposed: null, reason: "No mark proposed", flagged };
    }

    let proposed = roundHalf(mark.awarded);
    if (!Number.isFinite(proposed) || proposed < 0) proposed = 0;
    if (proposed > q.maxMarks) {
      flag("over_max", `Q${q.no}: ${mark.awarded} proposed for a ${q.maxMarks}-mark question; capped at ${q.maxMarks}.`);
      proposed = q.maxMarks;
    }
    if (mark.confidence < CONFIDENCE_FLOOR) {
      flag("low_confidence", `Q${q.no}: the marker was unsure (${Math.round(mark.confidence * 100)}%).`);
    }
    return { questionNo: q.no, max: q.maxMarks, reading, proposed, reason: mark.reason, flagged };
  });

  return {
    questions,
    total: questions.reduce((s, q) => s + (q.proposed ?? 0), 0),
    max: test.questions.reduce((s, q) => s + q.maxMarks, 0),
    flags,
  };
}

// Final marks after the teacher's edits; totals recomputed by code.
export function finalTotal(marks: Record<string, number | null>): number {
  return Object.values(marks).reduce<number>((s, m) => s + (m ?? 0), 0);
}

export function toCsv(test: TestPaper, rows: { roll: string; marks: Record<string, number | null> }[]): string {
  const head = ["Roll no", ...test.questions.map((q) => `Q${q.no} (/${q.maxMarks})`), `Total (/${test.questions.reduce((s, q) => s + q.maxMarks, 0)})`];
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = rows.map((r) =>
    [r.roll, ...test.questions.map((q) => (r.marks[q.no] ?? "").toString()), finalTotal(r.marks).toString()].map(esc).join(","),
  );
  return [head.map(esc).join(","), ...lines].join("\r\n") + "\r\n";
}
