"use client";

// Panels around the main grading flow: marking one question across the class, the class
// summary (agreement with hand marks, weakest question, cost), the totalling check, and a
// full-screen page viewer. Every number here is computed in code.
import { useRef, useState } from "react";
import { agreement, questionStats, weakest, type TotalsCheck } from "@/lib/classwork";
import { formatCost, runCost } from "@/lib/pricing";
import type { ModelCall, TestPaper } from "@/lib/types";
import type { Script } from "./Grader";

// ---- Full-screen page viewer ----

export function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div role="dialog" aria-label="Page" className="fixed inset-0 z-50 flex items-center justify-center bg-graphite/90 p-3" onClick={onClose}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Answer page" className="max-h-full max-w-full object-contain" />
      <button onClick={onClose} className="absolute right-3 top-3 bg-booklet px-3 py-1 font-bold text-ballpoint">
        Close
      </button>
    </div>
  );
}

// ---- One question across every graded script ----

export function ByQuestion({
  test,
  scripts,
  onMark,
}: {
  test: TestPaper;
  scripts: Script[];
  onMark: (scriptId: string, no: string, v: number | null) => void;
}) {
  const [no, setNo] = useState(test.questions[0]?.no ?? "");
  const q = test.questions.find((x) => x.no === no) ?? test.questions[0];
  const graded = scripts.filter((s) => s.audit);
  if (!q) return null;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 border-b-2 border-ballpoint pb-2">
        <span className="text-sm font-bold text-ballpoint">Mark question</span>
        {test.questions.map((x) => (
          <button
            key={x.no}
            onClick={() => setNo(x.no)}
            className={`min-w-10 border px-2 py-1 font-mono text-sm ${x.no === q.no ? "border-ballpoint bg-ballpoint text-booklet" : "border-rule text-ballpoint"}`}
          >
            Q{x.no}
          </button>
        ))}
      </div>
      <p className="text-sm">
        <span className="font-bold">Q{q.no}.</span> {q.prompt} <span className="font-mono text-xs text-graphite/60">/{q.maxMarks}</span>
        <span className="mt-1 block text-xs text-graphite/70">Rubric: {q.rubric}</span>
      </p>
      {graded.length === 0 && <p className="text-sm text-graphite/70">Grade a script first.</p>}
      <ol className="space-y-2">
        {graded.map((s) => {
          const aq = s.audit!.questions.find((x) => x.questionNo === q.no);
          const locked = s.status === "approved";
          const v = s.marks[q.no] ?? null;
          return (
            <li key={s.id} className={`ruled border border-rule py-2 pl-14 pr-3 ${aq?.flagged && !locked ? "outline-4 outline-highlight" : ""}`}>
              <div className="relative">
                <span className="absolute -left-12 top-0 w-10 text-center font-pen text-2xl leading-none text-redpen">{v ?? "?"}</span>
                <p className="font-mono text-xs text-graphite/60">
                  {s.roll}
                  {locked && " · approved"}
                </p>
                <p className="text-ballpoint">
                  {aq?.reading ? (aq.reading.present ? aq.reading.text : <em className="text-graphite/60">left blank</em>) : <em className="text-graphite/60">not found</em>}
                </p>
                {aq?.reason && <p className="font-pen text-lg leading-tight text-redpen">{aq.reason}</p>}
                {!locked && (
                  <div className="mt-1 flex gap-2">
                    {[-0.5, 0.5].map((d) => (
                      <button
                        key={d}
                        onClick={() => onMark(s.id, q.no, Math.min(q.maxMarks, Math.max(0, (v ?? 0) + d)))}
                        className="min-w-12 border border-ballpoint px-2 py-0.5 font-mono text-sm text-ballpoint"
                      >
                        {d < 0 ? "−½" : "+½"}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ---- Class summary: hand-mark agreement, weakest question, cost and time ----

export function ClassPanel({
  test,
  scripts,
  onHand,
}: {
  test: TestPaper;
  scripts: Script[];
  onHand: (scriptId: string, no: string, v: number | null) => void;
}) {
  const [compare, setCompare] = useState(false);
  const graded = scripts.filter((s) => s.audit);
  if (graded.length === 0) return null;

  const approved = graded.filter((s) => s.status === "approved");
  const stats = questionStats(test, approved.map((s) => s.marks));
  const weak = approved.length >= 2 ? weakest(stats) : null;

  const calls: ModelCall[] = graded.flatMap((s) => s.calls);
  const cost = runCost(calls);
  const timed = graded.filter((s) => s.ms !== null);
  const avgS = timed.length ? timed.reduce((n, s) => n + (s.ms ?? 0), 0) / timed.length / 1000 : null;

  const ag = agreement(graded.map((s) => ({ audit: s.audit!, hand: s.hand })));

  return (
    <div className="space-y-3 border border-rule bg-booklet p-4">
      <h2 className="font-bold text-ballpoint">This class so far</h2>

      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs uppercase tracking-wider text-graphite/60">Scripts read</dt>
          <dd className="font-mono text-lg">{graded.length}</dd>
        </div>
        {avgS !== null && (
          <div>
            <dt className="text-xs uppercase tracking-wider text-graphite/60">Time per script</dt>
            <dd className="font-mono text-lg">{avgS.toFixed(0)} s</dd>
          </div>
        )}
        {cost.priced > 0 && (
          <div>
            <dt className="text-xs uppercase tracking-wider text-graphite/60">Nemotron cost per script</dt>
            <dd className="font-mono text-lg">{formatCost(cost.usd / graded.length)}</dd>
          </div>
        )}
      </dl>

      {weak && (
        <p className="bg-highlight/50 px-2 py-1 text-sm">
          <b>Q{weak.no}</b> lost the class the most marks: average {weak.average.toFixed(1)} of {weak.max}
          {weak.zero > 0 && <>, {weak.zero} scored zero</>} ({approved.length} approved scripts).
        </p>
      )}

      <div>
        <button onClick={() => setCompare((c) => !c)} aria-expanded={compare} className="text-sm underline">
          {compare ? "Hide" : "Check it against"} my own hand marks
        </button>
        {compare && (
          <div className="mt-2 space-y-2">
            <p className="text-xs text-graphite/70">
              Mark the paper scripts yourself first, then type your marks here. This compares them with Second Reader&apos;s first pass, before
              any edits.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] font-mono text-sm">
                <thead>
                  <tr className="border-b border-ballpoint text-left text-xs text-graphite/70">
                    <th className="py-1 pr-2">Roll</th>
                    {test.questions.map((q) => (
                      <th key={q.no} className="px-1 text-center">
                        Q{q.no}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {graded.map((s) => (
                    <tr key={s.id} className="border-b border-rule">
                      <td className="py-1 pr-2 text-ballpoint">{s.roll}</td>
                      {test.questions.map((q) => (
                        <td key={q.no} className="px-1 text-center">
                          <HandInput
                            label={`Your mark for ${s.roll} question ${q.no}`}
                            max={q.maxMarks}
                            value={s.hand[q.no] ?? null}
                            onChange={(v) => onHand(s.id, q.no, v)}
                          />
                          <span className="block text-[10px] text-graphite/50">AI {s.audit!.questions.find((x) => x.questionNo === q.no)?.proposed ?? "–"}</span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {ag.compared > 0 && (
              <p className="text-sm">
                Within ½ mark on <b>{ag.withinHalf}</b> of {ag.compared} answers ({Math.round((ag.withinHalf / ag.compared) * 100)}%), exact on {ag.exact}. Average gap{" "}
                {ag.meanAbsDiff.toFixed(2)} marks.
                {ag.bigMisses > 0 && (
                  <>
                    {" "}
                    Of the {ag.bigMisses} bigger gap{ag.bigMisses === 1 ? "" : "s"}, {ag.bigMissesFlagged} {ag.bigMissesFlagged === 1 ? "was" : "were"} already highlighted for you to check.
                  </>
                )}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function HandInput({ label, max, value, onChange }: { label: string; max: number; value: number | null; onChange: (v: number | null) => void }) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      value={draft}
      onChange={(e) => {
        const v = e.target.value.replace(/[^\d.]/g, "").slice(0, 5);
        setDraft(v);
        if (v === "") onChange(null);
        else if (/^\d+(\.\d+)?$/.test(v)) onChange(Math.min(max, Number(v)));
      }}
      className="w-10 border-b border-ballpoint bg-transparent text-center focus:outline-none"
    />
  );
}

// ---- Totalling check on scripts the teacher has already marked ----

export function TotalsPanel({ test, resize }: { test: TestPaper; resize: (f: File) => Promise<string> }) {
  const [pages, setPages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ check: TotalsCheck; reader: string; calls: ModelCall[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function check() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/totals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ test, pages }) });
      const j = await res.json();
      if (!res.ok) setError(j.error ?? `Request failed (${res.status})`);
      else setResult(j);
    } catch (e) {
      setError(`Connection lost: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const c = result?.check;
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <div className="ruled min-w-0 border border-rule p-4 pl-14">
        <h2 className="text-lg font-bold text-ballpoint">Totalling check</h2>
        <p className="text-sm text-graphite/80">
          Photograph a script <b>you have already marked</b>. Second Reader reads the marks you wrote and adds them up in code, to catch a slip
          before the marks go out.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={async (e) => {
            // Copy the files before clearing the input: clearing empties the same FileList.
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            if (!files.length) return;
            const add = await Promise.all(files.map(resize));
            setPages((p) => [...p, ...add].slice(0, 6));
            setResult(null);
          }}
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={pages.length >= 6}
            className="flex size-20 items-center justify-center rounded-full border-4 border-ballpoint bg-booklet text-sm font-bold text-ballpoint disabled:opacity-40"
            aria-label="Photograph a marked page"
          >
            Snap
          </button>
          <button onClick={check} disabled={pages.length === 0 || busy} className="bg-redpen px-5 py-3 font-bold text-booklet disabled:opacity-40">
            {busy ? "Reading marks…" : "Check the totals"}
          </button>
          {pages.length > 0 && (
            <button
              onClick={() => {
                setPages([]);
                setResult(null);
              }}
              className="text-sm underline"
            >
              Next script
            </button>
          )}
        </div>
        {pages.length > 0 && (
          <ol className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {pages.map((p, i) => (
              <li key={i} className="shrink-0">
                <button onClick={() => setZoom(p)} aria-label={`Open page ${i + 1}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p} alt={`Page ${i + 1}`} className="h-28 w-20 border border-rule object-cover" />
                </button>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-3 font-mono text-[11px] text-graphite/60">
          Reads with <span className="text-redpen">Nemotron 3.5 Super VL</span>; adds up with code (no model).
        </p>
      </div>

      <div className="min-w-0">
        {error && (
          <p role="alert" className="bg-highlight/60 px-3 py-2 text-sm">
            {error}
          </p>
        )}
        {c && result && (
          <div className="space-y-3">
            <div className={`border-2 p-4 ${c.ok ? "border-ballpoint" : "border-redpen"}`}>
              <p className={`font-pen text-4xl leading-none ${c.ok ? "text-ballpoint" : "text-redpen"}`}>{c.ok ? "Totals check out ✓" : "Please look again"}</p>
              <p className="mt-2 font-mono text-sm">
                Marks add up to <b>{c.sum}</b>
                {c.writtenTotal !== null && (
                  <>
                    {" "}
                    · written total <b>{c.writtenTotal}</b>
                  </>
                )}
                {c.difference !== null && c.difference !== 0 && <span className="text-redpen"> · off by {Math.abs(c.difference)}</span>}
              </p>
              <p className="font-mono text-[11px] text-graphite/60">Read by {result.reader}</p>
            </div>
            {c.issues.length > 0 && (
              <ul className="space-y-1">
                {c.issues.map((i) => (
                  <li key={i} className="bg-highlight/70 px-2 py-1 text-sm">
                    {i}
                  </li>
                ))}
              </ul>
            )}
            <table className="w-full border-collapse font-mono text-sm">
              <thead>
                <tr className="border-b-2 border-ballpoint text-left text-xs text-graphite/70">
                  <th className="py-1">Question</th>
                  <th className="text-right">Mark read</th>
                  <th className="text-right">Max</th>
                </tr>
              </thead>
              <tbody>
                {c.rows.map((r) => (
                  <tr key={r.no} className={`border-b border-rule ${r.issue ? "bg-highlight/50" : ""}`}>
                    <td className="py-1">Q{r.no}</td>
                    <td className="text-right font-pen text-xl text-redpen">{r.mark ?? "?"}</td>
                    <td className="text-right">{r.max}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {result.calls.length > 0 && (
              <p className="font-mono text-[11px] text-graphite/60">
                {result.calls.map((x) => `${x.model} · ${x.ms} ms · ${x.requestId ?? "no id"}`).join(" | ")}
              </p>
            )}
          </div>
        )}
        {!c && !error && (
          <div className="ruled border border-rule py-5 pl-14 pr-5 text-sm">
            <p className="font-bold text-ballpoint">Why a totalling check?</p>
            <p className="mt-1">
              Re-evaluation requests often come down to a mark added up wrong. This reads only the numbers you wrote, so it works even when the
              handwriting in the answers is hard to read.
            </p>
          </div>
        )}
      </div>
      {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}
