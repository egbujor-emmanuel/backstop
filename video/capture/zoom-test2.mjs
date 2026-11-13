import { chromium } from "playwright-core";
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.addInitScript(() => {
  document.addEventListener("DOMContentLoaded", () => { document.documentElement.style.zoom = "1.5"; });
  document.addEventListener("mousemove", (e) => { window.__m = { x: e.clientX, y: e.clientY }; }, true);
});
await page.goto("https://backstop-pearl.vercel.app/#/cover", { waitUntil: "networkidle" });
await page.waitForTimeout(3000);
const btn = page.getByRole("button", { name: "Connect wallet", exact: true });
const box = await btn.boundingBox();
const mx = box.x + box.width / 2, my = box.y + box.height / 2;
await page.mouse.move(mx, my);
await page.waitForTimeout(200);
const r = await page.evaluate(() => {
  const b = document.querySelector('header button').getBoundingClientRect();
  return { m: window.__m, rect: { x: b.x, y: b.y, w: b.width, h: b.height } };
});
console.log(JSON.stringify({ playwrightBox: box, mouse: { mx, my }, ...r }));
await browser.close();
