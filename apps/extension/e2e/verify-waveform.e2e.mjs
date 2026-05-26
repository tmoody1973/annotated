// Loaded-extension verification for §7: the recorded-commentary waveform preview
// and the "Take N" counter.
//
// Drives the real record→stop flow through the panel UI with a fake mic, then
// asserts a waveform <canvas> + "Take 1" appear, re-records, and asserts the
// counter bumps to "Take 2". Screenshots the recorded state.
//
// The recorder captures the mic in the ACTIVE TAB via chrome.scripting (a
// chrome-extension panel page can't getUserMedia), so we need a REAL injectable
// tab. We open example.com (reliable, https) and shim chrome.tabs.query to report
// that real tab id but a YouTube URL — so detection mounts the ClipComposer while
// executeScript still targets a real, injectable page.
//
// Run:
//   pnpm --filter extension build
//   node apps/extension/e2e/verify-waveform.e2e.mjs

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import { tmpdir, homedir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolveChromium() {
  const bases = [];
  if (process.env.PLAYWRIGHT_DIR) bases.push(process.env.PLAYWRIGHT_DIR);
  bases.push(join(process.cwd(), "node_modules"), resolve(__dirname, "..", "node_modules"));
  const npxCache = join(homedir(), ".npm", "_npx");
  if (existsSync(npxCache)) {
    for (const entry of readdirSync(npxCache)) bases.push(join(npxCache, entry, "node_modules"));
  }
  for (const base of bases) {
    try {
      return createRequire(join(base, "noop.js"))("playwright").chromium;
    } catch {
      // next
    }
  }
  throw new Error("playwright not found — run `npx playwright install chromium` or set PLAYWRIGHT_DIR.");
}

const chromium = resolveChromium();
const EXTENSION_PATH = resolve(__dirname, "..", "build", "chrome-mv3-prod");
const SHOT = process.env.E2E_SHOT ?? join(tmpdir(), "annotated-waveform.png");

// Report a real injectable tab id under a YouTube URL so the ClipComposer mounts
// and the recorder's executeScript targets a real page.
const TAB_SHIM = (tab) => {
  const install = () => {
    const c = window.chrome;
    if (!c || !c.tabs) return false;
    c.tabs.query = async () => [{ id: tab.id, url: tab.url, active: true }];
    const noop = { addListener() {}, removeListener() {} };
    c.tabs.onActivated = noop;
    c.tabs.onUpdated = noop;
    return true;
  };
  if (!install()) {
    const i = setInterval(() => install() && clearInterval(i), 10);
  }
};

async function recordOnce(page) {
  await page.getByRole("button", { name: /Record voice/i }).click();
  await page.getByRole("button", { name: /Stop/i }).waitFor({ timeout: 10000 });
  await new Promise((r) => setTimeout(r, 1200));
  await page.getByRole("button", { name: /Stop/i }).click();
}

async function main() {
  const userDataDir = await mkdtemp(join(tmpdir(), "annotated-waveform-e2e-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  });

  try {
    const sw =
      context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
    const extensionId = new URL(sw.url()).host;

    // Real injectable active tab for the recorder's executeScript.
    const tab = await context.newPage();
    await tab.goto("https://example.com/", { waitUntil: "domcontentloaded" });
    await tab.bringToFront();
    const tabId = await sw.evaluate(async () => {
      const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
      return t?.id ?? null;
    });
    assert.ok(tabId != null, "could not resolve a real active tab id");

    const panel = await context.newPage();
    await panel.addInitScript(TAB_SHIM, {
      id: tabId,
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
    await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`, {
      waitUntil: "domcontentloaded",
    });
    await panel.getByRole("button", { name: /Record voice/i }).waitFor({ timeout: 15000 });

    // Take 1
    await recordOnce(panel);
    await panel.getByText(/Take 1/).waitFor({ timeout: 15000 });
    const canvasCount = await panel.locator("canvas").count();
    assert.ok(canvasCount > 0, "waveform <canvas> not rendered after recording");
    await panel.screenshot({ path: SHOT, fullPage: true });

    // Take 2 — re-record bumps the counter
    await panel.getByRole("button", { name: /Re-record/i }).click();
    await recordOnce(panel);
    await panel.getByText(/Take 2/).waitFor({ timeout: 15000 });

    console.log(
      `PASS: waveform canvas rendered; take counter bumped Take 1 → Take 2. Screenshot: ${SHOT}`
    );
  } finally {
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
