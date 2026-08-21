/**
 * merge-extra-series.ts
 *
 * Merges scraped F1 Academy, IndyCar and DTM session data into the main
 * calendar-2026.json, replacing the incomplete TheSportsDB sessions for
 * these series.
 *
 * Inputs (produced by the scrape-* scripts):
 *   data/f1academy-schedule.json
 *   data/indycar-schedule.json
 *   data/dtm-schedule.json
 *
 * Usage:
 *   npx tsx scripts/scrape-f1academy.ts
 *   npx tsx scripts/scrape-indycar.ts
 *   npx tsx scripts/scrape-dtm.ts
 *   npx tsx scripts/merge-extra-series.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { CalendarData, Session, SeriesId, SessionType } from "../src/types";
import { classifySessionType, estimateDurationMin } from "../src/lib/sources/durations";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");

const YEAR = 2026;

const SERIES_TO_REPLACE: SeriesId[] = ["f1_academy", "indycar", "dtm"];

/** Sessions to filter out (non-racing, ceremonial, TV shows) */
const SKIP_SESSION = new Set([
  "track-safari",
  "pre-race show",
  "autograph session",
  "pitwalk",
  "show programme",
  "meet the drivers",
]);

/* ------------------------------------------------------------------ */
/*  Types (scraped JSON structures)                                    */
/* ------------------------------------------------------------------ */

interface ScrapedSession {
  name: string;
  startIso: string;
  endIso: string;
}

interface ScrapedEvent {
  slug?: string;
  raceId?: number;
  name: string;
  track: string;
  country?: string;
  countryCode?: string;
  dateRange: string;
  sessions: ScrapedSession[];
}

interface ScrapedFile {
  events: ScrapedEvent[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function flagEmoji(code: string): string {
  return String.fromCodePoint(
    ...code.split("").map((c) => 0x1f1e6 + c.toUpperCase().charCodeAt(0) - 65),
  );
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function readScraped(fileName: string): ScrapedEvent[] {
  const path = join(DATA_DIR, fileName);
  try {
    const data = JSON.parse(readFileSync(path, "utf8")) as ScrapedFile;
    return data.events ?? [];
  } catch {
    process.stdout.write(`  ⚠ Cannot read ${fileName} — skipping\n`);
    return [];
  }
}

const INDYCAR_VENUE: Record<string, { venue: string; country: string; code: string }> = {
  "Portland International Raceway": { venue: "Portland International Raceway", country: "United States", code: "US" },
  "Streets of Markham": { venue: "Streets of Markham", country: "Canada", code: "CA" },
  "Streets of Washington": { venue: "Streets of Washington", country: "United States", code: "US" },
  "The Milwaukee Mile": { venue: "The Milwaukee Mile", country: "United States", code: "US" },
  "WeatherTech Raceway Laguna Seca": { venue: "Laguna Seca", country: "United States", code: "US" },
};

const DTM_VENUE: Record<string, { venue: string; country: string; code: string }> = {
  Nürburgring: { venue: "Nürburgring", country: "Germany", code: "DE" },
  Sachsenring: { venue: "Sachsenring", country: "Germany", code: "DE" },
  Hockenheimring: { venue: "Hockenheimring", country: "Germany", code: "DE" },
};

function buildSession(
  series: SeriesId,
  leagueName: string,
  s: ScrapedSession,
  eventKey: string,
  venue: string,
  country: string,
  code: string,
  idx: number,
): Session {
  const sessionType = classifySessionType(s.name) as SessionType;

  // If the source gave us a real end time, the duration is exact — no need
  // for the estimate table.
  const hasRealEnd = Boolean(s.endIso) && s.endIso !== s.startIso;
  let endUtc = s.endIso;
  let durationMin: number;
  if (hasRealEnd) {
    endUtc = s.endIso;
    durationMin = Math.max(
      1,
      Math.round((Date.parse(s.endIso) - Date.parse(s.startIso)) / 60_000),
    );
  } else {
    ({ durationMin } = estimateDurationMin(series, sessionType, s.name));
    endUtc = new Date(Date.parse(s.startIso) + durationMin * 60_000).toISOString();
  }

  return {
    id: `${series}-${YEAR}-${slugify(eventKey)}-${idx}`,
    series,
    leagueName,
    name: s.name,
    sessionType,
    eventKey: `${YEAR}_${series}_${slugify(eventKey)}`,
    round: null,
    season: String(YEAR),
    startUtc: s.startIso,
    endUtc,
    durationMin,
    venue,
    country,
    countryFlagEmoji: flagEmoji(code),
    city: null,
    mapUrl: null,
    isEstimatedStart: false,
    isEstimatedEnd: !hasRealEnd,
  };
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  // 1. Load existing calendar
  const existingPath = join(DATA_DIR, "calendar-2026.json");
  let existing: CalendarData;
  try {
    existing = JSON.parse(readFileSync(existingPath, "utf8")) as CalendarData;
    process.stdout.write(`Loaded existing data: ${existing.sessions.length} sessions\n`);
  } catch {
    process.stdout.write("No existing data found. Run fetch-calendar.ts first.\n");
    process.exit(1);
  }

  // 2. Remove old sessions for the three series
  const keptSessions = existing.sessions.filter((s) => !SERIES_TO_REPLACE.includes(s.series));
  process.stdout.write(`Kept ${keptSessions.length} sessions from other series\n`);

  // 3. Load scraped data
  const f1aEvents = readScraped("f1academy-schedule.json");
  const indyEvents = readScraped("indycar-schedule.json");
  const dtmEvents = readScraped("dtm-schedule.json");

  const newSessions: Session[] = [];
  let idx = 0;

  // --- F1 Academy ---
  for (const ev of f1aEvents) {
    const venue = ev.track ?? ev.name;
    const country = ev.country ?? "";
    const code = ev.countryCode ?? "";
    const key = slugify(venue);
    for (const s of ev.sessions) {
      if (SKIP_SESSION.has(s.name.toLowerCase())) continue;
      newSessions.push(
        buildSession("f1_academy", "F1 Academy", s, key, venue, country, code, idx++),
      );
    }
  }

  // --- IndyCar (dedupe Milwaukee double-header: same track, distinct races) ---
  const seenIndy = new Set<string>();
  for (const ev of indyEvents) {
    const v = INDYCAR_VENUE[ev.track] ?? {
      venue: ev.track,
      country: ev.country ?? "",
      code: ev.countryCode ?? "",
    };
    const key = slugify(ev.name);
    for (const s of ev.sessions) {
      if (SKIP_SESSION.has(s.name.toLowerCase())) continue;
      const dedupKey = `${s.startIso}|${s.name}`;
      if (seenIndy.has(dedupKey)) continue;
      seenIndy.add(dedupKey);
      newSessions.push(
        buildSession("indycar", "IndyCar", s, key, v.venue, v.country, v.code, idx++),
      );
    }
  }

  // --- DTM (filter non-racing sessions) ---
  for (const ev of dtmEvents) {
    const v = DTM_VENUE[ev.track] ?? {
      venue: ev.track,
      country: "Germany",
      code: "DE",
    };
    const key = slugify(ev.name);
    for (const s of ev.sessions) {
      if (SKIP_SESSION.has(s.name.toLowerCase())) {
        process.stdout.write(`  Skipping DTM non-race session: ${s.name}\n`);
        continue;
      }
      newSessions.push(
        buildSession("dtm", "DTM", s, key, v.venue, v.country, v.code, idx++),
      );
    }
  }

  process.stdout.write(`Transformed ${newSessions.length} new sessions\n`);

  // 4. Merge, sort, dedupe by (series, startUtc, name)
  const merged = [...keptSessions, ...newSessions].sort((a, b) =>
    a.startUtc.localeCompare(b.startUtc),
  );
  const seen = new Set<string>();
  const allSessions = merged.filter((s) => {
    const k = `${s.series}|${s.startUtc}|${s.name}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // 5. Update seriesIncluded
  const seriesIncluded = [...new Set([
    ...existing.seriesIncluded.filter((s) => !SERIES_TO_REPLACE.includes(s)),
    ...SERIES_TO_REPLACE,
  ])];

  // 6. Write
  const payload: CalendarData = {
    generatedAt: new Date().toISOString(),
    windowStart: existing.windowStart,
    windowEnd: existing.windowEnd,
    seriesIncluded,
    sessions: allSessions,
  };

  const outPath = join(DATA_DIR, "calendar-2026.json");
  writeFileSync(outPath, JSON.stringify(payload, null, 2));
  process.stdout.write(
    `\nWrote ${outPath} (${allSessions.length} sessions across ${seriesIncluded.length} series)\n`,
  );
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
