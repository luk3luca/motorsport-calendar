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

  // Fetch FIA data FIRST, then replace only what was actually fetched.
  // Never remove existing series up front: a failed source (site redesign,
  // network) must keep the last good data instead of wiping the series.
  const fiaSeries = getFiaSeries();
  const allSessions: Session[] = [...existing.sessions];
  const seriesIncluded = [...existing.seriesIncluded];
  for (const series of fiaSeries) {
    process.stdout.write(`\n=== ${series.toUpperCase()} [FIA source] ===\n`);
    try {
      const fiaSessions = await fetchFiaSeriesCalendar(series);
      if (fiaSessions.length === 0) {
        process.stdout.write(`  Source returned 0 sessions — keeping existing ${series} data\n`);
        continue;
      }
      process.stdout.write(`  Fetched ${fiaSessions.length} sessions from FIA source\n`);
      const filtered = allSessions.filter((s) => s.series !== series);
      filtered.push(...fiaSessions);
      allSessions.length = 0;
      allSessions.push(...filtered);
      if (!seriesIncluded.includes(series)) seriesIncluded.push(series);
    } catch (err) {
      process.stdout.write(
        `  ERROR: ${(err as Error).message} — keeping existing ${series} data\n`,
      );
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
