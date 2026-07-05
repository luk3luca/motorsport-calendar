import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchFiaSeriesCalendar, getFiaSeries } from "../src/lib/sources/fia";
import type { CalendarData, Session, SeriesId } from "../src/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");

interface ExistingCalendar {
  generatedAt: string;
  windowStart: string;
  windowEnd: string;
  seriesIncluded: SeriesId[];
  sessions: Session[];
}

async function main(): Promise<void> {
  mkdirSync(DATA_DIR, { recursive: true });

  // Read existing data (TheSportsDB for most series)
  const existingPath = join(DATA_DIR, "calendar-2026.json");
  let existing: ExistingCalendar;
  try {
    const { readFileSync } = await import("node:fs");
    existing = JSON.parse(readFileSync(existingPath, "utf8")) as ExistingCalendar;
    process.stdout.write(`Loaded existing data: ${existing.sessions.length} sessions\n`);
  } catch {
    process.stdout.write("No existing data found. Run the full fetch-calendar.ts first.\n");
    process.exit(1);
  }

  // Remove F2 and F3 sessions (they'll be replaced by FIA data)
  const fiaSeries = getFiaSeries();
  const keptSessions = existing.sessions.filter((s) => !fiaSeries.includes(s.series));
  process.stdout.write(`Kept ${keptSessions.length} sessions from other series\n`);

  // Track which series are included (remove old F2/F3 refs)
  const seriesIncluded = existing.seriesIncluded.filter((s) => !fiaSeries.includes(s));

  // Fetch FIA data for F2 and F3
  const allSessions: Session[] = [...keptSessions];
  for (const series of fiaSeries) {
    process.stdout.write(`\n=== ${series.toUpperCase()} [FIA source] ===\n`);
    try {
      const fiaSessions = await fetchFiaSeriesCalendar(series);
      process.stdout.write(`  Fetched ${fiaSessions.length} sessions from FIA source\n`);
      allSessions.push(...fiaSessions);
      seriesIncluded.push(series);
    } catch (err) {
      process.stdout.write(`  ERROR: ${(err as Error).message}\n`);
    }
  }

  // Sort and write
  allSessions.sort((a, b) => a.startUtc.localeCompare(b.startUtc));

  const payload: CalendarData = {
    generatedAt: new Date().toISOString(),
    windowStart: existing.windowStart,
    windowEnd: existing.windowEnd,
    seriesIncluded,
    sessions: allSessions,
  };

  const outPath = join(DATA_DIR, "calendar-2026.json");
  writeFileSync(outPath, JSON.stringify(payload, null, 2));
  process.stdout.write(`\nWrote ${outPath} (${allSessions.length} sessions across ${seriesIncluded.length} series)\n`);
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
