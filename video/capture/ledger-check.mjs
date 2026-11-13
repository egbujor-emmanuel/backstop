import { chromium } from "playwright-core";
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const fails = [];
page.on("response", (r) => { if (r.url().includes("rpc.test.mezo.org") && r.status() >= 400) fails.push(r.status()); });
const t0 = Date.now();
await page.goto("http://localhost:4319/#/", { waitUntil: "networkidle" });
let val = "…";
for (let i = 0; i < 40 && val.includes("…"); i++) {
  await page.waitForTimeout(1000);
  val = (await page.getByText("Outside wallets").locator("..").innerText()).replace(/\s+/g, " ");
}
console.log(JSON.stringify({ val, seconds: (Date.now() - t0) / 1000, rpcFailures: fails }));
await browser.close();
