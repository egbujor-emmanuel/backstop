// Records the BACKSTOP walkthrough from the live app, as one continuous take with scene marks.
//
//   node capture.mjs --rehearse   checks every selector, sends no transaction, records nothing
//   node capture.mjs              records ../assets/raw/walkthrough.webm and ../assets/raw/marks.json
//
// The page talks to a scripted wallet: window.ethereum forwards every request to Node through an
// exposed function, and Node signs with the team's labelled "drill buyer" testnet key read from
// ~/.backstop/team-wallets.env. The key never enters the page, and nothing prints it.
import { chromium } from "playwright-core";
import { createPublicClient, createWalletClient, defineChain, http, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE_URL ?? "https://backstop-pearl.vercel.app";
const REHEARSE = process.argv.includes("--rehearse");
const RAW = path.join(HERE, "..", "assets", "raw");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
// A true 1920x1080 viewport with the page zoomed 1.5x (CSS zoom): every frame is native 1920 px wide
// and the UI text is large enough to read in a video. Chrome's headless screencast ignores
// deviceScaleFactor, so zoom is how the frames stay sharp.
const W = 1920;
const H = 1080;
const SCALE = 1;
const ZOOM = 1.5;

const mezoTestnet = defineChain({
  id: 31611,
  name: "Mezo Testnet",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.test.mezo.org"] } },
});

function readKey() {
  const file = path.join(os.homedir(), ".backstop", "team-wallets.env");
  const line = fs.readFileSync(file, "utf8").split(/\r?\n/).find((l) => l.startsWith("BUYER_PRIVATE_KEY="));
  if (!line) throw new Error("BUYER_PRIVATE_KEY missing from team-wallets.env");
  const key = line.slice("BUYER_PRIVATE_KEY=".length).trim().replace(/^"|"$/g, "");
  return key.startsWith("0x") ? key : `0x${key}`;
}

const account = privateKeyToAccount(readKey());
const publicClient = createPublicClient({ chain: mezoTestnet, transport: http() });
const walletClient = createWalletClient({ account, chain: mezoTestnet, transport: http() });
const sent = [];
// Like a real wallet, the account is revealed only after the visitor approves the connection.
let authorized = false;

/** Node side of the scripted wallet. Returns { result } or { error } so failures reach the dapp. */
async function walletRequest(method, params = []) {
  try {
    switch (method) {
      case "eth_requestAccounts":
        authorized = true;
        return { result: [account.address] };
      case "eth_accounts":
        return { result: authorized ? [account.address] : [] };
      case "eth_chainId":
        return { result: toHex(mezoTestnet.id) };
      case "net_version":
        return { result: String(mezoTestnet.id) };
      case "wallet_switchEthereumChain":
      case "wallet_addEthereumChain":
        return { result: null };
      case "wallet_requestPermissions":
      case "wallet_getPermissions":
        return { result: [{ parentCapability: "eth_accounts" }] };
      case "personal_sign":
        return { result: await account.signMessage({ message: { raw: params[0] } }) };
      case "eth_sendTransaction": {
        if (REHEARSE) throw new Error("rehearsal: no transactions");
        const tx = params[0];
        const hash = await walletClient.sendTransaction({
          to: tx.to,
          data: tx.data,
          value: tx.value ? BigInt(tx.value) : undefined,
          gas: tx.gas ? BigInt(tx.gas) : undefined,
        });
        sent.push(hash);
        console.log(`  tx sent ${hash}`);
        return { result: hash };
      }
      default:
        return { result: await publicClient.request({ method, params }) };
    }
  } catch (e) {
    return { error: { message: e instanceof Error ? e.message.split("\n")[0] : String(e), code: 4001 } };
  }
}

const PAGE_SETUP = `
(() => {
  const listeners = {};
  window.ethereum = {
    isBackstopDemoWallet: true,
    request: async ({ method, params }) => {
      const r = await window.__demoWallet(method, params ?? []);
      if (r.error) { const e = new Error(r.error.message); e.code = r.error.code; throw e; }
      return r.result;
    },
    on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); return this; },
    removeListener(ev, fn) { listeners[ev] = (listeners[ev] || []).filter((f) => f !== fn); return this; },
  };
  const applyZoom = () => { document.documentElement.style.zoom = '__ZOOM__'; };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyZoom); else applyZoom();
  const addCursor = () => {
    if (document.getElementById('demo-cursor')) return;
    const c = document.createElement('div');
    c.id = 'demo-cursor';
    c.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M5 3L19 12L12 13L9 20L5 3Z" fill="#ecebe4" stroke="#0b0d0c" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    c.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;left:-40px;top:-40px;transition:left .08s linear,top .08s linear;filter:drop-shadow(1px 2px 2px rgba(0,0,0,.5))';
    document.body.appendChild(c);
    // Events report screen pixels, but a fixed element's left/top are scaled by the page zoom.
    document.addEventListener('mousemove', (e) => { c.style.left = (e.clientX / __ZOOM__) + 'px'; c.style.top = (e.clientY / __ZOOM__) + 'px'; }, true);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addCursor); else addCursor();
})();
`;

// ---------------------------------------------------------------- helpers
const t0 = { at: 0 };
const marks = [];
function mark(id) {
  const t = (Date.now() - t0.at) / 1000;
  marks.push({ id, t });
  console.log(`[${t.toFixed(1)}s] ${id}`);
}
const wait = (page, ms) => page.waitForTimeout(ms);

async function must(locator, label) {
  try {
    await locator.first().waitFor({ state: "visible", timeout: 20_000 });
    console.log(`  ok   ${label}`);
    return locator.first();
  } catch {
    throw new Error(`selector failed: ${label}`);
  }
}

async function glide(page, locator, label) {
  const el = await must(locator, label);
  await el.scrollIntoViewIfNeeded();
  const box = await el.boundingBox();
  if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 18 });
  await wait(page, 350);
  return el;
}

async function click(page, locator, label, after = 900) {
  const el = await glide(page, locator, label);
  await el.click();
  await wait(page, after);
}

async function type(page, locator, text, label) {
  const el = await glide(page, locator, label);
  await el.click();
  await el.fill("");
  await el.pressSequentially(text, { delay: 90 });
  await wait(page, 500);
}

async function scrollBy(page, total, steps = 8, pause = 380) {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, total / steps);
    await wait(page, pause);
  }
}

async function nav(page, name) {
  const link = page.getByRole("navigation", { name: "Main" }).getByRole("link", { name, exact: true });
  await click(page, link, `nav ${name}`, 2200);
}

/** Waits until a TxButton's status region shows `count` confirmed steps. */
/** Waits until the TxButton has finished every step (no longer busy) and shows a confirmation. */
async function confirmed(page, count, label) {
  if (REHEARSE) return;
  await page.waitForTimeout(1500);
  await page.waitForFunction(
    (n) =>
      !document.querySelector('button[aria-busy="true"]') &&
      [...document.querySelectorAll('[role="status"]')].some((s) => (s.textContent.match(/confirmed/g) || []).length >= n),
    count,
    { timeout: 180_000 },
  );
  console.log(`  ok   ${label} confirmed`);
}

// ---------------------------------------------------------------- the walkthrough
async function walkthrough(page) {
  // s1: the October 5 data.
  mark("s1");
  await page.goto(`${BASE}/#/replay`, { waitUntil: "networkidle" });
  await must(page.getByRole("heading", { level: 1 }), "replay heading");
  await wait(page, 2500);
  await page.mouse.move(W * 0.5, H * 0.55, { steps: 12 });
  await scrollBy(page, 1500, 12, 450);
  await wait(page, 1500);

  // s2: what BACKSTOP is.
  mark("s2");
  await click(page, page.getByRole("link", { name: "BACKSTOP home" }), "home logo", 2500);
  await page.mouse.move(W * 0.35, H * 0.4, { steps: 15 });
  await wait(page, 2500);
  await scrollBy(page, 900, 8, 450);
  await wait(page, 1200);

  // s3: connect the wallet.
  mark("s3");
  await page.mouse.wheel(0, -3000);
  await wait(page, 1500);
  await click(page, page.getByRole("button", { name: "Connect wallet", exact: true }), "connect wallet", 1600);
  await click(page, page.getByRole("dialog", { name: "Choose a wallet" }).getByRole("button", { name: /Browser wallet/ }), "browser wallet in menu", 2500);
  await glide(page, page.getByRole("button", { name: /disconnect wallet/i }), "connected address");
  await wait(page, 2200);

  // s4: buy cover.
  mark("s4");
  await nav(page, "Get cover");
  await click(page, page.getByRole("button", { name: /^Mezo Swap \(Tigris\) pools exploit/ }), "Tigris product", 1200);
  await type(page, page.getByLabel("Cover (MUSD)"), "10", "cover amount");
  await type(page, page.getByLabel("Duration (days)"), "30", "duration");
  await wait(page, 1800);
  const buy = page.getByRole("button", { name: /buy cover/i });
  await glide(page, buy, "buy button");
  if (!REHEARSE) {
    await buy.click();
    await confirmed(page, 1, "buy");
  }
  await wait(page, 2000);
  await glide(page, page.getByRole("heading", { name: "Your policies" }), "your policies");
  await scrollBy(page, 250, 3, 400);
  await wait(page, 2500);

  // s5: underwrite.
  mark("s5");
  await nav(page, "Underwrite");
  await type(page, page.getByLabel("Amount (MUSD)"), "20", "deposit amount");
  await wait(page, 1200);
  const deposit = page.getByRole("button", { name: /deposit/i }).first();
  await glide(page, deposit, "deposit button");
  if (!REHEARSE) {
    await deposit.click();
    await confirmed(page, 1, "deposit");
  }
  await wait(page, 2500);

  // s6: the claim form (shown, not submitted: the decided claims in s7 are the real outcome).
  mark("s6");
  await nav(page, "Claims court");
  await glide(page, page.getByRole("heading", { name: "File a claim" }), "file a claim");
  await wait(page, 800);
  await type(page, page.getByLabel("Amount (MUSD)"), "10", "claim amount");
  await type(page, page.getByLabel("Evidence link"), "https://explorer.test.mezo.org/tx/…", "evidence link");
  await glide(page, page.getByRole("button", { name: /file claim|file a claim|approve/i }).last(), "file button");
  await wait(page, 2200);

  // s7: decided claims, newest first: the veBTC claim (DRILL-003) approved and paid, the halt claim
  // rejected, the Tigris claim approved and paid. Each card holds long enough to read its verdict.
  mark("s7");
  await page.mouse.wheel(0, -6000);
  await wait(page, 1800);
  const cards = page.locator("article");
  const count = await cards.count();
  for (let i = 0; i < Math.min(count, 3); i++) {
    await glide(page, cards.nth(i), `claim card ${i}`);
    await wait(page, 3800);
  }

  // s8: proof.
  mark("s8");
  await nav(page, "Proof");
  await wait(page, 1500);
  await scrollBy(page, 2400, 16, 420);
  await wait(page, 2000);
  mark("end");
}

// ---------------------------------------------------------------- run
// Frames come from Chrome's own screencast (CDP), which delivers the page at device pixels
// (1280x720 CSS at 1.5x = 1920x1080). Each frame keeps its real timestamp; ffmpeg turns the
// sequence into a constant 30 fps MP4 afterwards.
import { execFileSync } from "node:child_process";

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--hide-scrollbars"] });
fs.mkdirSync(RAW, { recursive: true });
const FRAMES = path.join(RAW, "frames");
const context = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: SCALE,
  reducedMotion: "no-preference",
});
await context.exposeFunction("__demoWallet", walletRequest);
await context.addInitScript(PAGE_SETUP.replaceAll("__ZOOM__", String(ZOOM)));
const page = await context.newPage();

const frames = [];
let cdp = null;
if (!REHEARSE) {
  fs.rmSync(FRAMES, { recursive: true, force: true });
  fs.mkdirSync(FRAMES, { recursive: true });
  cdp = await context.newCDPSession(page);
  cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
    const file = path.join(FRAMES, `${String(frames.length).padStart(6, "0")}.jpg`);
    fs.writeFileSync(file, Buffer.from(data, "base64"));
    frames.push({ file, t: metadata.timestamp * 1000 });
    await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => undefined);
  });
  await cdp.send("Page.startScreencast", {
    format: "jpeg",
    quality: 92,
    maxWidth: W * SCALE,
    maxHeight: H * SCALE,
    everyNthFrame: 1,
  });
}

t0.at = Date.now();
let failed = null;
try {
  await walkthrough(page);
} catch (e) {
  failed = e;
  console.error(`FAILED: ${e.message}`);
}
if (cdp) await cdp.send("Page.stopScreencast").catch(() => undefined);
await context.close();
await browser.close();

if (!REHEARSE && !failed) {
  // Build a concat list where each frame lasts until the next one arrives.
  const endT = t0.at + marks[marks.length - 1].t * 1000 + 1000;
  const lines = [];
  const firstT = frames[0].t;
  frames.forEach((f, i) => {
    const next = i + 1 < frames.length ? frames[i + 1].t : endT;
    lines.push(`file '${f.file.replace(/\\/g, "/")}'`, `duration ${Math.max(0.001, (next - f.t) / 1000).toFixed(4)}`);
  });
  lines.push(`file '${frames[frames.length - 1].file.replace(/\\/g, "/")}'`);
  const list = path.join(RAW, "frames.txt");
  fs.writeFileSync(list, lines.join("\n"));
  const out = path.join(RAW, "walkthrough.mp4");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", list,
    "-vf", `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:-1:-1:color=0x0b0d0c,setsar=1,fps=30,format=yuv420p`, "-c:v", "libx264", "-crf", "16", "-preset", "medium", out], { stdio: "inherit" });
  // Marks are relative to t0; the video starts at the first frame.
  const offset = (firstT - t0.at) / 1000;
  const shifted = marks.map((m) => ({ id: m.id, t: Math.max(0, m.t - offset) }));
  fs.writeFileSync(path.join(RAW, "marks.json"), JSON.stringify({ marks: shifted, frames: frames.length, transactions: sent }, null, 2));
  console.log(`saved ${out} from ${frames.length} frames`);
}
console.log(REHEARSE ? (failed ? "REHEARSAL FAILED" : "REHEARSAL PASSED") : failed ? "RECORDING FAILED" : "RECORDING DONE");
process.exit(failed ? 1 : 0);
