/**
 * scrape-wec.ts
 *
 * Scrapes the FIA WEC race pages (fiawec.com) into data/wec-schedule.json.
 *
 * Each race page embeds the full timetable server-side. Sessions carry an
 * absolute epoch in `data-timestamp` (plus a display string in `data-local`),
 * so no timezone conversion is needed — the epoch IS UTC ground truth.
 *
 * Usage: npx tsx scripts/scrape-wec.ts
 * Then:  npx tsx scripts/merge-wec.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");
const OUT_FILE = join(DATA_DIR, "wec-schedule.json");

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125 Safari/537.36";

/** 2026 future rounds (slug → official race name + venue metadata). */
const MEETINGS: Record<string, { name: string; venue: string; country: string; code: string }> = {
  "lone-star-le-mans-2026": {
    name: "Lone Star Le Mans",
    venue: "Circuit of the Americas",
    country: "USA",
    code: "US",
  },
  "6-hours-of-fuji-2026": {
    name: "6 Hours of Fuji",
    venue: "Fuji Speedway",
    country: "Japan",
    code: "JP",
  },
  "qatar-1812km-2026": {
    name: "Qatar 1812 KM",
    venue: "Lusail International Circuit",
    country: "Qatar",
    code: "QA",
  },
  "bapco-energies-8-hours-of-bahrain-2026": {
    name: "8 Hours of Bahrain",
    venue: "Bahrain International Circuit",
    country: "Bahrain",
    code: "BH",
  },
};

/** Race duration per round (WEC calendar). */
const RACE_DURATION_MIN: Record<string, number> = {
  "lone-star-le-mans-2026": 6 * 60,
  "6-hours-of-fuji-2026": 6 * 60,
  "qatar-1812km-2026": 10 * 60,
  "bapco-energies-8-hours-of-bahrain-2026": 8 * 60,
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

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

/** Session type + estimated duration from the site's session name. */
function classify(name: string): { type: string; durationMin: number } {
  const n = name.toLowerCase();
  if (n.includes("hyperpole")) return { type: "qualifying", durationMin: 10 };
  if (n.includes("qualifying")) return { type: "qualifying", durationMin: 15 };
  if (n.includes("free practice")) {
    const fp3 = /\bfree practice 3\b/.test(n);
    return { type: "free_practice", durationMin: fp3 ? 60 : 90 };
  }
  if (n.includes("race")) return { type: "race", durationMin: 0 }; // set per round
  return { type: "other", durationMin: 60 };
}

function extractSessions(html: string): ScrapedSession[] {
  const out: ScrapedSession[] = [];
  const tsPattern = /data-timestamp="(\d+)"/g;
  const namePattern = /class="fw-bold lh-sm">([^<]{3,60})<\/div>/g;

  let m: RegExpExecArray | null;
  while ((m = tsPattern.exec(html)) !== null) {
    const epoch = parseInt(m[1]!, 10) * 1000;
    if (Number.isNaN(epoch)) continue;

    const window = html.slice(Math.max(0, m.index - 800), m.index);
    let name = "Session";
    let nm: RegExpExecArray | null;
    namePattern.lastIndex = 0;
    while ((nm = namePattern.exec(window)) !== null) name = nm[1].trim();

    const { type, durationMin } = classify(name);
    out.push({
      name,
      sessionType: type,
      startUtc: new Date(epoch).toISOString(),
      durationMin,
    });
  }
  return out;
}

async function main(): Promise<void> {
  mkdirSync(DATA_DIR, { recursive: true });

  const slugs = Object.keys(MEETINGS);
  const events: ScrapedEvent[] = [];
  let round = 5; // Lone Star is R5 in 2026

  for (const slug of slugs) {
    try {
      const html = await fetchHtml(`https://www.fiawec.com/en/race/${slug}`);
      const sessions = extractSessions(html);
      if (sessions.length === 0) {
        process.stdout.write(`  ⚠ ${slug}: timetable not published yet (TBC), deferred\n`);
        continue;
      }
      const meta = MEETINGS[slug];
      // Race duration per round
      const raceDuration = RACE_DURATION_MIN[slug];
      for (const s of sessions) {
        if (s.sessionType === "race" && raceDuration) s.durationMin = raceDuration;
      }
      events.push({
        slug,
        name: meta.name,
        venue: meta.venue,
        country: meta.country,
        countryCode: meta.code,
        round,
        sessions,
      });
      process.stdout.write(`  ✓ ${slug}: ${sessions.length} sessions\n`);
    } catch (err) {
      process.stdout.write(`  ⚠ ${slug}: ${(err as Error).message}\n`);
    }
    round++;
  }

  const payload = { generatedAt: new Date().toISOString(), series: "wec", events };
  writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2));
  process.stdout.write(`\nWrote ${OUT_FILE} (${events.length} events)\n`);
}

main().catch((err) => {
  console.error("Scraper failed:", err);
  process.exit(1);
});