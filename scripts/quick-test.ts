import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  fetchEventsDayLeague,
  TsdRateLimitError,
  normalizeTsdEvent,
} from "../src/lib/sources/thesportsdb";
import { LEAGUES } from "../src/lib/sources/leagues";
import type { CalendarData, Session, SeriesId } from "../src/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");

const THROTTLE_MS = 2100;

function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cur.getTime() <= end.getTime()) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  const from = "2026-07-03";
  const to = "2026-07-05";
  const days = eachDay(from, to);
  const seriesIncluded: SeriesId[] = [];
  const events = [];
  for (const league of LEAGUES) {
    process.stdout.write(`=== ${league.label} ===\n`);
    seriesIncluded.push(league.series);
    for (const d of days) {
      await sleep(THROTTLE_MS);
      try {
        const evs = await fetchEventsDayLeague(d, league.leagueId);
        events.push(...evs);
        process.stdout.write(`  ${d}: ${evs.length} events\n`);
      } catch (err) {
        if (err instanceof TsdRateLimitError) {
          process.stdout.write(`  ${d}: 429 SKIP\n`);
        } else {
          process.stdout.write(`  ${d}: ERR ${(err as Error).message}\n`);
        }
      }
    }
  }
  mkdirSync(DATA_DIR, { recursive: true });
  const sessions: Session[] = [];
  for (const e of events) {
    const s = normalizeTsdEvent(e);
    if (s) sessions.push(s);
  }
  sessions.sort((a, b) => a.startUtc.localeCompare(b.startUtc));
  const payload: CalendarData = {
    generatedAt: new Date().toISOString(),
    windowStart: `${from}T00:00:00.000Z`,
    windowEnd: `${to}T23:59:59.999Z`,
    seriesIncluded,
    sessions,
  };
  writeFileSync(join(DATA_DIR, "calendar-2026-dev.json"), JSON.stringify(payload, null, 2));
  process.stdout.write(`Wrote calendar-2026-dev.json with ${sessions.length} sessions\n`);
  for (const s of sessions.slice(0, 30)) {
    process.stdout.write(`  ${s.startUtc} [${s.series}] ${s.name} @ ${s.venue} (${s.country}) end=${s.endUtc}\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});