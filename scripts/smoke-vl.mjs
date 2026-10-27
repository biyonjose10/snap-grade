// Smoke test for Nemotron Super VL on Token Factory: sends one image and prints the reading.
// Usage: node scripts/smoke-vl.mjs path/to/photo.jpg   (reads NEBIUS_API_KEY from ../.env; never prints it)
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
for (const line of readFileSync(resolve(here, "../../.env"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && m[2] && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const key = process.env.NEBIUS_API_KEY;
if (!key) { console.error("NEBIUS_API_KEY missing from ../.env"); process.exit(1); }
const img = process.argv[2];
if (!img || !existsSync(img)) { console.error("Pass the path of a photo of a handwritten page."); process.exit(1); }
const mime = extname(img).toLowerCase() === ".png" ? "image/png" : "image/jpeg";
const model = process.env.MODEL_SUPER_VL ?? "nvidia/Nemotron-3.5-Super-VL";
const t0 = Date.now();
const res = await fetch("https://api.tokenfactory.nebius.com/v1/chat/completions", {
  method: "POST",
  headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    model,
    max_tokens: 1500,
    messages: [{ role: "user", content: [
      { type: "text", text: "Transcribe the handwriting on this page exactly. Then say how legible it was from 0 to 1." },
      { type: "image_url", image_url: { url: `data:${mime};base64,${readFileSync(img).toString("base64")}` } },
    ] }],
  }),
});
const body = await res.json().catch(() => ({}));
console.log(`model=${model} -> HTTP ${res.status} in ${Date.now() - t0} ms`);
if (!res.ok) { console.error(JSON.stringify(body).slice(0, 500)); process.exit(1); }
console.log(`request id: ${body.id}\nusage: ${JSON.stringify(body.usage)}\n\n${body.choices?.[0]?.message?.content}`);
