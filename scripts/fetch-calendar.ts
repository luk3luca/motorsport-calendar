import { writeFileSync, readFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  fetchEventsDayLeague,
  TsdRateLimitError,
  normalizeTsdEvent,
  type TsdEvent,
} from "../src/lib/sources/thesportsdb";
import { fetchFiaSeriesCalendar, getFiaSeries } from "../src/lib/sources/fia";
import { LEAGUES } from "../src/lib/sources/leagues";
import type { CalendarData, Session, SeriesId } from "../src/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");
const CACHE_DIR = join(DATA_DIR, ".fetch-cache");

const THROTTLE_MS = 2100;
const RETRY_WAIT_MS = 60_000;
const WINDOW_END = "2026-12-31";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

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

interface LeagueCheckpoint {
  leagueId: number;
  label: string;
  daysDone: string[];
  events: TsdEvent[];
}

function loadCheckpoint(leagueId: number): LeagueCheckpoint | null {
  const p = join(CACHE_DIR, `league-${leagueId}.json`);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as LeagueCheckpoint;
  } catch {
    return null;
  }
}

function saveCheckpoint(c: LeagueCheckpoint): void {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(join(CACHE_DIR, `league-${c.leagueId}.json`), JSON.stringify(c, null, 2));
}

async function fetchLeague(leagueId: number, label: string, days: string[]): Promise<TsdEvent[]> {
  const checkpoint = loadCheckpoint(leagueId);
  const doneSet = new Set<string>(checkpoint?.daysDone ?? []);
  const events: TsdEvent[] = checkpoint ? [...checkpoint.events] : [];

  const total = days.length;
  for (let i = 0; i < total; i++) {
    const d = days[i];
    if (doneSet.has(d)) continue;
    const idx = `[${i + 1}/${total}]`;
    process.stdout.write(`${idx} ${label} ${d} ... `);
    let ok = false;
    for (let attempt = 0; attempt < 2 && !ok; attempt++) {
      await sleep(THROTTLE_MS);
      try {
        const evs = await fetchEventsDayLeague(d, leagueId);
        for (const e of evs) events.push(e);
        process.stdout.write(`${evs.length} events\n`);
        ok = true;
      } catch (err) {
        if (err instanceof TsdRateLimitError) {
          if (attempt === 0) {
            process.stdout.write(`429, waiting 60s ... `);
            await sleep(RETRY_WAIT_MS);
          } else {
            process.stdout.write(`429 again, skipping\n`);
          }
        } else {
          process.stdout.write(`error: ${(err as Error).message}\n`);
          ok = true;
        }
      }
    }
    doneSet.add(d);
    saveCheckpoint({ leagueId, label, daysDone: [...doneSet], events });
  }
  return events;
}

function dedupeEvents(events: TsdEvent[]): TsdEvent[] {
  const seen = new Set<string>();
  const out: TsdEvent[] = [];
  for (const e of events) {
    if (e.idEvent && !seen.has(e.idEvent)) {
      seen.add(e.idEvent);
      out.push(e);
    }
  }
  return out;
}

async function main(): Promise<void> {
  mkdirSync(DATA_DIR, { recursive: true });
  const from = todayIso();
  const days = eachDay(from, WINDOW_END);
  const seriesIncluded: SeriesId[] = [];

  /* ------------------------------------------------------------------ */
  /*  1. Fetch TheSportsDB for all leagues EXCEPT those we get from FIA */
  /* ------------------------------------------------------------------ */
  const fiaSeries = getFiaSeries(); // ["f2", "f3"]
  const tsdLeagues = LEAGUES.filter((l) => !fiaSeries.includes(l.series));

  const allEvents: TsdEvent[] = [];
  for (const league of tsdLeagues) {
    process.stdout.write(`\n=== ${league.label} (id ${league.leagueId}) [TheSportsDB] ===\n`);
    const evs = await fetchLeague(league.leagueId, league.label, days);
    allEvents.push(...evs);
    seriesIncluded.push(league.series);
  }

  process.stdout.write(`\nTotal raw events from TheSportsDB: ${allEvents.length}\n`);
  const deduped = dedupeEvents(allEvents);
  process.stdout.write(`After dedupe: ${deduped.length}\n`);

  const sessions: Session[] = [];
  for (const e of deduped) {
    const s = normalizeTsdEvent(e);
    if (s) sessions.push(s);
  }

  /* ------------------------------------------------------------------ */
  /*  2. Fetch FIA sources (F2, F3) — they have complete session data   */
  /* ------------------------------------------------------------------ */
  for (const series of fiaSeries) {
    process.stdout.write(`\n=== ${series.toUpperCase()} [FIA source] ===\n`);
    try {
      const fiaSessions = await fetchFiaSeriesCalendar(series);
      process.stdout.write(`  Fetched ${fiaSessions.length} sessions from FIA source\n`);
      sessions.push(...fiaSessions);
      seriesIncluded.push(series);
    } catch (err) {
      process.stdout.write(`  ERROR fetching FIA source for ${series}: ${(err as Error).message}\n`);
      // Fallback: try TheSportsDB for this series
      const league = LEAGUES.find((l) => l.series === series);
      if (league) {
        process.stdout.write(`  Falling back to TheSportsDB for ${league.label}...\n`);
        const evs = await fetchLeague(league.leagueId, league.label, days);
        for (const e of evs) {
          const s = normalizeTsdEvent(e);
          if (s) sessions.push(s);
        }
        seriesIncluded.push(series);
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /*  3. Sort & write                                                    */
  /* ------------------------------------------------------------------ */
  sessions.sort((a, b) => a.startUtc.localeCompare(b.startUtc));

  const payload: CalendarData = {
    generatedAt: new Date().toISOString(),
    windowStart: `${from}T00:00:00.000Z`,
    windowEnd: `${WINDOW_END}T23:59:59.999Z`,
    seriesIncluded,
    sessions,
  };

  const outPath = join(DATA_DIR, "calendar-2026.json");
  writeFileSync(outPath, JSON.stringify(payload, null, 2));
  process.stdout.write(`\nWrote ${outPath} (${sessions.length} sessions across ${seriesIncluded.length} series)\n`);

  try {
    rmSync(CACHE_DIR, { recursive: true, force: true });
    process.stdout.write(`Cleared fetch cache.\n`);
  } catch {
  }
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
