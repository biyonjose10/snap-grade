// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { agreement, checkTotals, questionStats, weakest } from "./classwork";
import { audit } from "./auditor";
import { formatCost, runCost } from "./pricing";
import { SAMPLE_TEST } from "./sample";
import type { ProposedMark, Reading } from "./types";

const readings: Reading[] = SAMPLE_TEST.questions.map((q) => ({ questionNo: q.no, text: "answer", legibility: q.no === "3" ? 0.4 : 0.9, present: true }));
const marks: ProposedMark[] = [
  { questionNo: "1", awarded: 2, reason: "", confidence: 0.9 },
  { questionNo: "2", awarded: 1, reason: "", confidence: 0.9 },
  { questionNo: "3", awarded: 3, reason: "", confidence: 0.9 }, // flagged: illegible
  { questionNo: "4", awarded: 0.5, reason: "", confidence: 0.9 },
];

test("agreement counts exact, within half, and whether big misses were already flagged", () => {
  const a = agreement([{ audit: audit(SAMPLE_TEST, readings, marks), hand: { "1": 2, "2": 1.5, "3": 1, "4": null } }]);
  assert.equal(a.compared, 3);
  assert.equal(a.exact, 1);
  assert.equal(a.withinHalf, 2);
  assert.equal(a.bigMisses, 1);
  assert.equal(a.bigMissesFlagged, 1); // Q3 differs by 2 and was flagged as hard to read
  assert.ok(Math.abs(a.meanAbsDiff - 2.5 / 3) < 1e-9);
});

test("class insight finds the question that lost the most marks for its size", () => {
  const stats = questionStats(SAMPLE_TEST, [
    { "1": 2, "2": 1, "3": 1, "4": 2 },
    { "1": 1.5, "2": 2, "3": 1, "4": 2 },
    { "1": 2, "2": 0, "3": null, "4": 1 },
  ]);
  const q3 = stats.find((s) => s.no === "3")!;
  assert.equal(q3.scripts, 2);
  assert.equal(q3.average, 1);
  assert.equal(weakest(stats)?.no, "3"); // 1 of 4 = 25%
  assert.equal(stats.find((s) => s.no === "2")!.zero, 1);
  assert.equal(weakest(questionStats(SAMPLE_TEST, [])), null);
});

test("totalling check catches an addition error and odd marks", () => {
  const ok = checkTotals(SAMPLE_TEST, [
    { questionNo: "Q1", mark: 2, legibility: 0.9 },
    { questionNo: "2", mark: 1.5, legibility: 0.9 },
    { questionNo: "3", mark: 3, legibility: 0.9 },
    { questionNo: "4", mark: 1, legibility: 0.9 },
  ], 7.5);
  assert.equal(ok.sum, 7.5);
  assert.ok(ok.ok);

  const bad = checkTotals(SAMPLE_TEST, [
    { questionNo: "1", mark: 2, legibility: 0.9 },
    { questionNo: "2", mark: 3, legibility: 0.9 }, // over the max of 2
    { questionNo: "3", mark: 1.3, legibility: 0.9 }, // not a half mark
  ], 5);
  assert.equal(bad.sum, 6.3);
  assert.equal(bad.difference, 5 - 6.3);
  assert.ok(!bad.ok);
  assert.ok(bad.issues.some((i) => i.startsWith("Q2: More than")));
  assert.ok(bad.issues.some((i) => i.startsWith("Q3: Not a half")));
  assert.ok(bad.issues.some((i) => i.startsWith("Q4: No mark")));
  assert.ok(bad.issues.some((i) => i.includes("add up to 6.3")));

  const unread = checkTotals(SAMPLE_TEST, [], 10, 0.3);
  assert.equal(unread.difference, null); // an unreadable total is never compared
});

test("cost per call list prices", () => {
  const c = runCost([{ step: "read", model: "nvidia/Nemotron-3.5-Super-VL", requestId: "r", ms: 1, promptTokens: 10_000, completionTokens: 1_000, cachedTokens: 0, ok: true }]);
  assert.ok(Math.abs(c.usd - 0.0039) < 1e-9);
  assert.match(formatCost(c.usd), /^\$0\.0039/);
});

test("marks as models write them", async () => {
  const { markValue } = await import("./classwork");
  assert.equal(markValue(1.5), 1.5);
  assert.equal(markValue("1.5"), 1.5);
  assert.equal(markValue("1½"), 1.5);
  assert.equal(markValue("½"), 0.5);
  assert.equal(markValue(" 2 "), 2);
  assert.equal(markValue("two"), null);
  assert.equal(markValue(""), null);
  assert.equal(markValue(-1), null);
  assert.equal(markValue(null), null);
});
