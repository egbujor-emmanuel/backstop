// Makes the AKINDO product icon and five gallery images from the live site.
//   node gallery.mjs   -> ../../submission/icon.png, ../../submission/gallery-1..5.png
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "..", "..", "submission");
const SITE = "https://backstop-pearl.vercel.app";
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });

// Icon: the BACKSTOP serif "B" over the hazard stripe, on the app's ink.
{
  const font = fs.readFileSync(path.join(HERE, "..", "assets", "fonts", "instrument-serif-latin-400-normal.woff2")).toString("base64");
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
  await page.setContent(`<!doctype html><html><head><style>
    @font-face { font-family: IS; src: url(data:font/woff2;base64,${font}) format("woff2"); }
    html, body { margin: 0; width: 1024px; height: 1024px; background: #0b0d0c; }
    .card { position: absolute; inset: 0; background: #0b0d0c; overflow: hidden; }
    .b { position: absolute; left: 0; right: 0; top: 70px; text-align: center; font-family: IS; font-size: 760px; line-height: 1; color: #ecebe4; }
    .stripe { position: absolute; left: 0; right: 0; bottom: 120px; height: 120px;
      background-image: repeating-linear-gradient(-45deg, #f5a524 0 44px, transparent 44px 88px); }
  </style></head><body><div class="card"><div class="b">B</div><div class="stripe"></div></div></body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, "icon.png") });
  await page.close();
}

// Gallery: real pages, 1920x1080 viewport, page zoomed 1.25x so text reads at thumbnail size.
const shots = [
  { file: "gallery-1.png", hash: "#/", scroll: 0, what: "home" },
  { file: "gallery-2.png", hash: "#/cover", scroll: 260, what: "cover" },
  { file: "gallery-3.png", hash: "#/claims", scroll: 430, what: "claims" },
  { file: "gallery-4.png", hash: "#/replay", scroll: null, anchor: "Who could still transact during the halt", what: "halt" },
  { file: "gallery-5.png", hash: "#/proof", scroll: 0, what: "proof" },
];
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, reducedMotion: "reduce" });
await ctx.addInitScript(() => {
  document.addEventListener("DOMContentLoaded", () => { document.documentElement.style.zoom = "1.25"; });
});
const page = await ctx.newPage();
for (const s of shots) {
  await page.goto(`${SITE}/${s.hash}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(9000); // live chain reads and the event ledger
  if (s.anchor) {
    await page.getByText(s.anchor).first().scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -260));
  } else {
    await page.evaluate((y) => window.scrollTo(0, y), s.scroll);
  }
  await page.waitForTimeout(1500);
  const stuck = await page.evaluate(() => [...document.querySelectorAll("main *")].filter((e) => e.children.length === 0 && e.textContent.trim() === "…" && e.getBoundingClientRect().top < innerHeight && e.getBoundingClientRect().bottom > 0).length);
  await page.screenshot({ path: path.join(OUT, s.file) });
  console.log(`${s.file} (${s.what}) placeholders visible: ${stuck}`);
}
await browser.close();
