// Synthetic benchmark: grades the five rendered scripts (scripts/synth-scripts.ps1) through the
// real /api/grade route and compares the first pass with the marks each answer was written to
// earn. Also runs the totalling check and the answer-key reader once. Needs the dev server on
// :3001 with NEBIUS_API_KEY. Usage: npx tsx scripts/bench.mts
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { SAMPLE_TEST } from "../src/lib/sample";
import { agreement } from "../src/lib/classwork";
import { runCost, formatCost } from "../src/lib/pricing";
import type { Audit, GradeEvent, ModelCall } from "../src/lib/types";

const dir = resolve(import.meta.dirname, "../.cache/synth");
const BASE = "http://localhost:3001";
const img = (f: string) => "data:image/jpeg;base64," + readFileSync(resolve(dir, f)).toString("base64");

// The marks each answer was written to earn against the sample rubric.
const INTENDED: Record<string, Record<string, number>> = {
  "SYN-01": { "1": 2, "2": 2, "3": 4, "4": 2 },
  "SYN-02": { "1": 1, "2": 1, "3": 2, "4": 2 },
  "SYN-03": { "1": 2, "2": 1, "3": 0, "4": 0 },
  "SYN-04": { "1": 2, "2": 2, "3": 3, "4": 1 },
  "SYN-05": { "1": 2, "2": 2, "3": 2, "4": 2 },
};

const calls: ModelCall[] = [];
const rows: { roll: string; audit: Audit; ms: number }[] = [];
for (const roll of Object.keys(INTENDED)) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/grade`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ test: SAMPLE_TEST, pages: [img(`${roll}.jpg`)] }) });
  let audit: Audit | null = null;
  for (const block of (await res.text()).split("\n\n")) {
    const line = block.split("\n").find((l) => l.startsWith("data: "));
    if (!line) continue;
    const e = JSON.parse(line.slice(6)) as GradeEvent;
    if (e.type === "model_call") calls.push(e.call);
    if (e.type === "audit") audit = e.audit;
    if (e.type === "error") console.log(`${roll} ERROR ${e.message}`);
  }
  if (!audit) continue;
  const ms = Date.now() - t0;
  rows.push({ roll, audit, ms });
  const got = audit.questions.map((q) => `Q${q.questionNo} ${q.proposed ?? "-"}/${INTENDED[roll][q.questionNo]}${q.flagged ? "*" : ""}`).join("  ");
  console.log(`${roll}  ${(ms / 1000).toFixed(0)} s  total ${audit.total} vs ${Object.values(INTENDED[roll]).reduce((a, b) => a + b, 0)}   ${got}`);
  for (const q of audit.questions) {
    const d = Math.abs((q.proposed ?? 0) - INTENDED[roll][q.questionNo]);
    if (d > 0.5) console.log(`    gap Q${q.questionNo}: read "${q.reading?.text.slice(0, 90)}" | ${q.reason}`);
  }
}

const ag = agreement(rows.map((r) => ({ audit: r.audit, hand: INTENDED[r.roll] })));
const totals = rows.filter((r) => Math.abs(r.audit.total - Object.values(INTENDED[r.roll]).reduce((a, b) => a + b, 0)) <= 1).length;
console.log(
  `\nAGREEMENT: within ½ mark on ${ag.withinHalf} of ${ag.compared} answers (${Math.round((ag.withinHalf / ag.compared) * 100)}%), exact on ${ag.exact}; ` +
    `mean gap ${ag.meanAbsDiff.toFixed(2)}; ${ag.bigMisses} bigger gaps, ${ag.bigMissesFlagged} already flagged; totals within 1 mark on ${totals} of ${rows.length} scripts.`,
);
console.log(`Avg ${(rows.reduce((s, r) => s + r.ms, 0) / rows.length / 1000).toFixed(1)} s per script · Nemotron ${formatCost(runCost(calls).usd / rows.length)} per script`);

// Totalling check on a hand-marked script with a slip (2 + 1.5 + 3 + 2 = 8.5, written 9).
const tot = await (await fetch(`${BASE}/api/totals`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ test: SAMPLE_TEST, pages: [img("MARKED-01.jpg")] }) })).json();
console.log(`\nTOTALS: ${tot.error ?? `ok=${tot.check.ok} sum=${tot.check.sum} written=${tot.check.writtenTotal} | ${tot.check.issues.join(" | ")} | marks ${tot.check.rows.map((r: { no: string; mark: number | null }) => `Q${r.no}=${r.mark}`).join(" ")}`}`);

// Answer key photo -> rubric.
const key = await (await fetch(`${BASE}/api/rubric`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pages: [img("KEY-01.jpg")] }) })).json();
console.log(`\nKEY: ${key.error ?? key.questions.map((q: { no: string; maxMarks: number; rubric: string }) => `Q${q.no} [${q.maxMarks}] ${q.rubric.slice(0, 60)}`).join("\n     ")}`);

writeFileSync(resolve(dir, "bench-result.json"), JSON.stringify({ at: new Date().toISOString(), rows, intended: INTENDED, agreement: ag, totals: tot, key }, null, 1));
