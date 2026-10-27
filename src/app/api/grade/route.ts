// POST /api/grade — reads one script's pages (Nemotron 3.5 Super VL), proposes marks
// (Nemotron 3 Ultra), audits them in code, and streams each step as Server-Sent Events.
import { admit } from "@/lib/guard";
import { chatJson, hasNebiusKey, labelOf, MODELS } from "@/lib/nebius";
import { audit } from "@/lib/auditor";
import { MARKER_SYSTEM, markerUser, READER_SYSTEM, readerText } from "@/lib/prompts";
import type { GradeEvent, ModelCall, ProposedMark, Reading, TestPaper } from "@/lib/types";

export const maxDuration = 300;

const MAX_PAGES = 6;
const MAX_PAGE_CHARS = 1_400_000; // ~1 MB JPEG as a data URL

function parse(body: unknown): { test: TestPaper; pages: string[] } | null {
  if (!body || typeof body !== "object") return null;
  const { test, pages } = body as { test?: TestPaper; pages?: unknown };
  if (!test || typeof test.title !== "string" || !Array.isArray(test.questions) || test.questions.length === 0 || test.questions.length > 30) return null;
  for (const q of test.questions) {
    if (typeof q.no !== "string" || typeof q.maxMarks !== "number" || q.maxMarks <= 0 || q.maxMarks > 100) return null;
    if (typeof q.prompt !== "string" || typeof q.rubric !== "string" || q.prompt.length > 1000 || q.rubric.length > 3000) return null;
  }
  if (!Array.isArray(pages) || pages.length === 0 || pages.length > MAX_PAGES) return null;
  if (!pages.every((p) => typeof p === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(p) && p.length <= MAX_PAGE_CHARS)) return null;
  return { test, pages: pages as string[] };
}

function sse(events: GradeEvent[]): Response {
  return new Response(events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(""), {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request): Promise<Response> {
  const input = parse(await req.json().catch(() => null));
  if (!input) return Response.json({ error: "Add at least one page (up to 6) and a test with questions." }, { status: 400 });
  if (process.env.NODE_ENV === "development" && process.env.DEV_FIXTURE === "1") {
    const { fixtureEvents } = await import("@/lib/devFixture");
    return sse(fixtureEvents(input.test));
  }
  if (!hasNebiusKey()) return sse([{ type: "error", message: "The model service isn't configured on this server yet." }, { type: "done" }]);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const gate = admit(ip);
  if (!gate.ok) return sse([{ type: "error", message: gate.reason }, { type: "done" }]);

  const { test, pages } = input;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: GradeEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          /* client went away */
        }
      };
      const onCall = (call: ModelCall) => emit({ type: "model_call", call });
      try {
        // 1. Read
        emit({ type: "step", step: "read", status: "running", actor: labelOf(MODELS.superVl) });
        let readings: Reading[];
        try {
          const out = await chatJson<{ answers?: Reading[] }>({
            model: MODELS.superVl,
            step: "read",
            system: READER_SYSTEM,
            user: [{ type: "text", text: readerText(test, pages.length) }, ...pages.map((url) => ({ type: "image_url" as const, image_url: { url } }))],
            maxTokens: 6000,
            temperature: 0,
            onCall,
          });
          readings = (out.answers ?? [])
            .filter((a) => a && typeof a.questionNo === "string")
            .map((a) => ({
              questionNo: a.questionNo,
              text: String(a.text ?? ""),
              legibility: typeof a.legibility === "number" ? Math.max(0, Math.min(1, a.legibility)) : 0,
              present: a.present !== false && String(a.text ?? "").trim().length > 0,
            }));
        } catch {
          emit({ type: "step", step: "read", status: "failed", actor: labelOf(MODELS.superVl), detail: "Couldn't read the pages" });
          emit({ type: "error", message: "The pages couldn't be read. Try clearer, well-lit photos, one page per photo." });
          return;
        }
        emit({ type: "readings", readings });
        emit({ type: "step", step: "read", status: "done", actor: labelOf(MODELS.superVl), detail: `${readings.filter((r) => r.present).length} answers read from ${pages.length} page(s)` });

        // 2. Mark
        emit({ type: "step", step: "mark", status: "running", actor: labelOf(MODELS.ultra) });
        let marks: ProposedMark[] = [];
        try {
          const out = await chatJson<{ marks?: ProposedMark[] }>({
            model: MODELS.ultra,
            step: "mark",
            system: MARKER_SYSTEM,
            user: markerUser(test, readings),
            maxTokens: 8000,
            temperature: 0.1,
            onCall,
          });
          marks = (out.marks ?? [])
            .filter((m) => m && typeof m.questionNo === "string" && typeof m.awarded === "number")
            .map((m) => ({ ...m, reason: String(m.reason ?? ""), confidence: typeof m.confidence === "number" ? m.confidence : 0 }));
          emit({ type: "step", step: "mark", status: "done", actor: labelOf(MODELS.ultra), detail: `${marks.length} marks proposed` });
        } catch {
          emit({ type: "step", step: "mark", status: "failed", actor: labelOf(MODELS.ultra), detail: "No marks proposed; mark by hand from the transcription" });
        }

        // 3. Audit
        const a = audit(test, readings, marks);
        emit({ type: "audit", audit: a });
        emit({ type: "step", step: "audit", status: "done", actor: "Auditor (code, no model)", detail: `${a.flags.length} item(s) for you to check` });
      } catch (e) {
        emit({ type: "error", message: `Grading stopped unexpectedly: ${String(e).slice(0, 200)}` });
      } finally {
        emit({ type: "done" });
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store, no-transform" } });
}
