/**
 * merge-motogp.ts
 *
 * Merges scraped MotoGP/Moto2/Moto3 session data from motogp-schedule.json
 * into the main calendar-2026.json, replacing the incomplete TheSportsDB
 * sessions for these series.
 *
 * Usage: npm run scrape-motogp && npx tsx scripts/merge-motogp.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { CalendarData, Session, SeriesId } from "../src/types";
import { classifySessionType, estimateDurationMin } from "../src/lib/sources/durations";
import { venueTimezone, localToUtc } from "../src/lib/sources/venue-tz";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SERIES_TO_REPLACE: SeriesId[] = ["motogp", "moto2", "moto3"];

const CATEGORY_SERIES: Record<string, SeriesId> = {
  MotoGP: "motogp",
  Moto2: "moto2",
  Moto3: "moto3",
};

const CATEGORY_LEAGUE: Record<string, string> = {
  MotoGP: "MotoGP",
  Moto2: "Moto2",
  Moto3: "Moto3",
};

/** Circuit (partial match) → country */
const TRACK_COUNTRY: Record<string, { name: string; code: string }> = {
  Sachsenring: { name: "Germany", code: "DE" },
  Silverstone: { name: "Great Britain", code: "GB" },
  "MotorLand Aragón": { name: "Spain", code: "ES" },
  Misano: { name: "San Marino", code: "SM" },
  "Red Bull Ring": { name: "Austria", code: "AT" },
  Motegi: { name: "Japan", code: "JP" },
  Mandalika: { name: "Indonesia", code: "ID" },
  "Phillip Island": { name: "Australia", code: "AU" },
  Sepang: { name: "Malaysia", code: "MY" },
  Lusail: { name: "Qatar", code: "QA" },
  Algarve: { name: "Portugal", code: "PT" },
  "Ricardo Tormo": { name: "Spain", code: "ES" },
};

/** Sessions to filter out (ceremonial / non-racing) */
const CEREMONIAL = new Set([
  "rider parade",
  "after the flag",
  "sunday press conference",
  "pre-event press conference",
  "gearup",
]);

/* ------------------------------------------------------------------ */
/*  Types (scraped JSON structure)                                     */
/* ------------------------------------------------------------------ */

interface ScrapedSession {
  time: string;
  category: string;
  name: string;
}

interface ScrapedDay {
  day: string;
  sessions: ScrapedSession[];
}

interface ScrapedEvent {
  url: string;
  name: string;
  dateRange: string;
  track: string;
  days: ScrapedDay[];
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
    .replace(/^_|_$/g, "");
}

/** Parse "10 Jul - 12 Jul" with assumed year → [startDate, endDate] as YYYY-MM-DD */
function parseDateRange(raw: string, year: number): string[] {
  const months: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  const parts = raw.split(/\s*-\s*/);
  const parse = (s: string) => {
    const m = s.match(/(\d+)\s+(\w+)/);
    if (!m) throw new Error(`Cannot parse date: ${s}`);
    const day = parseInt(m[1], 10);
    const month = months[m[2].toLowerCase().slice(0, 3)];
    if (month === undefined) throw new Error(`Unknown month: ${m[2]}`);
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };
  return [parse(parts[0]), parts[1] ? parse(parts[1]) : parse(parts[0])];
}

const DAY_INDEX: Record<string, number> = { FRIDAY: 0, SATURDAY: 1, SUNDAY: 2 };

/** Parse "09:00-09:35" → ["09:00", "09:35"] or "15:00" → ["15:00", null] */
function parseTime(raw: string): [string, string | null] {
  const parts = raw.split("-");
  const start = parts[0].trim();
  const end = parts.length > 1 ? parts[1].trim() : null;
  return [start, end];
}

/** Match a track name against a partial key */
function matchTrack<T>(name: string, map: Record<string, T>): T | null {
  for (const [key, val] of Object.entries(map)) {
    if (name.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return null;
}

/** Generate a deterministic ID for a session */
function makeId(series: string, year: number, eventSlug: string, idx: number): string {
  return `${series}_${year}_${eventSlug}_s${idx}`;
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  const YEAR = 2026;

  // 1. Read existing calendar
  const existing: CalendarData = JSON.parse(
    readFileSync(join(DATA_DIR, "calendar-2026.json"), "utf-8"),
  );
  process.stdout.write(`Loaded existing: ${existing.sessions.length} sessions\n`);

  // 2. Remove sessions for series we're replacing
  const keptSessions = existing.sessions.filter(
    (s) => !SERIES_TO_REPLACE.includes(s.series),
  );
  process.stdout.write(`Kept ${keptSessions.length} sessions (removed ${existing.sessions.length - keptSessions.length} MotoGP/Moto2/Moto3)\n`);

  // 3. Read scraped data
  const scraped: { events: ScrapedEvent[] } = JSON.parse(
    readFileSync(join(DATA_DIR, "motogp-schedule.json"), "utf-8"),
  );
  process.stdout.write(`Loaded scraped: ${scraped.events.length} events\n`);

  // 4. Transform scraped sessions
  const newSessions: Session[] = [];
  let globalIdx = 0;

  for (const event of scraped.events) {
    const dates = parseDateRange(event.dateRange, YEAR);
    if (dates.length < 2) continue;

    const eventSlug = slugify(event.name);
    const tz = venueTimezone(event.track);
    if (!tz) {
      process.stdout.write(`  ⚠ No timezone for "${event.track}", skipping ${event.name}\n`);
      continue;
    }

    for (const day of event.days) {
      const dayOff = DAY_INDEX[day.day];
      if (dayOff === undefined) continue;
      const dateStr = dates[0]; // first date is FRIDAY

      // Compute actual date for this day
      const d = new Date(`${dateStr}T00:00:00.000Z`);
      d.setUTCDate(d.getUTCDate() + dayOff);
      const dayDate = d.toISOString().slice(0, 10);

      for (const sess of day.sessions) {
        // Filter ceremonial sessions
        if (CEREMONIAL.has(sess.name.toLowerCase())) continue;

        const seriesId = CATEGORY_SERIES[sess.category];
        if (!seriesId) continue; // skip Baggers, etc.

        // Parse time
        const [startTime, endTime] = parseTime(sess.time);

        // Convert local track time → UTC using IANA timezone (DST-aware)
        const startUtc = localToUtc(dayDate, startTime, tz);
        if (!startUtc) {
          process.stdout.write(`  ⚠ Cannot parse time "${sess.time}" for ${event.name}\n`);
          continue;
        }

        // Session type & duration
        const sessionType = classifySessionType(sess.name);
        const { durationMin } = estimateDurationMin(seriesId, sessionType, sess.name);

        // End UTC
        let endUtc: string;
        if (endTime) {
          endUtc = localToUtc(dayDate, endTime, tz) ?? startUtc;
        } else {
          endUtc = new Date(Date.parse(startUtc) + durationMin * 60_000).toISOString();
        }

        const country = matchTrack(event.track, TRACK_COUNTRY) as { name: string; code: string } | null;

        newSessions.push({
          id: makeId(seriesId, YEAR, eventSlug, globalIdx++),
          series: seriesId,
          leagueName: CATEGORY_LEAGUE[sess.category] ?? seriesId.toUpperCase(),
          name: sess.name,
          sessionType,
          eventKey: `2026_motogp_${eventSlug}`,
          round: null,
          season: String(YEAR),
          startUtc,
          endUtc,
          durationMin,
          venue: event.track,
          country: country?.name ?? "",
          countryFlagEmoji: country ? flagEmoji(country.code) : "",
          city: null,
          mapUrl: null,
          isEstimatedStart: false,
          isEstimatedEnd: true,
        });
      }
    }
  }

  process.stdout.write(`Transformed ${newSessions.length} new sessions\n`);

  // 5. Merge and sort
  const allSessions = [...keptSessions, ...newSessions].sort((a, b) =>
    a.startUtc.localeCompare(b.startUtc),
  );

  // 6. Update seriesIncluded
  const seriesIncluded = [...new Set([
    ...existing.seriesIncluded.filter((s) => !SERIES_TO_REPLACE.includes(s)),
    ...SERIES_TO_REPLACE,
  ])];

  // 7. Write
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
    `\nWrote ${outPath} (${allSessions.length} sessions, ${seriesIncluded.length} series)\n`,
  );
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
