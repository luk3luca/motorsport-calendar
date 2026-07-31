#!/usr/bin/env npx tsx
/**
 * scrape-motogp-round.ts
 *
 * Scrapes session data for a SINGLE MotoGP event page.
 * Usage: npx tsx scripts/scrape-motogp-round.ts <event-url>
 * Output: JSON to stdout
 *
 * Uses Playwright's locator with { force: true } to bypass overlay
 * interception (OneTrust cookie consent, Session Expired modals).
 */
import { chromium, type Page } from "playwright";

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
  const url = process.argv[2];
  if (!url || !url.startsWith("http")) {
    console.error("Usage: npx tsx scripts/scrape-motogp-round.ts <event-url>");
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  });

  try {
    const data = await scrapeEvent(page, url);
    if (data) {
      console.log(JSON.stringify(data));
    } else {
      console.error("No data extracted");
      process.exit(2);
    }
  } finally {
    await browser.close();
  }
}

/* ------------------------------------------------------------------ */

async function scrapeEvent(page: Page, url: string): Promise<EventData | null> {
  console.error(`  Loading page…`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });

  // Wait for the page to settle (modals, JS initialisation)
  await page.waitForTimeout(10000);

  // Dismiss overlays using force:true to bypass interception
  console.error(`  Dismissing overlays…`);
  await dismissOverlays(page);
  await page.waitForTimeout(2000);

  // Extract metadata
  console.error(`  Extracting metadata…`);
  const meta = await page.evaluate(() => {
    const hero = document.querySelector("[class*='event-hero']");
    if (!hero) return null;
    return {
      name: hero.querySelector("h1")?.textContent?.trim() ?? "",
      dateRange: hero.querySelector("[class*='date']")?.textContent?.trim() ?? "",
      track: hero.querySelector("[class*='track-name']")?.textContent?.trim() ?? "",
    };
  });
  if (!meta || !meta.name) {
    console.error(`  Failed: no metadata`);
    return null;
  }
  console.error(`  Event: ${meta.name} (${meta.dateRange})`);

  // Get day tabs
  const dayLabels: string[] = await page.evaluate(() => {
    const names = document.querySelectorAll(".event-schedule__tab-label-name");
    return Array.from(names).map((el) => el.textContent?.trim().toUpperCase() ?? "");
  });
  if (dayLabels.length === 0) {
    console.error(`  Failed: no schedule widget`);
    return null;
  }
  console.error(`  Days: ${dayLabels.join(", ")}`);

  // Switch to track time
  await clickTrackTime(page);

  // Extract each day
  const daySchedule: DaySchedule[] = [];
  for (const targetDay of ["FRIDAY", "SATURDAY", "SUNDAY"]) {
    const sessions = await extractDay(page, targetDay, dayLabels);
    if (sessions.length > 0) {
      daySchedule.push({ day: targetDay, sessions });
      console.error(`    ${targetDay}: ${sessions.length} sessions`);
    }
  }

  if (daySchedule.length === 0) {
    console.error(`  Failed: no sessions`);
    return null;
  }

  return { url, ...meta, days: daySchedule };
}

/* ------------------------------------------------------------------ */

async function extractDay(
  page: Page,
  dayName: string,
  availableDays: string[],
): Promise<SessionEntry[]> {
  const idx = availableDays.indexOf(dayName);
  if (idx === -1) return [];

  // Click day tab with force:true to bypass overlays
  const tabs = page.locator(".event-schedule__tab-list-item");
  const count = await tabs.count();
  if (idx >= count) return [];

  await tabs.nth(idx).click({ force: true });
  await page.waitForTimeout(3000);

  // Dismiss modal that may have reappeared
  await dismissModal(page);

  // Extract sessions
  return await page.evaluate(() => {
    const items = document.querySelectorAll(".event-schedule__content-item");
    const result: SessionEntry[] = [];
    items.forEach((el) => {
      const timeEl = el.querySelector(".event-schedule__content-time");
      const catEl = el.querySelector(".event-schedule__content-category");
      const nameEl = el.querySelector(".event-schedule__content-name");
      if (!timeEl || !catEl || !nameEl) return;

      const time = (timeEl.textContent ?? "").trim().replace(/finished.*/i, "").trim();
      const cat = (catEl.textContent ?? "").trim().replace(/™/g, "");
      const name = (nameEl.textContent ?? "").trim();

      if (!cat || !name || !time) return;
      if (cat === "your time" || cat === "track time") return;

      result.push({ time, category: cat, name });
    });
    return result;
  });
}

/* ------------------------------------------------------------------ */
/*  Overlay helpers                                                    */
/* ------------------------------------------------------------------ */

async function dismissOverlays(page: Page): Promise<void> {
  // OneTrust "I Accept" — force:true bypasses the dark overlay
  const acceptBtn = page.locator("#onetrust-accept-btn-handler");
  if (await acceptBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await acceptBtn.click({ force: true });
    await page.waitForTimeout(1000);
    console.error(`    Cookies accepted`);
  }

  // Session Expired "DISMISS"
  await dismissModal(page);
}

async function dismissModal(page: Page): Promise<void> {
  const dismissBtn = page.locator("button:has-text('DISMISS')");
  if (await dismissBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await dismissBtn.click({ force: true });
    await page.waitForTimeout(500);
  }
}

async function clickTrackTime(page: Page): Promise<void> {
  const trackBtn = page.locator("button:has-text('TRACK TIME')");
  if (await trackBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await trackBtn.click({ force: true });
  }
}

/* ------------------------------------------------------------------ */

main();
