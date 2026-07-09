/**
 * MotoGP Calendar Scraper
 *
 * Extracts session times for future MotoGP weekends from motogp.com.
 * Uses Playwright (headless Chromium) because the schedule data is loaded
 * dynamically via JavaScript API calls.
 *
 * Usage: npx tsx scripts/scrape-motogp.ts
 * Output: data/motogp-schedule.json
 */
import { chromium, type Page } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SessionEntry {
  time: string;     // "10:45-11:30"
  category: string; // "MotoGP", "Moto2", "Moto3"
  name: string;     // "Free Practice Nr. 1", "Qualifying Nr. 2", etc.
}

interface DaySchedule {
  day: string;
  sessions: SessionEntry[];
}

interface EventSchedule {
  name: string;
  country: string;
  dateRange: string;
  track: string;
  days: DaySchedule[];
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const BASE_URL = "https://www.motogp.com";

const PAST_SLUGS = new Set([
  "thailand", "brasil", "americas", "espana", "france",
  "catalunya", "italy", "hungria", "czeck-republiky", "netherlands",
]);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  console.log("Launching browser…");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  });

  // Block slow unnecessary resources to speed up page loads
  await page.route("**/*", (route) => {
    const type = route.request().resourceType();
    if (["image", "font", "media"].includes(type)) {
      route.abort();
    } else {
      route.continue();
    }
  });

  /* ---------- Step 1: Collect future event links ------------------ */
  console.log("Opening calendar grid…");
  await page.goto(`${BASE_URL}/en/calendar?view=grid`, {
    waitUntil: "domcontentloaded",
    timeout: 20_000,
  }).catch(() => { console.log("Calendar page timeout, continuing…"); });
  await page.waitForSelector('a[href*="/calendar/2026/event/"]', { timeout: 15_000 }).catch(() => {});
  await sleep(3000);
  await dismissModal(page);

  const allLinks = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(
      'a[href*="/calendar/2026/event/"]',
    ));
    const seen = new Set<string>();
    return links
      .map((a) => a.getAttribute("href") ?? "")
      .filter((h) => h && !seen.has(h) && seen.add(h));
  });

  // Germany onwards, no duplicates
  const seenSlugs = new Set<string>();
  const futureLinks = allLinks.filter((href) => {
    if (href.includes("?tab=")) return false;
    const slug = href.split("/event/")[1]?.split("/")[0] ?? "";
    if (PAST_SLUGS.has(slug) || seenSlugs.has(slug)) return false;
    seenSlugs.add(slug);
    return true;
  });

  console.log(`Found ${futureLinks.length} future events.`);
  for (const link of futureLinks) console.log(`  ${BASE_URL}${link}`);

  /* ---------- Step 2: Scrape each event --------------------------- */
  const results: EventSchedule[] = [];

  for (let idx = 0; idx < futureLinks.length; idx++) {
    const url = `${BASE_URL}${futureLinks[idx]}`;
    console.log(`\n[${idx + 1}/${futureLinks.length}] ${url}`);
    try {
      const data = await scrapeEvent(page, url);
      if (data) {
        results.push(data);
        const total = data.days.reduce((s, d) => s + d.sessions.length, 0);
        console.log(`  ✅ ${data.name}: ${data.days.length} days, ${total} sessions`);
      }
    } catch (err) {
      console.error(`  ❌ ${(err as Error).message}`);
    }
  }

  /* ---------- Step 3: Save ---------------------------------------- */
  mkdirSync(DATA_DIR, { recursive: true });
  const outPath = join(DATA_DIR, "motogp-schedule.json");
  writeFileSync(outPath, JSON.stringify(
    { generatedAt: new Date().toISOString(), events: results }, null, 2,
  ));
  console.log(`\nSaved ${outPath} (${results.length} events).`);

  await browser.close();
}

/* ------------------------------------------------------------------ */
/*  Scrape a single event page                                         */
/* ------------------------------------------------------------------ */

async function scrapeEvent(page: Page, url: string): Promise<EventSchedule | null> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForSelector("[class*='event-hero']", { timeout: 15_000 }).catch(() => {});
  await sleep(4000);
  await dismissModal(page);

  // Metadata
  const meta: { name: string; country: string; dateRange: string; track: string } | null =
    await page.evaluate(() => {
      const hero = document.querySelector("[class*='event-hero']");
      if (!hero) return null;
      return {
        name: hero.querySelector("h1")?.textContent?.trim() ?? "",
        country: hero.querySelector("[class*='flag'] img")?.getAttribute("alt")?.trim() ?? "",
        dateRange: hero.querySelector("[class*='date']")?.textContent?.trim() ?? "",
        track: hero.querySelector("[class*='track-name']")?.textContent?.trim() ?? "",
      };
    });
  if (!meta) {
    console.warn("  ⚠ No metadata found");
    return null;
  }

  // Get tab labels (uppercased for matching)
  const dayLabels: string[] = await page.evaluate(() => {
    const names = document.querySelectorAll(".event-schedule__tab-label-name");
    return Array.from(names).map((el) => el.textContent?.trim().toUpperCase() ?? "");
  });
  console.log(`  Days: ${dayLabels.join(", ")}`);

  // Extract sessions for each day that exists
  const daySchedule: DaySchedule[] = [];
  for (const targetDay of ["FRIDAY", "SATURDAY", "SUNDAY"]) {
    const sessions = await extractDay(page, targetDay, dayLabels);
    if (sessions.length > 0) {
      daySchedule.push({ day: targetDay, sessions });
      console.log(`    ${targetDay}: ${sessions.length} sessions`);
    }
  }

  if (daySchedule.length === 0) {
    console.warn("  ⚠ No sessions found");
    return null;
  }

  return { ...meta, days: daySchedule };
}

/* ------------------------------------------------------------------ */
/*  Extract sessions for a given day                                   */
/* ------------------------------------------------------------------ */

async function extractDay(
  page: Page,
  dayName: string,
  availableDays: string[],
): Promise<SessionEntry[]> {
  const idx = availableDays.indexOf(dayName);
  if (idx === -1) return [];

  // Click the day tab (use the nth tab list item)
  const tabs = page.locator(".event-schedule__tab-list-item");
  const count = await tabs.count();
  if (idx >= count) return [];

  await tabs.nth(idx).click();
  await sleep(2500);
  await dismissModal(page);
  await sleep(500);

  // Extract sessions from the content list
  return await page.evaluate(() => {
    const items = document.querySelectorAll(".event-schedule__content-item");
    const result: SessionEntry[] = [];

    items.forEach((el) => {
      const timeEl = el.querySelector(".event-schedule__content-time");
      const catEl = el.querySelector(".event-schedule__content-category");
      const nameEl = el.querySelector(".event-schedule__content-name");

      if (!timeEl || !catEl || !nameEl) return;

      const time = (timeEl.textContent ?? "").trim();
      const category = (catEl.textContent ?? "").trim().replace(/™/g, "");
      const name = (nameEl.textContent ?? "").trim();

      // Skip the timezone toggle row
      if (category === "your time" || category === "track time") return;
      if (!time || !name) return;

      result.push({ time: time.replace(/finished.*/i, "").trim(), category, name });
    });

    return result;
  });
}

/* ------------------------------------------------------------------ */
/*  Dismiss modal                                                      */
/* ------------------------------------------------------------------ */

async function dismissModal(page: Page): Promise<void> {
  try {
    const btn = page.locator("button:has-text('DISMISS')");
    if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await btn.click();
      await sleep(500);
    }
  } catch { /* ignore */ }
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
