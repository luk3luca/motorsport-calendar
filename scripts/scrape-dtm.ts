/**
 * scrape-dtm.ts
 *
 * Scrapes DTM 2026 session times from dtm.com using Playwright.
 * The site is client-side rendered (CloudFront returns an empty shell to
 * plain HTTP fetches), so a headless browser is required — same pattern
 * as the MotoGP scraper.
 *
 * Event pages: https://www.dtm.com/en/events/{slug}-2026
 * Timetable blocks contain: day (FRI, 8/14), time ("11:30 - 12:25"),
 * series name (DTM / ADAC GT4 GERMANY / ...) and session name
 * (Free Practice 1, Qualifying 1, Race 1...). Only DTM sessions are kept.
 *
 * Usage: npx tsx scripts/scrape-dtm.ts [slug...]
 * Output: data/dtm-schedule.json
 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { localToUtc } from "../src/lib/sources/venue-tz";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");

const YEAR = 2026;

/* Future 2026 rounds (slug, track) */
const ROUNDS: Array<{ slug: string; track: string }> = [
  { slug: "nuerburgring-2026", track: "Nürburgring" },
  { slug: "sachsenring-2026", track: "Sachsenring" },
  { slug: "hockenheim-finale-2026", track: "Hockenheimring" },
];

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

/** Parse timetable text (one day section at a time).
 *  Day sections look like:
 *    FRI, 8/14
 *    09:00 - 10:00
 *    ADAC GT4 GERMANY
 *    Free Practice 1
 *    10:15 - 11:15
 *    PORSCHE SIXT CARRERA CUP DEUTSCHLAND
 *    Free Practice
 *  Only DTM rows are kept. */
function parseTimetable(dayBlocks: string[], year: number): SessionOut[] {
  const sessions: SessionOut[] = [];
  for (const block of dayBlocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);

    // Find date: "FRI, 8/14" (US style month/day)
    let month = 0;
    let day = 0;
    const dateLine = lines.find((l) => /^(FRI|SAT|SUN|THU|MON|TUE|WED),?\s*\d{1,2}\/\d{1,2}$/i.test(l));
    if (dateLine) {
      const m = dateLine.match(/(\d{1,2})\/(\d{1,2})$/);
      if (m) {
        month = Number(m[1]);
        day = Number(m[2]);
      }
    }
    if (!month || !day) continue;

    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    // Walk lines: time row followed by series + session rows
    for (let i = 0; i < lines.length; i++) {
      const timeM = lines[i].match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
      if (!timeM) continue;
      const startTime = timeM[1];
      const endTime = timeM[2];

      // Next non-empty lines: series then session name (sometimes series
      // and session are on the same line)
      const series = lines[i + 1] ?? "";
      const sessionName = lines[i + 2] ?? "";

      // Skip autograph/pitwalk/other non-timetable rows: series must be
      // an uppercase series name and session a normal sentence
      if (!/^[A-Z][A-Z0-9 &.-]{2,}$/.test(series)) continue;
      if (series.toUpperCase() !== "DTM") continue;
      if (!sessionName) continue;

      const tz = "Europe/Berlin"; // all 2026 DTM rounds are in Germany
      const startUtc = localToUtc(dateStr, startTime, tz);
      const endUtc = localToUtc(dateStr, endTime, tz);
      if (!startUtc || !endUtc) continue;

      sessions.push({ name: sessionName, startIso: startUtc, endIso: endUtc });
      i += 2; // skip consumed lines
    }
  }
  return sessions;
}

async function scrapeRound(page: import("playwright").Page, slug: string, track: string): Promise<EventOut | null> {
  const url = `https://www.dtm.com/en/events/${slug}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  // Wait for timetable content
  try {
    await page.waitForSelector("text=TIMETABLE", { timeout: 30000 });
  } catch {
    process.stdout.write(`  ⚠ No TIMETABLE found on ${slug}\n`);
    return null;
  }

  // Event name: h1
  const name = (await page.locator("h1").first().textContent())?.trim() ?? slug;

  // Extract the timetable area: all text between "TIMETABLE" and "PROGRAMME ON SITE"
  const bodyText = await page.locator("body").innerText();
  const ttStart = bodyText.indexOf("TIMETABLE");
  const ttEnd = bodyText.indexOf("PROGRAMME ON SITE", ttStart);
  const ttText = ttEnd > ttStart ? bodyText.slice(ttStart, ttEnd) : bodyText.slice(ttStart);

  // Day sections: "FRI, 8/14" ... next day heading
  const dayBlocks = ttText.split(/\n(?=(FRI|SAT|SUN|THU),)/);
  const sessions = parseTimetable(dayBlocks, YEAR);

  if (sessions.length === 0) {
    process.stdout.write(`  ⚠ No DTM sessions parsed for ${slug}\n`);
    return null;
  }
  return { slug, name, track, dateRange: "", sessions };
}

async function main(): Promise<void> {
  mkdirSync(DATA_DIR, { recursive: true });
  const slugs = process.argv.slice(2);
  const rounds = slugs.length > 0 ? ROUNDS.filter((r) => slugs.includes(r.slug)) : ROUNDS;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    locale: "en-US",
  });
  const page = await context.newPage();

  const events: EventOut[] = [];
  for (const r of rounds) {
    process.stdout.write(`Fetching ${r.slug}...\n`);
    try {
      const ev = await scrapeRound(page, r.slug, r.track);
      if (ev) {
        events.push(ev);
        process.stdout.write(`  ✓ ${ev.name}: ${ev.sessions.length} sessions\n`);
        for (const s of ev.sessions) {
          process.stdout.write(`     ${s.startIso.slice(0, 16)} → ${s.endIso.slice(11, 16)} ${s.name}\n`);
        }
      }
    } catch (err) {
      process.stdout.write(`  ✗ ${(err as Error).message}\n`);
    }
  }

  await browser.close();

  const outPath = join(DATA_DIR, "dtm-schedule.json");
  writeFileSync(outPath, JSON.stringify({ events, generatedAt: new Date().toISOString() }, null, 2));
  process.stdout.write(`\nWrote ${outPath} (${events.length} events, ${events.reduce((n, e) => n + e.sessions.length, 0)} sessions)\n`);
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
