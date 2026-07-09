/**
 * Debug script — test scraping just the Germany event
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  });

  const url =
    "https://www.motogp.com/en/calendar/2026/event/germany/259be6f4-c23c-4dc2-bc42-7664842f6409";

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(5000);

  // Dismiss modal
  try {
    const dismiss = page.locator("button", { hasText: "DISMISS" });
    if (await dismiss.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dismiss.click();
      await page.waitForTimeout(1000);
      console.log("Modal dismissed");
    }
  } catch {}

  // Debug: get all text on the page
  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log("=== PAGE TEXT (first 3000 chars) ===");
  console.log(bodyText);

  // Debug: check what schedule elements exist
  const scheduleHTML = await page.evaluate(() => {
    const el = document.querySelector("[class*='schedule']");
    if (!el) return "NO SCHEDULE ELEMENT FOUND";
    return el.innerHTML.substring(0, 2000);
  });
  console.log("\n=== SCHEDULE HTML (first 2000 chars) ===");
  console.log(scheduleHTML);

  // Debug: check all class names containing "schedule"
  const classNames = await page.evaluate(() => {
    const all = document.querySelectorAll("[class*='schedule']");
    return Array.from(all).map((el) => ({
      tag: el.tagName,
      classes: el.className.substring(0, 100),
      text: (el.textContent || "").trim().substring(0, 80),
    }));
  });
  console.log("\n=== ELEMENTS WITH 'schedule' IN CLASS ===");
  for (const c of classNames) {
    console.log(`  <${c.tag}> class="${c.classes}..." text="${c.text}"`);
  }

  // Debug: try clicking FRIDAY tab
  console.log("\n=== Trying to click FRIDAY tab ===");
  const tabTexts = await page.evaluate(() => {
    const tabs = document.querySelectorAll("[class*='tab-list-item'], [class*='tab-label']");
    return Array.from(tabs).map((t) => ({
      text: t.textContent?.trim().substring(0, 50),
      classes: t.className.substring(0, 80),
    }));
  });
  console.log("Tab elements:", JSON.stringify(tabTexts, null, 2));

  // Try clicking by element text
  const fridayBtn = page.locator("text=FRIDAY").first();
  if (await fridayBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await fridayBtn.click();
    console.log("Clicked FRIDAY");
    await page.waitForTimeout(3000);
  }

  // Dismiss modal again
  try {
    const dismiss2 = page.locator("button", { hasText: "DISMISS" });
    if (await dismiss2.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dismiss2.click();
      await page.waitForTimeout(1000);
    }
  } catch {}

  // Extract all visible session items
  const sessions = await page.evaluate(() => {
    const items = document.querySelectorAll("[class*='content-item']");
    return Array.from(items).map((el) => ({
      text: (el.textContent || "").trim().substring(0, 200),
      classes: el.className.substring(0, 80),
    }));
  });
  console.log("\n=== VISIBLE CONTENT ITEMS ===");
  for (const s of sessions) {
    console.log(`  [${s.classes}] ${s.text}`);
  }

  // Save full page HTML for inspection
  const html = await page.content();
  writeFileSync("/tmp/motogp-debug.html", html);
  console.log("\nSaved full HTML to /tmp/motogp-debug.html");

  await browser.close();
}

main().catch(console.error);
