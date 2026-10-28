// Helpers shared by the photo routes: page validation and one-shot SSE replies.
import type { GradeEvent } from "@/lib/types";

export const MAX_PAGES = 6;
const MAX_PAGE_CHARS = 1_400_000; // ~1 MB JPEG as a data URL

export function validPages(pages: unknown, max = MAX_PAGES): pages is string[] {
  return (
    Array.isArray(pages) &&
    pages.length > 0 &&
    pages.length <= max &&
    pages.every((p) => typeof p === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(p) && p.length <= MAX_PAGE_CHARS)
  );
}

export function ipOf(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

export function sse(events: GradeEvent[]): Response {
  return new Response(events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(""), {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store" },
  });
}
