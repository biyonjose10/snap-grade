"use client";

import { useRef, useState } from "react";
import { SAMPLE_TEST } from "@/lib/sample";
import { finalTotal, toCsv } from "@/lib/auditor";
import type { Audit, GradeEvent, ModelCall, Question, Reading, StepId, TestPaper } from "@/lib/types";

type Status = "capturing" | "grading" | "review" | "approved" | "failed";

interface Script {
  id: string;
  roll: string;
  pages: string[]; // resized JPEG data URLs, kept only in this browser
  status: Status;
  steps: Partial<Record<StepId, { status: string; actor: string; detail?: string }>>;
  readings: Reading[];
  audit: Audit | null;
  marks: Record<string, number | null>; // teacher's final marks (start = proposed)
  calls: ModelCall[];
  error: string | null;
}

const STEP_META: { id: StepId; title: string; actor: string; kind: "model" | "code" }[] = [
  { id: "read", title: "Read the handwriting", actor: "Nemotron 3.5 Super VL", kind: "model" },
  { id: "mark", title: "Propose marks against your rubric", actor: "Nemotron 3 Ultra", kind: "model" },
  { id: "audit", title: "Check totals, caps and doubts", actor: "Auditor (code, no model)", kind: "code" },
];

const MAX_SIDE = 1600;

// Shrinks a phone photo to at most 1600 px on its longest side, as JPEG, before upload.
async function resize(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = fail;
      i.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadTest(): TestPaper {
  try {
    const raw = localStorage.getItem("second-reader.test");
    if (raw) return JSON.parse(raw) as TestPaper;
  } catch {
    /* private mode */
  }
  return SAMPLE_TEST;
}

function newScript(n: number): Script {
  return {
    id: `s${n}`,
    roll: `DEMO-${String(n).padStart(2, "0")}`,
    pages: [],
    status: "capturing",
    steps: {},
    readings: [],
    audit: null,
    marks: {},
    calls: [],
    error: null,
  };
}

export default function Grader() {
  const [test, setTest] = useState<TestPaper>(SAMPLE_TEST);
  const [testOpen, setTestOpen] = useState(false);
  const [scripts, setScripts] = useState<Script[]>([newScript(1)]);
  const [activeId, setActiveId] = useState(scripts[0].id);
  const fileRef = useRef<HTMLInputElement>(null);

  const active = scripts.find((s) => s.id === activeId) ?? scripts[0];
  const update = (id: string, fn: (s: Script) => Script) => setScripts((all) => all.map((s) => (s.id === id ? fn(s) : s)));

  function openTest() {
    if (!testOpen) setTest(loadTest());
    setTestOpen((o) => !o);
  }

  function saveTest(t: TestPaper) {
    setTest(t);
    try {
      localStorage.setItem("second-reader.test", JSON.stringify(t));
    } catch {
      /* fine */
    }
  }

  async function addPages(files: FileList | null) {
    if (!files?.length) return;
    const pages = await Promise.all([...files].map(resize));
    update(active.id, (s) => ({ ...s, pages: [...s.pages, ...pages].slice(0, 6) }));
  }

  async function grade(s: Script) {
    update(s.id, (x) => ({ ...x, status: "grading", steps: {}, readings: [], audit: null, calls: [], error: null }));
    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test, pages: s.pages }),
      });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        update(s.id, (x) => ({ ...x, status: "failed", error: j.error ?? `Request failed (${res.status})` }));
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const line = buf.slice(0, i).split("\n").find((l) => l.startsWith("data: "));
          buf = buf.slice(i + 2);
          if (line) apply(s.id, JSON.parse(line.slice(6)) as GradeEvent);
        }
      }
    } catch (e) {
      update(s.id, (x) => ({ ...x, status: "failed", error: `Connection lost: ${String(e)}` }));
    }
  }

  function apply(id: string, e: GradeEvent) {
    update(id, (s) => {
      switch (e.type) {
        case "step":
          return { ...s, steps: { ...s.steps, [e.step]: { status: e.status, actor: e.actor, detail: e.detail } } };
        case "model_call":
          return { ...s, calls: [...s.calls, e.call] };
        case "readings":
          return { ...s, readings: e.readings };
        case "audit":
          return {
            ...s,
            audit: e.audit,
            status: "review",
            marks: Object.fromEntries(e.audit.questions.map((q) => [q.questionNo, q.proposed])),
          };
        case "error":
          return { ...s, status: "failed", error: e.message };
        default:
          return s;
      }
    });
  }

  function nextScript() {
    const s = newScript(scripts.length + 1);
    setScripts((all) => [...all, s]);
    setActiveId(s.id);
  }

  const allApproved = scripts.some((s) => s.status === "approved") && scripts.every((s) => s.status === "approved" || (s.status === "capturing" && s.pages.length === 0));
  const csv = allApproved ? toCsv(test, scripts.filter((s) => s.status === "approved").map((s) => ({ roll: s.roll, marks: s.marks }))) : null;
  const maxTotal = test.questions.reduce((n, q) => n + q.maxMarks, 0);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-24">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-ballpoint py-5">
        <div>
          <p className="font-pen text-3xl leading-none text-redpen">Second Reader</p>
          <h1 className="mt-1 text-2xl font-bold leading-tight text-ballpoint sm:text-3xl">You mark the scripts. It reads them first.</h1>
        </div>
        <p className="font-mono text-xs text-graphite/70">Nebius Token Factory · NVIDIA Nemotron Super VL + Ultra</p>
      </header>

      <section className="mt-5 border border-rule bg-booklet">
        <button onClick={openTest} aria-expanded={testOpen} className="flex w-full items-center justify-between px-4 py-3 text-left">
          <span>
            <span className="block text-xs uppercase tracking-wider text-graphite/60">Test and rubric</span>
            <span className="font-bold text-ballpoint">{test.title}</span>
            <span className="ml-2 font-mono text-xs text-graphite/70">
              {test.questions.length} questions · {maxTotal} marks
            </span>
          </span>
          <span className="font-mono text-sm">{testOpen ? "close" : "edit"}</span>
        </button>
        {testOpen && <TestEditor test={test} onChange={saveTest} />}
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="min-w-0 space-y-4">
          <div className="ruled border border-rule p-4 pl-14">
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm">
                <span className="block text-xs uppercase tracking-wider text-graphite/60">Roll no (use a dummy one)</span>
                <input
                  value={active.roll}
                  onChange={(e) => update(active.id, (s) => ({ ...s, roll: e.target.value.slice(0, 20) }))}
                  className="mt-1 w-36 border-b-2 border-ballpoint bg-transparent font-mono text-lg text-ballpoint focus:outline-none"
                  disabled={active.status !== "capturing" && active.status !== "failed"}
                />
              </label>
              <span className="font-mono text-xs text-graphite/70">{active.pages.length}/6 pages</span>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={(e) => {
                addPages(e.target.files);
                e.target.value = "";
              }}
            />
            {(active.status === "capturing" || active.status === "failed") && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={active.pages.length >= 6}
                  className="flex size-20 items-center justify-center rounded-full border-4 border-ballpoint bg-booklet text-sm font-bold text-ballpoint disabled:opacity-40"
                  aria-label="Photograph a page"
                >
                  Snap
                </button>
                <button
                  onClick={() => grade(active)}
                  disabled={active.pages.length === 0}
                  className="bg-redpen px-5 py-3 font-bold text-booklet disabled:opacity-40"
                >
                  Read and mark
                </button>
              </div>
            )}

            {active.pages.length > 0 && (
              <ol className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {active.pages.map((p, i) => (
                  <li key={i} className="relative shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p} alt={`Page ${i + 1}`} className="h-28 w-20 border border-rule object-cover" />
                    <span className="absolute left-1 top-1 bg-booklet px-1 font-mono text-[10px]">{i + 1}</span>
                    {active.status === "capturing" && (
                      <button
                        onClick={() => update(active.id, (s) => ({ ...s, pages: s.pages.filter((_, j) => j !== i) }))}
                        className="absolute right-0 top-0 bg-graphite px-1 text-xs text-booklet"
                        aria-label={`Remove page ${i + 1}`}
                      >
                        ×
                      </button>
                    )}
                  </li>
                ))}
              </ol>
            )}

            {active.status !== "capturing" && <Steps script={active} />}
            {active.error && (
              <p role="alert" className="mt-3 bg-highlight/60 px-2 py-1 text-sm">
                {active.error}
              </p>
            )}
          </div>

          <Register
            test={test}
            scripts={scripts}
            activeId={active.id}
            onPick={setActiveId}
            onAdd={nextScript}
            csv={csv}
          />
        </div>

        <div className="min-w-0">
          {active.audit ? (
            <Review
              script={active}
              test={test}
              onMark={(no, v) => update(active.id, (s) => ({ ...s, marks: { ...s.marks, [no]: v } }))}
              onApprove={() => update(active.id, (s) => ({ ...s, status: s.status === "approved" ? "review" : "approved" }))}
            />
          ) : (
            <HowItWorks />
          )}
        </div>
      </section>

      <footer className="mt-16 border-t border-rule pt-4 text-xs text-graphite/70">
        Photos stay in this browser and are sent only to be read; nothing is stored on our server. Use dummy roll numbers. Second Reader proposes; the
        teacher decides every mark.
      </footer>
    </div>
  );
}

function TestEditor({ test, onChange }: { test: TestPaper; onChange: (t: TestPaper) => void }) {
  const setQ = (i: number, q: Partial<Question>) => onChange({ ...test, questions: test.questions.map((x, j) => (j === i ? { ...x, ...q } : x)) });
  const field = "w-full border border-rule bg-booklet px-2 py-1 text-sm focus:border-ballpoint focus:outline-none";
  return (
    <div className="space-y-4 border-t border-rule px-4 py-4">
      <input className={`${field} font-bold`} value={test.title} onChange={(e) => onChange({ ...test, title: e.target.value })} aria-label="Test title" />
      {test.questions.map((q, i) => (
        <div key={i} className="grid grid-cols-[52px_64px_1fr] gap-2">
          <input className={`${field} font-mono`} value={q.no} onChange={(e) => setQ(i, { no: e.target.value })} aria-label="Question number" />
          <input
            className={`${field} font-mono`}
            inputMode="decimal"
            value={q.maxMarks}
            onChange={(e) => setQ(i, { maxMarks: Number(e.target.value) || 0 })}
            aria-label="Maximum marks"
          />
          <div className="space-y-1">
            <input className={field} value={q.prompt} onChange={(e) => setQ(i, { prompt: e.target.value })} aria-label="Question" />
            <textarea className={`${field} min-h-16`} value={q.rubric} onChange={(e) => setQ(i, { rubric: e.target.value })} aria-label="Rubric" />
          </div>
        </div>
      ))}
      <div className="flex gap-3 text-sm">
        <button
          className="underline"
          onClick={() => onChange({ ...test, questions: [...test.questions, { no: String(test.questions.length + 1), maxMarks: 2, prompt: "", rubric: "" }] })}
        >
          Add question
        </button>
        <button className="underline" onClick={() => onChange(SAMPLE_TEST)}>
          Reset to sample test
        </button>
      </div>
    </div>
  );
}

function Steps({ script }: { script: Script }) {
  return (
    <ol className="mt-4 space-y-2" aria-live="polite">
      {STEP_META.map((m) => {
        const st = script.steps[m.id];
        const dot = !st ? "border border-graphite/40" : st.status === "running" ? "bg-highlight animate-pulse" : st.status === "done" ? "bg-ballpoint" : "bg-redpen";
        return (
          <li key={m.id} className={`flex items-start gap-3 ${st ? "" : "opacity-50"}`}>
            <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${dot}`} aria-hidden />
            <span className="text-sm">
              <span className="font-bold">{m.title}</span>{" "}
              <span className={`inline-block border px-1 font-mono text-[11px] ${m.kind === "model" ? "border-redpen text-redpen" : "border-ballpoint text-ballpoint"}`}>
                {st?.actor ?? m.actor}
              </span>
              {st?.detail && <span className="block text-xs text-graphite/80">{st.detail}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Register({
  test,
  scripts,
  activeId,
  onPick,
  onAdd,
  csv,
}: {
  test: TestPaper;
  scripts: Script[];
  activeId: string;
  onPick: (id: string) => void;
  onAdd: () => void;
  csv: string | null;
}) {
  return (
    <div className="border border-rule bg-booklet p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-ballpoint">Marks register</h2>
        <button onClick={onAdd} className="text-sm underline">
          Next script
        </button>
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[360px] border-collapse font-mono text-sm">
          <thead>
            <tr className="border-b-2 border-ballpoint text-left text-xs text-graphite/70">
              <th className="py-1 pr-2">Roll</th>
              {test.questions.map((q) => (
                <th key={q.no} className="px-1 text-center">
                  Q{q.no}
                </th>
              ))}
              <th className="px-1 text-right">Total</th>
              <th className="pl-2 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {scripts.map((s) => (
              <tr
                key={s.id}
                onClick={() => onPick(s.id)}
                className={`cursor-pointer border-b border-rule ${s.id === activeId ? "bg-desk" : ""}`}
              >
                <td className="py-1.5 pr-2 text-ballpoint">{s.roll}</td>
                {test.questions.map((q) => {
                  const flagged = s.audit?.questions.find((x) => x.questionNo === q.no)?.flagged;
                  const v = s.marks[q.no];
                  return (
                    <td key={q.no} className={`px-1 text-center font-pen text-lg text-redpen ${flagged && s.status !== "approved" ? "bg-highlight/70" : ""}`}>
                      {v ?? (s.audit ? "?" : "")}
                    </td>
                  );
                })}
                <td className="px-1 text-right font-pen text-lg text-redpen">{s.audit ? finalTotal(s.marks) : ""}</td>
                <td className="pl-2 text-right text-xs">{{ capturing: "photos", grading: "reading…", review: "to review", approved: "approved", failed: "retry" }[s.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <a
        href={csv ? `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}` : undefined}
        download="marks-register.csv"
        aria-disabled={!csv}
        className={`mt-3 inline-block px-4 py-2 text-sm font-bold ${csv ? "bg-ballpoint text-booklet" : "pointer-events-none bg-graphite/20 text-graphite/50"}`}
      >
        Download marks (CSV)
      </a>
      {!csv && <p className="mt-1 text-xs text-graphite/70">Available once every graded script is approved.</p>}
    </div>
  );
}

function Review({
  script,
  test,
  onMark,
  onApprove,
}: {
  script: Script;
  test: TestPaper;
  onMark: (no: string, v: number | null) => void;
  onApprove: () => void;
}) {
  const a = script.audit!;
  const locked = script.status === "approved";
  const unresolved = a.questions.some((q) => script.marks[q.questionNo] === null || script.marks[q.questionNo] === undefined);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-ballpoint pb-2">
        <h2 className="text-xl font-bold text-ballpoint">
          {script.roll}
          <span className="ml-3 font-pen text-3xl text-redpen">
            {finalTotal(script.marks)}/{a.max}
          </span>
        </h2>
        <button
          onClick={onApprove}
          disabled={unresolved && !locked}
          className={`px-4 py-2 font-bold ${locked ? "border-2 border-ballpoint text-ballpoint" : "bg-ballpoint text-booklet"} disabled:opacity-40`}
        >
          {locked ? "Approved — undo" : "Approve these marks"}
        </button>
      </div>
      {a.flags.length > 0 && (
        <ul className="space-y-1">
          {a.flags.map((f, i) => (
            <li key={i} className="bg-highlight/70 px-2 py-1 text-sm">
              {f.message}
            </li>
          ))}
        </ul>
      )}
      <ol className="space-y-3">
        {a.questions.map((q) => {
          const tq = test.questions.find((x) => x.no === q.questionNo);
          return (
            <li key={q.questionNo} className={`ruled border border-rule py-3 pl-14 pr-3 ${q.flagged ? "outline-4 outline-highlight" : ""}`}>
              <div className="relative">
                <div className="absolute -left-12 top-0 w-10 text-center">
                  <MarkInput
                    key={`${script.id}-${q.questionNo}`}
                    label={`Marks for question ${q.questionNo}`}
                    disabled={locked}
                    value={script.marks[q.questionNo] ?? null}
                    max={q.max}
                    onChange={(v) => onMark(q.questionNo, v)}
                  />
                  <span className="block font-mono text-[10px] text-graphite/60">/{q.max}</span>
                </div>
                <p className="text-xs text-graphite/70">
                  Q{q.questionNo}. {tq?.prompt}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-ballpoint">
                  {q.reading ? (q.reading.present ? q.reading.text : <em className="text-graphite/60">left blank</em>) : <em className="text-graphite/60">not found</em>}
                </p>
                <p className="mt-2 font-pen text-xl leading-tight text-redpen">{q.reason}</p>
                {q.reading && (
                  <p className="mt-1 font-mono text-[10px] text-graphite/60">read with {Math.round(q.reading.legibility * 100)}% confidence</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <details className="border border-rule bg-booklet p-3">
        <summary className="cursor-pointer text-sm font-bold">The pages</summary>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {script.pages.map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={p} alt={`Page ${i + 1}`} className="w-full border border-rule" />
          ))}
        </div>
      </details>
      <CallLog calls={script.calls} />
    </div>
  );
}

// Keeps what the teacher is typing ("1.") as text, and only commits complete numbers.
function MarkInput({
  label,
  disabled,
  value,
  max,
  onChange,
}: {
  label: string;
  disabled: boolean;
  value: number | null;
  max: number;
  onChange: (v: number | null) => void;
}) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  return (
    <input
      aria-label={label}
      disabled={disabled}
      inputMode="decimal"
      value={draft}
      onChange={(e) => {
        const v = e.target.value.replace(/[^\d.]/g, "").slice(0, 5);
        setDraft(v);
        if (v === "") onChange(null);
        else if (/^\d+(\.\d+)?$/.test(v)) onChange(Math.min(max, Number(v)));
      }}
      onBlur={() => setDraft(value === null ? "" : String(value))}
      className="w-10 bg-transparent text-center font-pen text-2xl leading-none text-redpen focus:outline-none"
    />
  );
}

function CallLog({ calls }: { calls: ModelCall[] }) {
  return (
    <details className="border border-rule bg-booklet p-3">
      <summary className="cursor-pointer text-sm font-bold">Model calls ({calls.length})</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[520px] font-mono text-xs">
          <thead>
            <tr className="border-b border-ballpoint text-left text-graphite/70">
              <th className="py-1 pr-2">step</th>
              <th className="pr-2">model</th>
              <th className="pr-2 text-right">ms</th>
              <th className="pr-2 text-right">in / out / cached</th>
              <th>request id</th>
            </tr>
          </thead>
          <tbody>
            {calls.map((c, i) => (
              <tr key={i} className="border-b border-rule">
                <td className="py-1 pr-2">{c.step}</td>
                <td className="pr-2 text-redpen">{c.model}</td>
                <td className="pr-2 text-right">{c.ms}</td>
                <td className="pr-2 text-right">
                  {c.promptTokens ?? "–"} / {c.completionTokens ?? "–"} / {c.cachedTokens ?? "–"}
                </td>
                <td className={c.ok ? "" : "text-redpen"}>{c.ok ? c.requestId : c.error}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function HowItWorks() {
  return (
    <div className="ruled border border-rule py-5 pl-14 pr-5">
      <h2 className="text-xl font-bold text-ballpoint">How it works</h2>
      <ol className="mt-3 space-y-3 text-sm">
        <li>
          <span className="font-bold">1. Snap each page</span> of a script with your phone. Use dummy roll numbers.
        </li>
        <li>
          <span className="font-bold">2. Nemotron 3.5 Super VL</span> reads the handwriting, question by question, and says how sure it is.
        </li>
        <li>
          <span className="font-bold">3. Nemotron 3 Ultra</span> proposes marks strictly against your rubric, with a one-line reason.
        </li>
        <li>
          <span className="font-bold">4. Code</span> caps marks at the maximum, adds the total, and highlights anything blank, unclear or uncertain.
        </li>
        <li>
          <span className="font-bold">5. You approve or change every mark.</span> Then download the register as CSV.
        </li>
      </ol>
      <p className="mt-4 font-pen text-2xl text-redpen">It reads first. You decide.</p>
    </div>
  );
}
