#!/usr/bin/env npx tsx
/**
 * scrape-motogp-all.ts
 *
 * Orchestrator: iterates over all future MotoGP event URLs and calls
 * scrape-motogp-round.ts for each one. Consolidates the results
 * into data/motogp-schedule.json.
 *
 * Usage: npx tsx scripts/scrape-motogp-all.ts
 */
import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");
const ROUND_SCRIPT = join(__dirname, "scrape-motogp-round.ts");

/* ------------------------------------------------------------------ */
/*  Constants — future event URLs from Germany onwards                */
/* ------------------------------------------------------------------ */

const BASE = "https://www.motogp.com";

const EVENT_URLS = [
  "/en/calendar/2026/event/germany/259be6f4-c23c-4dc2-bc42-7664842f6409",
  "/en/calendar/2026/event/great-britain/41aa319a-8ec5-49d6-aa99-4e2059c88098",
  "/en/calendar/2026/event/spain/86abdbde-5e3d-45b1-a1f0-f74044a90eb3",
  "/en/calendar/2026/event/san-marino/537f71f7-25ea-4cb2-a259-70b0da576cc6",
  "/en/calendar/2026/event/austria/1d659e29-247a-402c-ba1e-33fa14670cbe",
  "/en/calendar/2026/event/japan/a87453f0-3ed0-4469-993a-1486af92d879",
  "/en/calendar/2026/event/indonesia/877c27e8-70e0-4847-bacf-2290d7cc903c",
  "/en/calendar/2026/event/australia/66961f05-2454-4455-9d65-f99c49d25b17",
  "/en/calendar/2026/event/malaysia/d1aedfce-d7c8-4d4a-9532-99c82547baad",
  "/en/calendar/2026/event/qatar/3f3d3f5e-851c-42d2-887a-8ce8b41fa908",
  "/en/calendar/2026/event/portugal/c7f7626b-807f-4a6f-813e-7ad2c68302a3",
  "/en/calendar/2026/event/valencia/6ad2859f-51c4-459e-9714-338814e7537f",
];

/* ------------------------------------------------------------------ */

interface SessionEntry {
  time: string;
  category: string;
  name: string;
}

interface DaySchedule {
  day: string;
  sessions: SessionEntry[];
}

interface EventData {
  url: string;
  name: string;
  dateRange: string;
  track: string;
  days: DaySchedule[];
}

/* ------------------------------------------------------------------ */

async function main() {
  const results: EventData[] = [];
  const errors: { url: string; error: string }[] = [];

  for (let i = 0; i < EVENT_URLS.length; i++) {
    const url = `${BASE}${EVENT_URLS[i]}`;
    console.log(`\n[${i + 1}/${EVENT_URLS.length}] ${url}`);

    try {
      const output = execSync(
        `npx tsx "${ROUND_SCRIPT}" "${url}"`,
        {
          cwd: ROOT,
          timeout: 300_000,
          maxBuffer: 10 * 1024 * 1024,
          encoding: "utf-8",
        },
      );

      // output is stdout; stderr prints inline automatically
      const stdout = output.trim();

      if (stdout) {
        const data = JSON.parse(stdout) as EventData;
        const total = data.days.reduce((s, d) => s + d.sessions.length, 0);
        console.log(`  ✅ ${data.name}: ${data.days.length} days, ${total} sessions`);
        results.push(data);
      } else {
        console.log(`  ⚠ No output`);
        errors.push({ url, error: "No output" });
      }
    } catch (err: unknown) {
      const msg = (err instanceof Error ? err.message : String(err))
        .split("\n").slice(-3).join("; ");
      console.log(`  ❌ ${msg}`);
      errors.push({ url, error: msg });
    }
  }

  // Save results
  mkdirSync(DATA_DIR, { recursive: true });
  const outPath = join(DATA_DIR, "motogp-schedule.json");
  writeFileSync(
    outPath,
    JSON.stringify(
      { generatedAt: new Date().toISOString(), events: results },
      null,
      2,
    ),
  );

  // Summary
  const totalSessions = results.reduce(
    (s, e) => s + e.days.reduce((s2, d) => s2 + d.sessions.length, 0),
    0,
  );
  console.log(`\n═══════════════════════════════════════`);
  console.log(`  ${results.length}/${EVENT_URLS.length} eventi riusciti`);
  console.log(`  ${totalSessions} sessioni totali`);
  console.log(`  ${errors.length} errori`);
  if (errors.length > 0) {
    console.log(`  Errori:`);
    for (const e of errors) {
      const short = e.url.split("/event/")[1]?.split("/")[0] || e.url;
      console.log(`    - ${short}: ${e.error}`);
    }
  }
  console.log(`\n  Salvato: ${outPath}`);
  console.log(`═══════════════════════════════════════`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
