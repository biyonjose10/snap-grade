// DEVELOPMENT ONLY. A labelled sample reading so the review screen can be laid out before
// model access exists. The API route refuses to use it in production builds. The audit is real.
import type { GradeEvent, ProposedMark, Reading, TestPaper } from "./types";
import { audit } from "./auditor";
import { checkTotals } from "./classwork";

export function fixtureEvents(test: TestPaper): GradeEvent[] {
  const tag = " (dev fixture — not a real run)";
  const readings: Reading[] = [
    { questionNo: "1", text: "Ohms law states that current is directly proportional to voltage. V = IR", legibility: 0.92, present: true },
    { questionNo: "2", text: "RMS value is the effective value of AC. Irms = Imax/√2", legibility: 0.81, present: true },
    { questionNo: "3", text: "In series circuit current is same, in parallel [?] is same. Example: [?] lights", legibility: 0.45, present: true },
    { questionNo: "4", text: "", legibility: 1, present: false },
  ];
  const marks: ProposedMark[] = [
    { questionNo: "1", awarded: 1.5, reason: "Proportionality and V = IR given; 'constant temperature' missing.", confidence: 0.85 },
    { questionNo: "2", awarded: 1, reason: "Formula correct; the heating-effect definition is missing.", confidence: 0.8 },
    { questionNo: "3", awarded: 1.5, reason: "Current/voltage contrast partly given; examples unreadable.", confidence: 0.4 },
    { questionNo: "4", awarded: 0, reason: "No answer", confidence: 1 },
  ];
  return [
    { type: "step", step: "read", status: "done", actor: "Nemotron 3.5 Super VL" + tag, detail: "3 answers read" },
    { type: "readings", readings },
    { type: "step", step: "mark", status: "done", actor: "Nemotron 3 Ultra" + tag, detail: "4 marks proposed" },
    { type: "audit", audit: audit(test, readings, marks) },
    { type: "step", step: "audit", status: "done", actor: "Auditor (code, no model)", detail: "audit output is real" },
    { type: "done" },
  ];
}

// Totalling check sample: the teacher's written total is off by 1. The check itself is real.
export function totalsFixture(test: TestPaper) {
  const marks = test.questions.map((q, i) => ({ questionNo: q.no, mark: Math.max(0, q.maxMarks - (i % 2 ? 1 : 0.5)), legibility: i === 2 ? 0.55 : 0.9 }));
  const sum = marks.reduce((s, m) => s + m.mark, 0);
  return { check: checkTotals(test, marks, sum + 1, 0.95), calls: [], reader: "Nemotron 3.5 Super VL (dev fixture — not a real run)" };
}

// Answer-key sample, shaped like the sample test.
export function rubricFixture() {
  return {
    title: "Basic Electrical Engineering — Internal Test 1 (from key photo, dev fixture)",
    questions: [
      { no: "1", maxMarks: 2, prompt: "State Ohm's law.", rubric: "Current proportional to voltage (1); at constant temperature (½); V = IR (½)" },
      { no: "2", maxMarks: 3, prompt: "Define RMS value.", rubric: "Heating-effect definition (2); Irms = Imax/√2 (1)" },
    ],
    calls: [],
    reader: "Nemotron 3.5 Super VL (dev fixture — not a real run)",
  };
}
