// POST /api/totals — totalling check on a script the teacher has already marked.
// Nemotron 3.5 Super VL reads the marks written on the pages; code adds them up and
// compares with the written total. Returns JSON (one model call, no streaming needed).
import { admit } from "@/lib/guard";
import { chatJson, hasNebiusKey, labelOf, MODELS } from "@/lib/nebius";
import { checkTotals, markValue, type MarginRead } from "@/lib/classwork";
import { TOTALS_SYSTEM, totalsText } from "@/lib/prompts";
import type { ModelCall, TestPaper } from "@/lib/types";
import { ipOf, validPages } from "../_shared";

export const maxDuration = 120;

function validTest(t: unknown): t is TestPaper {
  const x = t as TestPaper;
  return Boolean(x && typeof x.title === "string" && Array.isArray(x.questions) && x.questions.length > 0 && x.questions.length <= 30 &&
    x.questions.every((q) => typeof q.no === "string" && typeof q.maxMarks === "number" && q.maxMarks > 0 && q.maxMarks <= 100));
}

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { test?: unknown; pages?: unknown } | null;
  if (!body || !validTest(body.test) || !validPages(body.pages)) {
    return Response.json({ error: "Add at least one page (up to 6) of a marked script, and a test with questions." }, { status: 400 });
  }
  const { test, pages } = body as { test: TestPaper; pages: string[] };

  if (process.env.NODE_ENV === "development" && process.env.DEV_FIXTURE === "1") {
    const { totalsFixture } = await import("@/lib/devFixture");
    return Response.json(totalsFixture(test));
  }
  if (!hasNebiusKey()) return Response.json({ error: "The model service isn't configured on this server yet." }, { status: 503 });
  const gate = admit(ipOf(req));
  if (!gate.ok) return Response.json({ error: gate.reason }, { status: 429 });

  const calls: ModelCall[] = [];
  try {
    const out = await chatJson<{ marks?: MarginRead[]; writtenTotal?: number | null; totalLegibility?: number }>({
      model: MODELS.superVl,
      step: "read",
      system: TOTALS_SYSTEM,
      user: [{ type: "text", text: totalsText(test, pages.length) }, ...pages.map((url) => ({ type: "image_url" as const, image_url: { url } }))],
      maxTokens: 3000,
      temperature: 0,
      onCall: (c) => calls.push(c),
    });
    const read: MarginRead[] = (out.marks ?? [])
      .filter((m) => m && (typeof m.questionNo === "string" || typeof m.questionNo === "number"))
      .map((m) => ({
        questionNo: String(m.questionNo),
        mark: markValue(m.mark),
        legibility: typeof m.legibility === "number" ? Math.max(0, Math.min(1, m.legibility)) : 0,
      }));
    const written = markValue(out.writtenTotal);
    const tl = typeof out.totalLegibility === "number" ? out.totalLegibility : 0;
    return Response.json({ check: checkTotals(test, read, written, tl), calls, reader: labelOf(MODELS.superVl) });
  } catch {
    return Response.json({ error: "The marks couldn't be read. Try clearer, well-lit photos, one page per photo.", calls }, { status: 502 });
  }
}
