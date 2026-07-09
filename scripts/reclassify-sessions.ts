/**
 * Re-classifies all session types in the existing JSON using the updated
 * classifySessionType / estimateDurationMin logic.
 *
 * Usage: npx tsx scripts/reclassify-sessions.ts
 */
import { writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { classifySessionType, estimateDurationMin } from "../src/lib/sources/durations";
import type { CalendarData } from "../src/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");

function main(): void {
  const inPath = join(DATA_DIR, "calendar-2026.json");
  const raw = readFileSync(inPath, "utf8");
  const data: CalendarData = JSON.parse(raw);

  let endChanged = 0;

  const updated = data.sessions.map((s) => {
    const newType = classifySessionType(s.name);
    const { durationMin: newDur, isEstimatedEnd } = estimateDurationMin(s.series, newType, s.name);
    const correctEnd = new Date(Date.parse(s.startUtc) + newDur * 60_000).toISOString();
    const changed = newType !== s.sessionType || newDur !== s.durationMin || correctEnd !== s.endUtc;

    if (changed) endChanged++;

    return {
      ...s,
      sessionType: newType,
      durationMin: newDur,
      endUtc: correctEnd,
      isEstimatedEnd,
    };
  });

  updated.sort((a, b) => a.startUtc.localeCompare(b.startUtc));

  const payload: CalendarData = {
    ...data,
    sessions: updated,
  };

  const outPath = join(DATA_DIR, "calendar-2026.json");
  writeFileSync(outPath, JSON.stringify(payload, null, 2));
  process.stdout.write(
    `Reclassified ${data.sessions.length} sessions: ${endChanged} changed (endUtc corrected).\n`,
  );
}

main();
