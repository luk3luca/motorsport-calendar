/**
 * scrape-indycar.ts
 *
 * Scrapes NTT IndyCar Series 2026 session times from indycar.com.
 * Event pages are server-rendered HTML with .schedule-table blocks:
 *   <h3>Friday, Aug 7</h3>
 *   <div class="schedule-entry">
 *     <div class="schedule-time">5:30PM ET</div>
 *     <div class="schedule-description">NTT INDYCAR SERIES - Practice 1</div>
 * Times are ET (America/New_York) — converted to UTC via venue-tz.
 *
 * Usage: npx tsx scripts/scrape-indycar.ts [slug...]
 * Output: data/indycar-schedule.json
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { localToUtc } from "../src/lib/sources/venue-tz";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");

const YEAR = 2026;
const TZ = "America/New_York"; // all times published in ET

/* Future 2026 rounds (slug, track name) */
const ROUNDS: Array<{ slug: string; track: string }> = [
  { slug: "Portland", track: "Portland International Raceway" },
  { slug: "Markham", track: "Streets of Markham" },
  { slug: "Washington-DC", track: "Streets of Washington" },
  { slug: "Milwaukee-Race1", track: "The Milwaukee Mile" },
  { slug: "Milwaukee-Race2", track: "The Milwaukee Mile" },
  { slug: "Laguna-Seca", track: "WeatherTech Raceway Laguna Seca" },
];

const MONTHS: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

interface SessionOut {
  name: string;
  startIso: string;
  endIso: string;
}

interface EventOut {
  slug: string;
  name: string;
  track: string;
  dateRange: string;
  sessions: SessionOut[];
}

/** "5:30PM" / "12:00PM" / "11:30AM" → "17:30" / "12:00" / "11:30" */
function parseTime12h(t: string): string {
  const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return "";
  let h = Number(m[1]);
  const min = m[2];
  const ap = m[3].toUpperCase();
  if (ap === "PM" && h !== 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${min}`;
}

async function fetchPage(slug: string): Promise<string> {
  const url = `https://www.indycar.com/Schedule/${YEAR}/${slug}`;
  const resp = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  return resp.text();
}

function parseEvent(html: string, slug: string, track: string): EventOut | null {
  // Event title: <h1>ONLYBULLS GRAND PRIX OF PORTLAND</h1>
  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
  const name = titleMatch ? titleMatch[1].trim() : slug;

  // Date range: <p>August 7 - 9 |Portland, Oregon</p>
  const dateMatch = html.match(/<p>([A-Z][a-z]+ \d{1,2} - \d{1,2}) \|/);

  const sessions: SessionOut[] = [];

  // The page has ONE .schedule-table with all days. Robust approach: find
  // every .schedule-entry, then look backwards for the most recent
  // <h3>DayName, Mon D</h3> heading to get its date.
  const entryRe = /<div class="schedule-entry">([\s\S]*?)<div class="schedule-actions">/g;
  let entryMatch: RegExpExecArray | null;
  while ((entryMatch = entryRe.exec(html)) !== null) {
    const entry = entryMatch[1];
    const timeM = entry.match(/class="schedule-time">([^<]+)</);
    const descM = entry.match(/class="schedule-description">([^<]+)</);
    if (!timeM || !descM) continue;

    const rawTime = timeM[1].trim(); // "5:30PM ET"
    const desc = descM[1].trim(); // "NTT INDYCAR SERIES - Practice 1"

    // Only NTT INDYCAR SERIES sessions (skip Indy NXT, USF, etc.)
    if (!/NTT INDYCAR SERIES/i.test(desc)) continue;

    // Date = most recent <h3> heading before this entry
    // Format: <h3>Friday, Aug 7</h3>
    const before = html.slice(0, entryMatch.index);
    const heads = [...before.matchAll(/<h3>[A-Za-z]+,? ([A-Z][a-z]{2}) (\d{1,2})<\/h3>/g)];
    const head = heads[heads.length - 1];
    if (!head) continue;
    const month = MONTHS[head[1]];
    const day = Number(head[2]);
    if (!month) continue;
    const dayDate = `${YEAR}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const timePart = rawTime.replace(/\s*ET$/, "");
    const hhmm = parseTime12h(timePart);
    if (!hhmm) continue;

    const startUtc = localToUtc(dayDate, hhmm, TZ);
    if (!startUtc) continue;

    const label = desc.replace(/^NTT INDYCAR SERIES\s*-\s*/i, "").trim();
    sessions.push({
      name: label,
      startIso: startUtc,
      endIso: startUtc, // duration estimated later in merge
    });
  }

  if (sessions.length === 0) return null;
  return { slug, name, track, dateRange: dateMatch?.[1] ?? "", sessions };
}

async function main(): Promise<void> {
  mkdirSync(DATA_DIR, { recursive: true });
  const slugs = process.argv.slice(2);
  const rounds = slugs.length > 0
    ? ROUNDS.filter((r) => slugs.includes(r.slug))
    : ROUNDS;

  const events: EventOut[] = [];
  for (const r of rounds) {
    process.stdout.write(`Fetching ${r.slug}...\n`);
    try {
      const html = await fetchPage(r.slug);
      const ev = parseEvent(html, r.slug, r.track);
      if (ev) {
        events.push(ev);
        process.stdout.write(`  ✓ ${ev.name}: ${ev.sessions.length} sessions\n`);
        for (const s of ev.sessions) process.stdout.write(`     ${s.startIso.slice(0, 16)} ${s.name}\n`);
      } else {
        process.stdout.write(`  ⚠ No INDYCAR sessions found for ${r.slug}\n`);
      }
    } catch (err) {
      process.stdout.write(`  ✗ ${(err as Error).message}\n`);
    }
    await new Promise((r2) => setTimeout(r2, 800));
  }

  const outPath = join(DATA_DIR, "indycar-schedule.json");
  writeFileSync(outPath, JSON.stringify({ events, generatedAt: new Date().toISOString() }, null, 2));
  process.stdout.write(`\nWrote ${outPath} (${events.length} events, ${events.reduce((n, e) => n + e.sessions.length, 0)} sessions)\n`);
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
