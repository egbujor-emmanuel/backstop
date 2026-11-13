// Exports the live deck to submission/BACKSTOP-deck.pdf after its web fonts have loaded.
import { chromium } from "playwright-core";

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto("https://backstop-pearl.vercel.app/deck.html", { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1500);
const fonts = await page.evaluate(() => [...new Set([...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family))]);
const slides = await page.locator(".slide").count();
await page.emulateMedia({ media: "print" });
await page.pdf({
  path: "../../submission/BACKSTOP-deck.pdf",
  width: "1600px",
  height: "900px",
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
});
console.log(JSON.stringify({ slides, fonts }));
await browser.close();
