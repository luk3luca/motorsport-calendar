/* Verifica freschezza dati: generatedAt, finestra, sessioni prossime settimane con orari reali vs placeholder */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { CalendarData } from "../src/types";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const data: CalendarData = JSON.parse(
  readFileSync(join(ROOT, "data", "calendar-2026.json"), "utf8"),
);

console.log("generatedAt:", data.generatedAt);
console.log("window:", data.windowStart?.slice(0, 10), "→", data.windowEnd?.slice(0, 10));
console.log("total sessions:", data.sessions.length);

const today = new Date().toISOString().slice(0, 10);
const horizon = new Date(Date.now() + 42 * 86_400_000).toISOString().slice(0, 10); // 6 settimane
console.log(`\nSessioni ${today} → ${horizon} (prossime 6 settimane):\n`);

const byWeekend = new Map<string, { series: string; name: string; startUtc: string; tbc: boolean }[]>();
for (const s of data.sessions) {
  if (s.startUtc.slice(0, 10) < today || s.startUtc.slice(0, 10) > horizon) continue;
  const wk = s.startUtc.slice(0, 10);
  if (!byWeekend.has(wk)) byWeekend.set(wk, []);
  byWeekend.get(wk)!.push({
    series: s.series,
    name: s.name,
    startUtc: s.startUtc,
    tbc: s.isEstimatedStart,
  });
}

for (const [day, list] of [...byWeekend.entries()].sort()) {
  const seriesSet = [...new Set(list.map((x) => x.series))];
  const tbcCount = list.filter((x) => x.tbc).length;
  console.log(`${day}: ${list.length} sessioni (${seriesSet.join(", ")}) — TBC: ${tbcCount}/${list.length}`);
}

// Dettaglio serie con TBC nelle prossime 3 settimane
const threeWk = new Date(Date.now() + 21 * 86_400_000).toISOString().slice(0, 10);
console.log("\nDettaglio TBC entro", threeWk, ":");
for (const s of data.sessions) {
  if (s.startUtc.slice(0, 10) < today || s.startUtc.slice(0, 10) > threeWk) continue;
  if (s.isEstimatedStart) {
    console.log(`  TBC: [${s.series}] ${s.name} @ ${s.venue}`);
  }
}
