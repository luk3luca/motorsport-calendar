/**
 * merge-tsd-window.ts
 *
 * Merges a bounded TheSportsDB refresh (data/tsd-window.json, produced by
 * fetch-calendar.ts with OUTPUT_PATH=data/tsd-window.json and a short
 * WINDOW_END) into the main calendar, replacing ONLY the sessions of the
 * TSD-sourced series inside that window. Everything else (history, other
 * series, scraped data) is left untouched.
 *
 * Usage: npx tsx scripts/merge-tsd-window.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { CalendarData, SeriesId, Session } from "../src/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");

/** Only these series come from TheSportsDB in the weekly pipeline. */
const TSD_SERIES: SeriesId[] = ["f1", "formula_e", "nascar", "imsa", "wec"];

interface WindowFile {
  windowStart: string;
  windowEnd: string;
  sessions: Session[];
}

function overlaps(s: Session, winStart: string, winEnd: string): boolean {
  return s.startUtc <= winEnd && s.endUtc >= winStart;
}

async function main(): Promise<void> {
  const mainPath = join(DATA_DIR, "calendar-2026.json");
  const winPath = join(DATA_DIR, "tsd-window.json");

  const main: CalendarData = JSON.parse(readFileSync(mainPath, "utf8"));
  const win: WindowFile = JSON.parse(readFileSync(winPath, "utf8"));

  const before = main.sessions.length;
  // Drop TSD-series sessions overlapping the refreshed window…
  const kept = main.sessions.filter(
    (s) => !(TSD_SERIES.includes(s.series) && overlaps(s, win.windowStart, win.windowEnd)),
  );
  // …and take the fresh ones (already sorted by the fetch).
  const fresh = win.sessions.filter((s) => TSD_SERIES.includes(s.series));

  // Safety dedupe on id (checkpointed fetches can re-see events).
  const seen = new Set<string>();
  const merged = [...kept, ...fresh]
    .sort((a, b) => a.startUtc.localeCompare(b.startUtc))
    .filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });

  const payload: CalendarData = {
    ...main, // preserves original windowStart/windowEnd metadata
    generatedAt: new Date().toISOString(),
    sessions: merged,
  };
  writeFileSync(mainPath, JSON.stringify(payload, null, 2));

  process.stdout.write(
    `Window ${win.windowStart.slice(0, 10)} → ${win.windowEnd.slice(0, 10)}\n` +
      `Replaced ${before - kept.length} old TSD sessions with ${fresh.length} fresh ones\n` +
      `Total: ${merged.length} sessions (was ${before})\n`,
  );
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
