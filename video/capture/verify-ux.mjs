// Verifies the judge-report UX fixes on a local build (no wallet installed).
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://localhost:4319";
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const results = {};
const errors = [];

async function open(page, hash) {
  await page.goto(`${BASE}/${hash}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3500);
}

// Desktop
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", (e) => errors.push(`desktop: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`desktop console: ${m.text().slice(0, 160)}`); });
  await open(page, "#/cover");
  await page.getByRole("button", { name: "Connect wallet", exact: true }).click();
  await page.waitForTimeout(400);
  const openBefore = await page.getByRole("dialog", { name: "Choose a wallet" }).count();
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Underwrite", exact: true }).click();
  await page.waitForTimeout(1500);
  results.menuClosesOnRouteChange = openBefore === 1 && (await page.getByRole("dialog").count()) === 0;
  const underwriteText = await page.locator("main").innerText();
  results.underwriteNoEllipsisWhenLoggedOut = !/Worth|Withdrawable now|Wallet balance: …/.test(underwriteText);
  results.underwriteConnectHint = underwriteText.includes("Connect a wallet to see your shares");
  await open(page, "#/cover");
  results.coverNoBalancePlaceholder = !(await page.locator("main").innerText()).includes("Your balance: …");
  results.coverAddressesShortened = !(await page.locator("main").innerText()).match(/0x[0-9a-fA-F]{40}/);
  await open(page, "#/replay");
  const replay = await page.locator("main").innerText();
  results.haltSendersShown = replay.includes("Who could still transact during the halt") && /10\s*EVM transactions/.test(replay);
  await open(page, "#/");
  await page.waitForTimeout(4000);
  const stat = await page.getByText("Outside wallets").locator("..").innerText();
  results.outsideWalletStat = stat.replace(/\s+/g, " ");
  await open(page, "#/claims");
  results.claimsDrillNote = (await page.locator("main").innerText()).includes("On testnet the claims so far are drills");
  await page.close();
}

// Phone
{
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  page.on("pageerror", (e) => errors.push(`mobile: ${e.message}`));
  await open(page, "#/replay");
  const nav = page.getByRole("navigation", { name: "Main mobile" });
  const W = 375;
  const linkBoxes = await nav.getByRole("link").evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { t: e.textContent, right: r.right, visible: r.width > 0 }; }));
  results.mobileNavAllLinksInView = linkBoxes.every((b) => b.visible && b.right <= W + 1);
  results.mobileNavLinks = linkBoxes.map((b) => b.t).join(", ");
  results.mobileReplayHints = (await page.getByText("Swipe the table sideways").count()) === 1 && (await page.getByText("Swipe the chart sideways").count()) === 1;
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  results.mobileNoPageOverflow = overflow <= 0;
  await page.close();
}

await browser.close();
console.log(JSON.stringify({ results, errors }, null, 1));
