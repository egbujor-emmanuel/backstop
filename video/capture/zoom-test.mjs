// Checks that a 1.5x CSS zoom keeps clicks, element boxes and the cursor overlay aligned.
import { chromium } from "playwright-core";

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.addInitScript(() => {
  document.addEventListener("DOMContentLoaded", () => { document.documentElement.style.zoom = "1.5"; });
  window.__lastMove = null;
  document.addEventListener("mousemove", (e) => { window.__lastMove = { x: e.clientX, y: e.clientY }; }, true);
});
await page.goto("https://backstop-pearl.vercel.app/#/cover", { waitUntil: "networkidle" });
await page.waitForTimeout(3000);
const btn = page.getByRole("button", { name: /^Mezo transaction halt/ });
const box = await btn.boundingBox();
const cx = box.x + box.width / 2;
const cy = box.y + box.height / 2;
await page.mouse.move(cx, cy);
await btn.click();
await page.waitForTimeout(500);
const result = await page.evaluate(([x, y]) => ({
  pressed: document.querySelector('button[aria-label^="Mezo transaction halt"]')?.getAttribute("aria-pressed"),
  hitAtMouse: document.elementFromPoint(x / 1.5, y / 1.5)?.closest("button")?.getAttribute("aria-label")?.slice(0, 30) ?? null,
  hitRaw: document.elementFromPoint(x, y)?.closest("button")?.getAttribute("aria-label")?.slice(0, 30) ?? null,
  lastMove: window.__lastMove,
  innerWidth,
  navVisible: !!document.querySelector('nav[aria-label="Main"]')?.offsetParent,
}), [cx, cy]);
await page.screenshot({ path: "zoom-test.png" });
console.log(JSON.stringify({ box, mouse: { x: cx, y: cy }, ...result }, null, 1));
await browser.close();
