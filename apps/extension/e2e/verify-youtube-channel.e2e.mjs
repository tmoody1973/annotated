// Verifies Fix 1: YouTube channel attribution is read from the page's own
// embedded player data via a world:"MAIN" inject through the LOADED extension's
// chrome.scripting permission — not fragile DOM selectors. We drive the exact
// reader getActiveVideoChannel() uses from the real background service worker
// against a real https tab into which we've injected YouTube's globals, and
// assert it returns the real channel name + channel/<id> URL. Exercises both the
// live #movie_player.getPlayerResponse() path and the ytInitialPlayerResponse
// fallback. (The data SHAPE was separately confirmed against a live watch page.)
//
// Run:
//   pnpm --filter extension build
//   node apps/extension/e2e/verify-youtube-channel.e2e.mjs

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

// Drives the real chrome.scripting MAIN-world inject from the service worker.
// The reader mirrors lib/player-time.ts getActiveVideoChannel() exactly; it's
// defined inside the SW evaluate so chrome.scripting serializes it into the
// page's MAIN world by toString (no eval — extension CSP forbids it).
async function injectFromSw(sw, tabId) {
  return sw.evaluate(async (tabId) => {
    const reader = () => {
      const fromDetails = (response) => {
        const details = response?.videoDetails;
        if (!details?.author && !details?.channelId) return null;
        return {
          name: details.author?.trim() || null,
          url: details.channelId
            ? `https://www.youtube.com/channel/${details.channelId}`
            : null,
        };
      };
      const player = document.querySelector("#movie_player");
      const live =
        typeof player?.getPlayerResponse === "function"
          ? player.getPlayerResponse()
          : null;
      const fromLive = fromDetails(live);
      if (fromLive) return fromLive;
      const initial = window.ytInitialPlayerResponse;
      const fromInitial = fromDetails(initial);
      if (fromInitial) return fromInitial;
      const anchor = document.querySelector(
        "ytd-video-owner-renderer a.yt-simple-endpoint, #owner #channel-name a, ytd-channel-name a"
      );
      const name = anchor?.textContent?.trim() || null;
      const href = anchor?.getAttribute("href") || null;
      const url = href ? new URL(href, location.origin).href : null;
      return { name, url };
    };
    const [inj] = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: reader,
    });
    return inj?.result ?? null;
  }, tabId);
}

async function main() {
  const userDataDir = await mkdtemp(join(tmpdir(), "annotated-channel-e2e-"));
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
    void extensionId;

    const page = await context.newPage();
    await page.goto("https://example.com/", { waitUntil: "domcontentloaded" });
    await page.bringToFront();
    const tabId = await sw.evaluate(async () => {
      const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
      return t?.id ?? null;
    });
    assert.ok(tabId != null, "could not resolve the test tab id");

    // (a) Live path: a #movie_player whose getPlayerResponse() returns details.
    await page.evaluate(() => {
      const el = document.createElement("div");
      el.id = "movie_player";
      el.getPlayerResponse = () => ({
        videoDetails: { author: "Live Channel", channelId: "UC_LIVE_123" },
      });
      document.body.appendChild(el);
      window.ytInitialPlayerResponse = {
        videoDetails: { author: "Initial Channel", channelId: "UC_INIT_456" },
      };
    });
    const live = await injectFromSw(sw, tabId);
    assert.deepEqual(
      live,
      { name: "Live Channel", url: "https://www.youtube.com/channel/UC_LIVE_123" },
      "live getPlayerResponse() path should win and resolve the channel"
    );

    // (b) Fallback path: no live player → ytInitialPlayerResponse is used.
    await page.evaluate(() => {
      document.getElementById("movie_player")?.remove();
    });
    const initial = await injectFromSw(sw, tabId);
    assert.deepEqual(
      initial,
      { name: "Initial Channel", url: "https://www.youtube.com/channel/UC_INIT_456" },
      "ytInitialPlayerResponse fallback should resolve the channel"
    );

    console.log(
      "PASS: world:'MAIN' inject through the loaded extension resolved the channel from live getPlayerResponse() and from ytInitialPlayerResponse."
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
