/**
 * merge-wec.ts
 *
 * Merges scraped FIA WEC data (data/wec-schedule.json, produced by
 * scrape-wec.ts) into calendar-2026.json, replacing the incomplete
 * TheSportsDB sessions for WEC (TheSportsDB only has midnight placeholders
 * for future rounds and misses the Hypercar sessions entirely).
 *
 * Non-destructive: if the scraped file is missing/empty, existing WEC
 * sessions are kept and a warning is printed.
 *
 * Usage:
 *   npx tsx scripts/scrape-wec.ts
 *   npx tsx scripts/merge-wec.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { CalendarData, Session, SeriesId } from "../src/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");

const SERIES: SeriesId = "wec";
const LEAGUE_NAME = "WEC";
const YEAR = "2026";

/** Scraped slug → existing calendar eventKey (TheSportsDB naming). */
const SLUG_TO_EVENTKEY: Record<string, string> = {
  "lone-star-le-mans-2026": "lone_star_le_mans",
  "6-hours-of-fuji-2026": "6_hours_of_fuji",
  "qatar-1812km-2026": "qatar_1812_km",
  "bapco-energies-8-hours-of-bahrain-2026": "8_hours_of_bahrain",
};

interface ScrapedSession {
  name: string;
  sessionType: string;
  startUtc: string;
  durationMin: number;
}

interface ScrapedEvent {
  slug: string;
  name: string;
  venue: string;
  country: string;
  countryCode: string;
  round: number;
  sessions: ScrapedSession[];
}

function flagEmoji(code: string): string {
  return String.fromCodePoint(
    ...code.split("").map((c) => 0x1f1e6 + c.toUpperCase().charCodeAt(0) - 65),
  );
}

function main(): void {
  const mainPath = join(DATA_DIR, "calendar-2026.json");
  const main: CalendarData = JSON.parse(readFileSync(mainPath, "utf8"));

  const rawPath = join(DATA_DIR, "wec-schedule.json");
  let raw: { events: ScrapedEvent[] };
  try {
    raw = JSON.parse(readFileSync(rawPath, "utf8"));
  } catch {
    process.stdout.write("  ⚠ wec-schedule.json missing — keeping existing WEC sessions\n");
    return;
  }

  const fresh: Session[] = [];
  for (const ev of raw.events) {
    const eventKey = SLUG_TO_EVENTKEY[ev.slug];
    if (!eventKey) {
      process.stdout.write(`  ⚠ ${ev.slug}: no eventKey mapping, skipped\n`);
      continue;
    }
    ev.sessions.forEach((s, i) => {
      fresh.push({
        id: `wec-${ev.slug}-${i}`,
        series: SERIES,
        leagueName: LEAGUE_NAME,
        name: `${ev.name} ${s.name}`,
        sessionType: s.sessionType as Session["sessionType"],
        eventKey,
        round: ev.round,
        season: YEAR,
        startUtc: s.startUtc,
        endUtc: new Date(Date.parse(s.startUtc) + s.durationMin * 60_000).toISOString(),
        durationMin: s.durationMin,
        venue: ev.venue,
        country: ev.country,
        countryFlagEmoji: flagEmoji(ev.countryCode),
        city: null,
        mapUrl: null,
        isEstimatedStart: false,
        isEstimatedEnd: true,
      });
    });
  }

  if (fresh.length === 0) {
    process.stdout.write("  ⚠ no valid scraped sessions — keeping existing WEC sessions\n");
    return;
  }

  // Replace ONLY the events present in the scraped file; keep existing WEC
  // sessions for events whose timetable is not published yet (TBC). Also
  // drop TheSportsDB "phantom" events for scraped rounds (TSD splits
  // hyperpole into its own eventKey like `…_hyperpole_-_lmgt3`).
  const scrapedKeys = new Set(fresh.map((s) => s.eventKey));
  const isPhantomOfScraped = (s: Session) =>
    [...scrapedKeys].some((k) => s.eventKey.startsWith(`${k}_hyperpole`));
  const before = main.sessions.length;
  const out = main.sessions
    .filter((s) => s.series !== SERIES || (!scrapedKeys.has(s.eventKey) && !isPhantomOfScraped(s)))
    .concat(fresh)
    .sort((a, b) => a.startUtc.localeCompare(b.startUtc));

  const payload: CalendarData = {
    ...main,
    generatedAt: new Date().toISOString(),
    sessions: out,
  };
  writeFileSync(mainPath, JSON.stringify(payload, null, 2));
  process.stdout.write(`\nWEC: replaced with ${fresh.length} scraped sessions (total ${out.length}, was ${before})\n`);
}

try {
  main();
} catch (err) {
  console.error("Merge failed:", err);
  process.exit(1);
}