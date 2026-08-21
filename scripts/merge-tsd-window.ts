/**
 * merge-tsd-window.ts
 *
 * Non-destructive merge of a bounded TheSportsDB refresh (data/tsd-window.json,
 * produced by fetch-calendar.ts with OUTPUT_PATH=tsd-window.json and a short
 * WINDOW_END) into the main calendar.
 *
 * - TSD-sourced series (f1, formula_e, nascar, imsa, wec): replaced ONLY
 *   inside the refreshed window (overlap merge). History and other series
 *   are never touched.
 * - f2/f3: full-series replace from the FIA data embedded in the window file.
 *   Guard: if the fetched f2/f3 sessions look like the TheSportsDB fallback
 *   (empty venue / generic names), the replace is SKIPPED to avoid overwriting
 *   good FIA data with placeholder junk.
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

/** Series that come from TheSportsDB (window-overlap merge). */
const TSD_SERIES: SeriesId[] = ["f1", "formula_e", "nascar", "imsa", "wec"];
/** Series that come embedded in fetch-calendar output via the FIA source. */
const FIA_SERIES: SeriesId[] = ["f2", "f3"];

interface WindowFile {
  windowStart: string;
  windowEnd: string;
  sessions: Session[];
}

function overlaps(s: Session, winStart: string, winEnd: string): boolean {
  return s.startUtc <= winEnd && s.endUtc >= winStart;
}

/**
 * TheSportsDB fallback entries for f2/f3 have no venue and generic round
 * names ("Italian Sprint Race"). Real FIA data always carries a venue.
 */
function looksLikeTsdFallback(sessions: Session[]): boolean {
  if (sessions.length === 0) return true;
  const emptyVenue = sessions.filter((s) => !s.venue).length;
  return emptyVenue > sessions.length / 2;
}

async function main(): Promise<void> {
  const mainPath = join(DATA_DIR, "calendar-2026.json");
  // Optional CLI arg: --window-file <path> (default: data/tsd-window.json).
  // Monday uses data/tsd-week.json (8-week window), Friday the weekend file.
  const argIdx = process.argv.indexOf("--window-file");
  const rawPath = argIdx > -1 ? process.argv[argIdx + 1] : undefined;
  const winPath = rawPath
    ? (rawPath.startsWith("/") ? rawPath : join(process.cwd(), rawPath))
    : join(DATA_DIR, "tsd-window.json");

  const main: CalendarData = JSON.parse(readFileSync(mainPath, "utf8"));
  const win: WindowFile = JSON.parse(readFileSync(winPath, "utf8"));

  const before = main.sessions.length;

  // --- 1. TSD series: overlap merge inside the refreshed window -------------
  // Guard: if the window file has no TSD sessions at all (fetch failure or
  // f2/f3-only file), skip the overlap replace instead of wiping the window.
  const freshTsd = win.sessions.filter((s) => TSD_SERIES.includes(s.series));
  let kept: Session[];
  let tsdReplaced = 0;
  if (freshTsd.length === 0) {
    process.stdout.write("No TSD-series sessions in window file — keeping existing window data\n");
    kept = main.sessions;
  } else {
    kept = main.sessions.filter(
      (s) => !(TSD_SERIES.includes(s.series) && overlaps(s, win.windowStart, win.windowEnd)),
    );
    tsdReplaced = before - kept.length;
  }

  // --- 2. F2/F3: full-series replace, guarded against TSD fallback ---------
  const freshFia = win.sessions.filter((s) => FIA_SERIES.includes(s.series));
  let fiaReplaced = false;
  let keptAfterFia = kept;
  if (freshFia.length === 0) {
    process.stdout.write("No f2/f3 data in window file — keeping existing FIA sessions\n");
  } else if (looksLikeTsdFallback(freshFia)) {
    process.stdout.write(
      `f2/f3 data looks like TheSportsDB fallback (${freshFia.filter((s) => !s.venue).length}/${freshFia.length} without venue) — NOT replacing\n`,
    );
  } else {
    const withoutFia = keptAfterFia.filter((s) => !FIA_SERIES.includes(s.series));
    keptAfterFia = [...withoutFia, ...freshFia];
    fiaReplaced = true;
  }

  // --- 3. Merge, sort, dedupe by id (checkpointed fetches can re-see events)
  const seen = new Set<string>();
  const merged = [...keptAfterFia, ...freshTsd]
    .sort((a, b) => a.startUtc.localeCompare(b.startUtc))
    .filter((s) => {
      if (!s.id || seen.has(s.id)) return s.id ? false : true;
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
      `TSD overlap: replaced ${tsdReplaced} old with ${freshTsd.length} fresh\n` +
      `FIA f2/f3: ${fiaReplaced ? `replaced with ${freshFia.length} sessions` : "kept existing"}\n` +
      `Total: ${merged.length} sessions (was ${before})\n`,
  );
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
