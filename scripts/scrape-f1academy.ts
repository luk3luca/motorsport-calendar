/**
 * scrape-f1academy.ts
 *
 * Scrapes F1 Academy 2026 session times from f1academy.com.
 * The Results page embeds a Next.js JSON blob with structured session
 * data including SessionStartTime/SessionEndTime in ISO format WITH
 * timezone offset (e.g. "2026-08-22T14:35:00+02:00") — no manual
 * timezone mapping needed.
 *
 * Usage: npx tsx scripts/scrape-f1academy.ts [raceId...]
 * Output: data/f1academy-schedule.json (stdout-friendly, JSON on stdout)
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");

/* Race IDs from the F1 Academy site (2026 season) */
const RACE_IDS = [22, 24, 25, 26, 27, 28];

interface F1ASession {
  SessionName: string;
  SessionType: string;
  Unconfirmed: boolean;
  SessionStartTime: string;
  SessionEndTime: string;
}

interface F1APage {
  pageData?: {
    RaceId: number;
    RoundNumber: number | null;
    CountryName: string;
    CountryCode: string;
    RaceStartDate: string;
    RaceEndDate: string;
    CircuitInformation?: { CircuitShortName?: string };
    SessionResults?: F1ASession[];
  };
}

interface OutputEvent {
  raceId: number;
  round: number | null;
  name: string;
  track: string;
  country: string;
  countryCode: string;
  dateRange: string;
  sessions: Array<{
    name: string;
    sessionType: string;
    startIso: string;
    endIso: string;
    unconfirmed: boolean;
  }>;
}

function extractJsonEmbed(html: string): F1APage | null {
  // Next.js embeds data in <script id="__NEXT_DATA__">...</script>
  const nextMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextMatch) {
    try {
      const parsed = JSON.parse(nextMatch[1]);
      const pageData = parsed?.props?.pageProps?.pageData;
      if (pageData?.SessionResults) return { pageData };
    } catch {
      /* fall through */
    }
  }
  return null;
}

async function fetchPage(raceId: number): Promise<string> {
  const url = `https://www.f1academy.com/Racing-Series/Results?raceid=${raceId}`;
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

function parseRaceId(html: string, raceId: number): OutputEvent | null {
  const data = extractJsonEmbed(html);
  if (!data?.pageData) return null;

  const page = data.pageData;
  const track = page.CircuitInformation?.CircuitShortName?.trim() ?? `Round ${raceId}`;
  const countryName = page.CountryName ?? "";
  const countryCode = page.CountryCode ?? "";

  const sessions = (page.SessionResults ?? [])
    .filter((s) => s.SessionStartTime && s.SessionEndTime)
    .map((s) => ({
      name: s.SessionName,
      sessionType: s.SessionType,
      startIso: s.SessionStartTime,
      endIso: s.SessionEndTime,
      unconfirmed: s.Unconfirmed ?? false,
    }));

  const dateRange = page.RaceStartDate
    ? `${page.RaceStartDate} / ${page.RaceEndDate}`
    : "";

  return {
    raceId,
    round: page.RoundNumber ?? null,
    name: track,
    track,
    country: countryName,
    countryCode,
    dateRange,
    sessions,
  };
}

async function main(): Promise<void> {
  mkdirSync(DATA_DIR, { recursive: true });

  const ids = process.argv.slice(2).map(Number).filter(Boolean);
  const raceIds = ids.length > 0 ? ids : RACE_IDS;

  const events: OutputEvent[] = [];
  for (const raceId of raceIds) {
    process.stdout.write(`Fetching race ${raceId}...\n`);
    try {
      const html = await fetchPage(raceId);
      const ev = parseRaceId(html, raceId);
      if (ev && ev.sessions.length > 0) {
        events.push(ev);
        process.stdout.write(`  ✓ ${ev.name}: ${ev.sessions.length} sessions\n`);
      } else {
        process.stdout.write(`  ⚠ No sessions found for race ${raceId}\n`);
      }
    } catch (err) {
      process.stdout.write(`  ✗ ${(err as Error).message}\n`);
    }
    // Be polite to the server
    await new Promise((r) => setTimeout(r, 800));
  }

  const outPath = join(DATA_DIR, "f1academy-schedule.json");
  writeFileSync(outPath, JSON.stringify({ events, generatedAt: new Date().toISOString() }, null, 2));
  process.stdout.write(`\nWrote ${outPath} (${events.length} events, ${events.reduce((n, e) => n + e.sessions.length, 0)} sessions)\n`);
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
