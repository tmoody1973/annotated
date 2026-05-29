// Verifies the sidebar clip PROGRESS BAR renders during processing, in the real
// loaded extension (YouTube / ClipComposer path).
//
// Drives the composer to a publishable state (valid In/Out span + commentary +
// one topic), delays the worker /clip-youtube response so the "clipping" state
// persists, clicks Publish, and asserts the ProgressIndicator ("Processing
// clip…") is visible — i.e. the bar actually shows while a clip is processing.
//
// Run:
//   pnpm --filter extension build
//   node apps/extension/e2e/progress-bar.e2e.mjs

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
const SHOT_DIR = resolve(__dirname, "..", "..", "..", ".playwright-mcp");
const WATCH_URL = "https://www.youtube.com/watch?v=PkZNo7MFNFg";

const YOUTUBE_TAB_SHIM = (url) => {
  const install = () => {
    const c = window.chrome;
    if (!c || !c.tabs) return false;
    c.tabs.query = async () => [{ id: 1, url, active: true }];
    c.tabs.sendMessage = async () => ({});
    const noop = { addListener() {}, removeListener() {} };
    c.tabs.onActivated = noop;
    c.tabs.onUpdated = noop;
    return true;
  };
  if (!install()) {
    const i = setInterval(() => install() && clearInterval(i), 10);
  }
};

async function main() {
  const userDataDir = await mkdtemp(join(tmpdir(), "annotated-progress-e2e-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
    ],
  });

  try {
    const sw =
      context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
    const extensionId = new URL(sw.url()).host;

    const panel = await context.newPage();
    await panel.addInitScript(YOUTUBE_TAB_SHIM, WATCH_URL);

    // Delay the clip request so the "clipping" state (and the progress bar) stay
    // up long enough to assert, then fail it (we're not testing a real clip here).
    await panel.route("**/clip-youtube", async (route) => {
      await new Promise((r) => setTimeout(r, 5000));
      await route.abort("failed");
    });

    await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`, {
      waitUntil: "domcontentloaded",
    });

    // Composer mounted (topics loaded from the live backend).
    await panel.getByText(/Topics \(pick 1/i).waitFor({ timeout: 20000 });

    // Valid 30s span + commentary + one topic → Publish enables.
    const times = panel.locator('input[placeholder="0:00"]');
    await times.nth(0).fill("0:00");
    await times.nth(1).fill("0:30");
    await panel.getByLabel("Commentary text").fill("e2e progress-bar check");
    await panel.locator("button", { hasText: /^#/ }).first().click();

    const publishBtn = panel.getByRole("button", { name: /Publish clip/i });
    await publishBtn.waitFor({ timeout: 5000 });
    assert.ok(!(await publishBtn.isDisabled()), "Publish should be enabled with span+commentary+topic");
    console.log("PASS: Publish button enabled (span + commentary + topic)");

    await publishBtn.click();

    // The ProgressIndicator should appear with its "Processing clip…" label.
    await panel.getByText(/Processing clip…/i).waitFor({ timeout: 4000 });
    console.log("PASS: 'Processing clip…' progress label visible while clipping");

    // The bar fills against an elapsed counter — assert the elapsed text shows.
    await panel.getByText(/\d+s elapsed/i).waitFor({ timeout: 3000 });
    console.log("PASS: progress bar elapsed counter visible");

    await panel.screenshot({ path: join(SHOT_DIR, "progress-bar.png"), fullPage: true });

    console.log("\nALL ASSERTIONS PASSED — the clip progress bar renders during processing.");
  } finally {
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
