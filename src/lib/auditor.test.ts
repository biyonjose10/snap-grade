// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { audit, roundHalf, toCsv } from "./auditor";
import { SAMPLE_TEST } from "./sample";

test("totals and caps are computed by code, not taken from the model", () => {
  const a = audit(
    SAMPLE_TEST,
    [
      { questionNo: "1", text: "V = IR", legibility: 0.9, present: true },
      { questionNo: "2", text: "rms is effective value", legibility: 0.8, present: true },
      { questionNo: "3", text: "series one path, parallel many", legibility: 0.85, present: true },
      { questionNo: "4", text: "2.4 ohm", legibility: 0.95, present: true },
    ],
    [
      { questionNo: "1", awarded: 2, reason: "Correct", confidence: 0.9 },
      { questionNo: "2", awarded: 1.3, reason: "Partly", confidence: 0.8 },
      { questionNo: "3", awarded: 7, reason: "Generous", confidence: 0.9 },
      { questionNo: "4", awarded: 2, reason: "Correct", confidence: 0.95 },
    ],
  );
  assert.equal(a.questions[1].proposed, 1.5); // rounded to half marks
  assert.equal(a.questions[2].proposed, 4); // capped at max
  assert.ok(a.flags.some((f) => f.kind === "over_max" && f.questionNo === "3"));
  assert.equal(a.total, 2 + 1.5 + 4 + 2);
  assert.equal(a.max, 10);
});

test("blank, illegible, unsure and unread answers are flagged for the teacher", () => {
  const a = audit(
    SAMPLE_TEST,
    [
      { questionNo: "Q1", text: "", legibility: 1, present: false },
      { questionNo: "2.", text: "??", legibility: 0.3, present: true },
      { questionNo: "(3)", text: "series...", legibility: 0.9, present: true },
      { questionNo: "7", text: "stray answer", legibility: 0.9, present: true },
    ],
    [
      { questionNo: "2", awarded: 1, reason: "Hard to read", confidence: 0.4 },
      { questionNo: "3", awarded: 3, reason: "Good", confidence: 0.9 },
    ],
  );
  const kinds = a.flags.map((f) => `${f.questionNo}:${f.kind}`);
  assert.ok(kinds.includes("1:missing"));
  assert.ok(kinds.includes("2:illegible"));
  assert.ok(kinds.includes("2:low_confidence"));
  assert.ok(kinds.includes("4:not_read"));
  assert.ok(kinds.includes("7:extra_answer"));
  assert.equal(a.questions[0].proposed, 0);
  assert.equal(a.questions[3].proposed, null);
});

test("roundHalf and CSV export", () => {
  assert.equal(roundHalf(1.74), 1.5);
  assert.equal(roundHalf(1.76), 2);
  const csv = toCsv(SAMPLE_TEST, [{ roll: "DEMO-01", marks: { "1": 2, "2": 1.5, "3": 3, "4": null } }]);
  assert.equal(csv.split("\r\n")[0], "Roll no,Q1 (/2),Q2 (/2),Q3 (/4),Q4 (/2),Total (/10)");
  assert.equal(csv.split("\r\n")[1], "DEMO-01,2,1.5,3,,6.5");
});
