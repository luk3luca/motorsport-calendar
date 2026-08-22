/**
 * merge-fia.ts
 *
 * Merges scraped FIA F2/F3 data (data/f2-schedule.json, data/f3-schedule.json,
 * produced by scrape-fia-f2.ts / scrape-fia-f3.ts) into calendar-2026.json,
 * replacing the placeholder TheSportsDB sessions for these series.
 *
 * Handles known site quirks:
 *  - placeholder events (past rounds): all sessions share an identical time
 *    window → whole event skipped
 *  - sessions with inverted/zero durations → skipped
 *  - split qualifying groups (Qualifying A/B or 1/2) → merged into ONE block
 *  - local times converted to UTC via the gmtOffset each session carries
 *
 * Usage:
 *   npx tsx scripts/scrape-fia-f2.ts && npx tsx scripts/scrape-fia-f3.ts
 *   npx tsx scripts/merge-fia.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { CalendarData, Session, SeriesId, SessionType } from "../src/types";
import { LEAGUE_BY_SERIES } from "../src/lib/sources/leagues";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");

const SERIES_TO_REPLACE: SeriesId[] = ["f2", "f3"];

const YEAR = 2026;

/* ------------------------------------------------------------------ */
/*  Scraped file types                                                 */
/* ------------------------------------------------------------------ */

interface RawSession {
  session?: string;
  shortName?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  gmtOffset?: string;
  sessionType?: string;
  sessionStatus?: string;
}

interface RawEvent {
  slug: string;
  name: string;
  location: string;
  country: string;
  countryCode: string;
  timezone: string;
  roundText: string;
  sessions: RawSession[];
}

interface RawFile {
  generatedAt?: string;
  series: string;
  events: RawEvent[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function flagEmoji(code: string): string {
  return String.fromCodePoint(
    ...code.split("").map((c) => 0x1f1e6 + c.toUpperCase().charCodeAt(0) - 65),
  );
}

/** Local "+offset" ISO → UTC ISO. Returns "" on parse failure. */
function toUtc(local: string, gmtOffset: string | undefined): string {
  if (/[+-]\d{2}:\d{2}$/.test(local)) {
    const ms = Date.parse(local);
    return Number.isNaN(ms) ? "" : new Date(ms).toISOString();
  }
  const ms = Date.parse(`${local}${gmtOffset ?? "+00:00"}`);
  return Number.isNaN(ms) ? "" : new Date(ms).toISOString();
}

function classify(s: RawSession): SessionType {
  const d = `${s.description ?? ""} ${s.shortName ?? ""} ${s.session ?? ""}`.toLowerCase();
  if (d.includes("practice")) return "practice";
  if (d.includes("qualifying")) return "qualifying";
  if (d.includes("sprint")) return "sprint_race";
  if (d.includes("feature")) return "feature_race";
  if (d.includes("warm")) return "warmup";
  if (d.includes("race")) return "race";
  return "other";
}

/**
 * Placeholder event detection: the site marks unconfirmed rounds with
 * `sessionStatus: "TBC"` and midnight placeholder times for every session.
 * Skip the whole event when the majority looks like that (past rounds are
 * kept with their real times, so only genuine TBC events are skipped).
 */
function isPlaceholderEvent(ev: RawEvent): boolean {
  if (ev.sessions.length === 0) return true;
  const tbc = ev.sessions.filter(
    (s) =>
      s.sessionStatus === "TBC" ||
      (s.startTime ?? "").endsWith("T00:00:00") ||
      (s.endTime ?? "").endsWith("T01:00:00"),
  ).length;
  return tbc > ev.sessions.length / 2;
}

const MAX_SESSION_MIN = 240; // sanity cap (FIA races are ≤ ~1h; guard vs bad data)

function buildEventSessions(series: SeriesId, ev: RawEvent, round: number): Session[] {
  const league = LEAGUE_BY_SERIES[series];
  const eventKey = `2026_${series}_${ev.slug}`;
  const out: Session[] = [];

  for (const s of ev.sessions) {
    if (!s.startTime || !s.endTime) continue;
    const startUtc = toUtc(s.startTime, s.gmtOffset);
    const endUtc = toUtc(s.endTime, s.gmtOffset);
    if (!startUtc || !endUtc) continue;
    const durationMin = Math.round((Date.parse(endUtc) - Date.parse(startUtc)) / 60_000);
    if (durationMin <= 0 || durationMin > MAX_SESSION_MIN) continue;

    const label = s.shortName ?? s.session ?? "Session";
    out.push({
      id: `fia-${series}-${ev.slug}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      series,
      leagueName: league.label,
      name: `${ev.location} ${label}`,
      sessionType: classify(s),
      eventKey,
      round,
      season: String(YEAR),
      startUtc,
      endUtc,
      durationMin,
      venue: ev.name,
      country: ev.country,
      countryFlagEmoji: flagEmoji(ev.countryCode),
      city: null,
      mapUrl: null,
      isEstimatedStart: false,
      isEstimatedEnd: false,
    });
  }

  // Split qualifying groups (A/B or 1/2, gap ≤ 30 min) → one "Qualifying" block
  const merged: Session[] = [];
  for (const s of out) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.sessionType === "qualifying" &&
      s.sessionType === "qualifying" &&
      Date.parse(s.startUtc) - Date.parse(prev.endUtc) <= 30 * 60_000
    ) {
      prev.endUtc = s.endUtc;
      prev.durationMin = Math.round((Date.parse(prev.endUtc) - Date.parse(prev.startUtc)) / 60_000);
      prev.id = `fia-${series}-${ev.slug}-qualifying`;
      prev.name = prev.name.replace(/ Qualifying [A-Z0-9]+$/i, " Qualifying");
      continue;
    }
    merged.push(s);
  }
  return merged;
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

function main(): void {
  const mainPath = join(DATA_DIR, "calendar-2026.json");
  const main: CalendarData = JSON.parse(readFileSync(mainPath, "utf8"));

  // Collect new sessions per series
  const freshBySeries: Record<string, Session[]> = {};
  for (const series of SERIES_TO_REPLACE) {
    const rawPath = join(DATA_DIR, `${series}-schedule.json`);
    const raw: RawFile = JSON.parse(readFileSync(rawPath, "utf8"));
    const sessions: Session[] = [];
    let roundFallback = 1;

    for (const ev of raw.events) {
      if (isPlaceholderEvent(ev)) {
        process.stdout.write(`  ⚠ ${series} ${ev.slug}: placeholder times, skipped\n`);
        continue;
      }
      const roundText = parseInt((ev.roundText ?? "").replace(/\D/g, ""), 10);
      const round = roundText || roundFallback;
      const built = buildEventSessions(series, ev, round);
      if (built.length > 0) roundFallback = round + 1;
      sessions.push(...built);
    }
    freshBySeries[series] = sessions;
    process.stdout.write(`${series}: ${sessions.length} valid sessions from ${raw.events.length} events\n`);
  }

  // Replace only series with valid fresh data; keep existing otherwise
  let out = main.sessions;
  for (const series of SERIES_TO_REPLACE) {
    const fresh = freshBySeries[series];
    if (fresh.length === 0) {
      process.stdout.write(`  ⚠ ${series}: no valid data — keeping existing sessions\n`);
      continue;
    }
    out = out.filter((s) => s.series !== series).concat(fresh);
  }

  out.sort((a, b) => a.startUtc.localeCompare(b.startUtc));

  const seriesIncluded = [...new Set([...main.seriesIncluded, ...SERIES_TO_REPLACE])];
  const payload: CalendarData = {
    ...main,
    generatedAt: new Date().toISOString(),
    seriesIncluded,
    sessions: out,
  };
  writeFileSync(mainPath, JSON.stringify(payload, null, 2));

  const before = main.sessions.length;
  process.stdout.write(`\nWrote ${mainPath}: ${out.length} sessions (was ${before})\n`);
}

try {
  main();
} catch (err) {
  console.error("Merge failed:", err);
  process.exit(1);
}