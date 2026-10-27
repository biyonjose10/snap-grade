// DEVELOPMENT ONLY. A labelled sample reading so the review screen can be laid out before
// model access exists. The API route refuses to use it in production builds. The audit is real.
import type { GradeEvent, ProposedMark, Reading, TestPaper } from "./types";
import { audit } from "./auditor";

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
