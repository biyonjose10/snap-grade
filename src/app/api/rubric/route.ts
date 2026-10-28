// POST /api/rubric — turns a photo of the answer key into the test's questions and rubric
// (Nemotron 3.5 Super VL). The teacher reviews the result in the editor before using it.
import { admit } from "@/lib/guard";
import { chatJson, hasNebiusKey, labelOf, MODELS } from "@/lib/nebius";
import { KEY_SYSTEM } from "@/lib/prompts";
import { markValue } from "@/lib/classwork";
import type { ModelCall, Question } from "@/lib/types";
import { ipOf, validPages } from "../_shared";

export const maxDuration = 120;

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { pages?: unknown } | null;
  if (!body || !validPages(body.pages, 3)) return Response.json({ error: "Add one to three photos of the answer key." }, { status: 400 });
  const pages = body.pages as string[];

  if (process.env.NODE_ENV === "development" && process.env.DEV_FIXTURE === "1") {
    const { rubricFixture } = await import("@/lib/devFixture");
    return Response.json(rubricFixture());
  }
  if (!hasNebiusKey()) return Response.json({ error: "The model service isn't configured on this server yet." }, { status: 503 });
  const gate = admit(ipOf(req));
  if (!gate.ok) return Response.json({ error: gate.reason }, { status: 429 });

  const calls: ModelCall[] = [];
  try {
    const out = await chatJson<{ title?: string; questions?: Partial<Question>[] }>({
      model: MODELS.superVl,
      step: "read",
      system: KEY_SYSTEM,
      user: [{ type: "text", text: `The next ${pages.length} image(s) are the answer key.` }, ...pages.map((url) => ({ type: "image_url" as const, image_url: { url } }))],
      maxTokens: 6000,
      temperature: 0,
      onCall: (c) => calls.push(c),
    });
    const questions: Question[] = (out.questions ?? [])
      .filter((q) => q && (typeof q.no === "string" || typeof q.no === "number"))
      .slice(0, 30)
      .map((q) => ({
        no: String(q.no).trim().slice(0, 8),
        maxMarks: ((m) => (m !== null && m > 0 && m <= 100 ? m : 0))(markValue(q.maxMarks)),
        prompt: String(q.prompt ?? "").slice(0, 1000),
        rubric: String(q.rubric ?? "").slice(0, 3000),
      }));
    if (questions.length === 0) return Response.json({ error: "No questions could be read from the key.", calls }, { status: 422 });
    return Response.json({ title: String(out.title ?? "").slice(0, 120), questions, calls, reader: labelOf(MODELS.superVl) });
  } catch {
    return Response.json({ error: "The answer key couldn't be read. Try a clearer photo.", calls }, { status: 502 });
  }
}
