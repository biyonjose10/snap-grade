// Spend guard: keeps a public demo URL from draining the hackathon credits (counts scripts graded).
// In-memory per server instance, so it is a brake, not a wall; the Token Factory
// and Tavily dashboards remain the hard limit.

const perIp = new Map<string, number[]>();
let day = "";
let dayCount = 0;

export function admit(ip: string): { ok: true } | { ok: false; reason: string } {
  const PER_IP_PER_HOUR = Number(process.env.RUNS_PER_IP_PER_HOUR ?? 5);
  const DAILY_CEILING = Number(process.env.DAILY_RUN_CEILING ?? 60);
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    dayCount = 0;
  }
  if (dayCount >= DAILY_CEILING) {
    return { ok: false, reason: "Today's demo budget is used up. Please try again tomorrow." };
  }
  const now = Date.now();
  const recent = (perIp.get(ip) ?? []).filter((t) => now - t < 3600_000);
  if (recent.length >= PER_IP_PER_HOUR) {
    return { ok: false, reason: `You've graded ${PER_IP_PER_HOUR} scripts this hour on this demo. Please try again a bit later.` };
  }
  recent.push(now);
  perIp.set(ip, recent);
  dayCount++;
  return { ok: true };
}
