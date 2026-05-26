// Verifies the on-demand detection fallback: when the content-script message
// fails (tab opened before the extension loaded), the hook injects the SAME
// detector via chrome.scripting.executeScript — so detection works with no
// reload. This is the real risk of sharing one function: the bundled detector
// must serialize + run in the page without referencing lost module scope.
//
// We force the fallback by shimming chrome.tabs.sendMessage to reject, point the
// panel at a real https tab into which we inject an <article>, and assert the
// ArticlePanel mounts ("📰 Article detected") — i.e. the executeScript path
// detected the article. (Also exercises detectPodcastPageInfo, which runs on the
// same tab and must serialize without error too.)
//
// Run:
//   pnpm --filter extension build
//   node apps/extension/e2e/verify-detection-fallback.e2e.mjs

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

// Force the executeScript fallback: report the real article tab id, and make
// the content-script message always reject so the hook falls through.
const FORCE_FALLBACK_SHIM = (tab) => {
  const install = () => {
    const c = window.chrome;
    if (!c || !c.tabs) return false;
    c.tabs.query = async () => [{ id: tab.id, url: tab.url, active: true }];
    c.tabs.sendMessage = () => Promise.reject(new Error("forced: no content script"));
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
  const userDataDir = await mkdtemp(join(tmpdir(), "annotated-fallback-e2e-"));
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

    // Real https tab (in host_permissions), made article-shaped by injecting an
    // <article> — so the executeScript detector has something to find.
    const articleTab = await context.newPage();
    await articleTab.goto("https://example.com/", { waitUntil: "domcontentloaded" });
    await articleTab.evaluate(() => {
      const article = document.createElement("article");
      article.textContent =
        "This is a test article body long enough to read like a real article. ".repeat(8);
      document.body.appendChild(article);
    });
    await articleTab.bringToFront();
    const tabId = await sw.evaluate(async () => {
      const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
      return t?.id ?? null;
    });
    assert.ok(tabId != null, "could not resolve the article tab id");

    const panel = await context.newPage();
    await panel.addInitScript(FORCE_FALLBACK_SHIM, { id: tabId, url: "https://example.com/" });
    await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`, {
      waitUntil: "domcontentloaded",
    });

    // If the executeScript fallback worked, the ArticlePanel mounts (this label
    // shows in every article-panel state). If it didn't, we'd see the empty
    // "Open a YouTube video, podcast, or article" state instead.
    await panel.getByText(/Article detected/i).waitFor({ timeout: 15000 });
    const detected = await panel.getByText(/Article detected/i).count();
    const emptyState = await panel.getByText(/Open a YouTube video/i).count();

    assert.ok(detected > 0, "article panel did not mount via the executeScript fallback");
    assert.equal(emptyState, 0, "still showing the empty state — fallback failed");

    console.log(
      "PASS: content-script message forced to fail → executeScript fallback detected the article (bundled detector serialized + ran)."
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
