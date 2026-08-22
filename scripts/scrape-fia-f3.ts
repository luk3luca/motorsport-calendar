/**
 * scrape-fia-f3.ts
 *
 * Scrapes the NEW fiaformula3.com site (Next.js App Router, 2026 redesign)
 * into data/f3-schedule.json (raw), following the same pattern as the other
 * scrape-* scripts. The old JSON embed (`application/json` script) is gone;
 * the meeting data now ships inside the Next.js flight payload
 * (`self.__next_f.push(n,"…")`) as a JSON-encoded string:
 *
 *   race: {
 *     meetingName, meetingLocation, meetingCountryName, meetingCountryCode,
 *     meetingTimezone, roundText,
 *     meetingSessions: [{ session, shortName, description, startTime,
 *                         endTime, gmtOffset, sessionType, state }]
 *   }
 *
 * Usage: npx tsx scripts/scrape-fia-f3.ts
 * Then:  npx tsx scripts/merge-fia.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");

const SERIES = "f3";
const BASE = "https://www.fiaformula3.com";
const SEASON_PATH = "/en/racing/2026";
const OUT_FILE = join(DATA_DIR, "f3-schedule.json");

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125 Safari/537.36";

/* ------------------------------------------------------------------ */
/*  Flight-payload decoding helpers                                    */
/* ------------------------------------------------------------------ */

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

/** Extract one `self.__next_f.push(N,"…")` string and JSON-decode it. */
function decodeFlight(html: string): string {
  const marker = "meetingSessions";
  const mIdx = html.indexOf(marker);
  if (mIdx < 0) return html;
  const pushIdx = html.lastIndexOf("__next_f.push(", mIdx);
  if (pushIdx < 0) return html;
  const qStart = html.indexOf('"', pushIdx + "__next_f.push(".length);
  if (qStart < 0) return html;
  const start = qStart + 1;
  let end = start;
  for (let i = start; i < html.length; i++) {
    if (html[i] === "\\") {
      i++;
      continue;
    }
    if (html[i] === '"') {
      end = i;
      break;
    }
  }
  try {
    return JSON.parse(html.slice(qStart, end + 1)) as string;
  } catch {
    return html;
  }
}

/** Balanced JSON value following `"key":` in decoded text. */
function extractJsonValue(text: string, key: string): unknown {
  const idx = text.indexOf(`"${key}":`);
  if (idx < 0) return null;
  let start = idx + key.length + 3;
  while (start < text.length && text[start] !== "[" && text[start] !== "{") start++;
  if (start >= text.length) return null;
  let depth = 0;
  let inStr = false;
  let end = start;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (c === "\\") {
      i++;
      continue;
    }
    if (c === '"') inStr = !inStr;
    else if (!inStr && (c === "[" || c === "{")) depth++;
    else if (!inStr && (c === "]" || c === "}")) {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  try {
    return JSON.parse(text.slice(start, end));
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Types (matching the hub page's embedded race object)               */
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

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  mkdirSync(DATA_DIR, { recursive: true });

  process.stdout.write(`Scraping ${SERIES} season index: ${BASE}${SEASON_PATH}\n`);
  const indexHtml = await fetchHtml(`${BASE}${SEASON_PATH}`);

  const slugs = [
    ...new Set(
      Array.from(indexHtml.matchAll(/\/en\/racing\/2026\/([a-z0-9-]+)/g), (m) =>
        m[1].replace(/[?#].*$/, ""),
      ),
    ),
  ].filter((s) => s && s !== "2026" && !s.includes("."));

  process.stdout.write(`Found ${slugs.length} race pages\n`);

  const events: RawEvent[] = [];
  for (const slug of slugs) {
    try {
      const html = await fetchHtml(`${BASE}${SEASON_PATH}/${slug}`);
      const text = decodeFlight(html);
      if (!text.includes("meetingSessions")) {
        process.stdout.write(`  ⚠ ${slug}: meeting data not found, skipping\n`);
        continue;
      }
      const race = (extractJsonValue(text, "race") ?? {}) as {
        meetingName?: string;
        meetingLocation?: string;
        meetingCountryName?: string;
        meetingCountryCode?: string;
        meetingTimezone?: string;
        roundText?: string;
        meetingSessions?: RawSession[];
      };
      const sessions = (race.meetingSessions ?? []).filter((s) => s.startTime && s.endTime);
      if (sessions.length === 0) {
        process.stdout.write(`  ⚠ ${slug}: no dated sessions, skipping\n`);
        continue;
      }
      events.push({
        slug,
        name: race.meetingName ?? slug,
        location: race.meetingLocation ?? slug.replace(/-/g, " "),
        country: race.meetingCountryName ?? "",
        countryCode: race.meetingCountryCode ?? "",
        timezone: race.meetingTimezone ?? "",
        roundText: race.roundText ?? "",
        sessions,
      });
      process.stdout.write(`  ✓ ${slug}: ${sessions.length} sessions\n`);
    } catch (err) {
      process.stdout.write(`  ⚠ ${slug}: ${(err as Error).message}\n`);
    }
  }

  const payload = { generatedAt: new Date().toISOString(), series: SERIES, events };
  writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2));
  process.stdout.write(`\nWrote ${OUT_FILE} (${events.length} events)\n`);
}

main().catch((err) => {
  console.error("Scraper failed:", err);
  process.exit(1);
});