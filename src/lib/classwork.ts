// Plain-code views across a class: how far the first-pass marks are from the teacher's own
// hand marks, which question lost the most marks, and the totalling check on a marked
// script. No model decides any of these numbers.
import type { Audit, TestPaper } from "./types";
import { roundHalf } from "./auditor";

// ---- Agreement with the teacher's hand marks ----

export interface AgreementRow {
  audit: Audit; // the first pass, before any teacher edits
  hand: Record<string, number | null>; // the teacher's own marks, entered separately
}

export interface Agreement {
  compared: number; // answers with both a proposed mark and a hand mark
  exact: number;
  withinHalf: number; // |diff| <= 0.5
  meanAbsDiff: number;
  bigMisses: number; // |diff| > 0.5
  bigMissesFlagged: number; // ...of which the auditor had already flagged for review
}

export function agreement(rows: AgreementRow[]): Agreement {
  const a: Agreement = { compared: 0, exact: 0, withinHalf: 0, meanAbsDiff: 0, bigMisses: 0, bigMissesFlagged: 0 };
  let sum = 0;
  for (const r of rows) {
    for (const q of r.audit.questions) {
      const h = r.hand[q.questionNo];
      if (q.proposed === null || h === null || h === undefined) continue;
      const d = Math.abs(q.proposed - h);
      a.compared++;
      sum += d;
      if (d === 0) a.exact++;
      if (d <= 0.5) a.withinHalf++;
      else {
        a.bigMisses++;
        if (q.flagged) a.bigMissesFlagged++;
      }
    }
  }
  a.meanAbsDiff = a.compared ? sum / a.compared : 0;
  return a;
}

// ---- Class insight ----

export interface QuestionStat {
  no: string;
  max: number;
  scripts: number;
  average: number;
  share: number; // average / max, 0..1
  fullMarks: number;
  zero: number;
}

export function questionStats(test: TestPaper, marked: Record<string, number | null>[]): QuestionStat[] {
  return test.questions.map((q) => {
    const vals = marked.map((m) => m[q.no]).filter((v): v is number => typeof v === "number");
    const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
    return {
      no: q.no,
      max: q.maxMarks,
      scripts: vals.length,
      average: avg,
      share: q.maxMarks ? avg / q.maxMarks : 0,
      fullMarks: vals.filter((v) => v >= q.maxMarks).length,
      zero: vals.filter((v) => v === 0).length,
    };
  });
}

// The question that lost the class the most marks, relative to its maximum.
export function weakest(stats: QuestionStat[]): QuestionStat | null {
  const withData = stats.filter((s) => s.scripts > 0);
  if (withData.length === 0) return null;
  return withData.reduce((w, s) => (s.share < w.share ? s : w));
}

// ---- Marks as models write them ----

// 1.5, "1.5", "1½", "½" and "2" are marks; anything else (words, "1/2 + 1") is unread.
export function markValue(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? v : null;
  if (typeof v !== "string") return null;
  const m = v.trim().match(/^(\d*)(?:\.(\d+))?\s*(½)?$/);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  return Number(m[1] || 0) + (m[2] ? Number(`0.${m[2]}`) : 0) + (m[3] ? 0.5 : 0);
}

// ---- Totalling check on a script the teacher has already marked ----

export interface MarginRead {
  questionNo: string;
  mark: number | null; // null if no mark is written or it can't be read
  legibility: number;
}

export interface TotalsCheck {
  rows: { no: string; max: number; mark: number | null; issue: string | null }[];
  sum: number;
  writtenTotal: number | null;
  difference: number | null; // writtenTotal - sum
  ok: boolean;
  issues: string[];
}

const LEGIBLE = 0.6;

function k(no: string): string {
  return no.trim().toLowerCase().replace(/^q(uestion)?\.?\s*/, "").replace(/[().\s]/g, "");
}

export function checkTotals(test: TestPaper, read: MarginRead[], writtenTotal: number | null, totalLegibility = 1): TotalsCheck {
  const by = new Map(read.map((r) => [k(r.questionNo), r]));
  const issues: string[] = [];
  const rows = test.questions.map((q) => {
    const r = by.get(k(q.no));
    let issue: string | null = null;
    if (!r || r.mark === null) issue = "No mark found";
    else if (r.legibility < LEGIBLE) issue = `Hard to read (${Math.round(r.legibility * 100)}%)`;
    else if (r.mark > q.maxMarks) issue = `More than the ${q.maxMarks} allowed`;
    else if (r.mark < 0) issue = "Negative mark";
    else if (roundHalf(r.mark) !== r.mark) issue = "Not a half or whole mark";
    if (issue) issues.push(`Q${q.no}: ${issue}`);
    return { no: q.no, max: q.maxMarks, mark: r?.mark ?? null, issue };
  });
  const sum = rows.reduce((s, r) => s + (r.mark ?? 0), 0);
  let difference: number | null = null;
  if (writtenTotal === null) issues.push("No written total found on the script");
  else if (totalLegibility < LEGIBLE) issues.push(`The written total is hard to read (${Math.round(totalLegibility * 100)}%)`);
  else {
    difference = writtenTotal - sum;
    if (difference !== 0) issues.push(`Written total is ${writtenTotal}, but the marks add up to ${sum}`);
  }
  return { rows, sum, writtenTotal, difference, ok: issues.length === 0, issues };
}
