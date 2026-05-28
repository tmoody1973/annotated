// Verifies ISC-18/19/20/26 for the YouTube chapters feature in a REAL loaded
// extension: the sidepanel's ClipComposer fetches chapters, renders a tappable
// brutalist list, and a tap sets In/Out (90s-capped) + seeds editable commentary.
//
// The worker -> YouTube (yt-dlp) data path is verified separately (live yt-dlp
// returns the exact {start_time,end_time,title} shape; the route returns 401
// without auth). Here we intercept /youtube-chapters with a real-shaped fixture
// so the RENDER + interaction are tested deterministically, independent of
// YouTube rate-limiting.
//
// Run:
//   pnpm --filter extension build
//   node apps/extension/e2e/verify-chapters.e2e.mjs

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

// Real yt-dlp chapter shape (captured live from a freecodecamp JS course).
const CHAPTERS_FIXTURE = [
  { start_time: 0.0, end_time: 84.0, title: "Introduction" },
  { start_time: 84.0, end_time: 263.0, title: "Running JavaScript" },
  { start_time: 263.0, end_time: 356.0, title: "Comment Your Code" },
  { start_time: 356.0, end_time: 375.0, title: "Declare Variables" },
  { start_time: 375.0, end_time: 691.0, title: "Storing Values with the Assignment Operator" },
];

const WATCH_URL = "https://www.youtube.com/watch?v=PkZNo7MFNFg";

// Make the active tab look like a YouTube watch page so useActiveTabYoutubeId
// extracts the videoId and ClipComposer mounts.
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
  const userDataDir = await mkdtemp(join(tmpdir(), "annotated-chapters-e2e-"));
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
    // Intercept the worker call with a real-shaped fixture (deterministic render).
    await panel.route("**/youtube-chapters", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ chapters: CHAPTERS_FIXTURE }),
      })
    );

    await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`, {
      waitUntil: "domcontentloaded",
    });

    // ISC-18: chapter list renders.
    await panel.getByText("Running JavaScript").waitFor({ timeout: 15000 });
    await panel.getByText(/Chapters/i).first().waitFor({ timeout: 5000 });
    await panel.screenshot({ path: join(SHOT_DIR, "chapters-list.png"), fullPage: true });

    // ISC-19/20/26: tap a chapter -> In/Out set (90s cap) + commentary seeded.
    await panel.getByText("Running JavaScript").click();

    const fields = panel.locator(".ann-field");
    const inValue = await fields.nth(0).inputValue();
    const outValue = await fields.nth(1).inputValue();
    const commentary = await panel.locator(".ann-textarea").inputValue();

    await panel.screenshot({ path: join(SHOT_DIR, "chapters-tapped.png"), fullPage: true });

    assert.equal(inValue, "1:24", `In should be the chapter start 1:24, got "${inValue}"`);
    assert.equal(
      outValue,
      "2:54",
      `Out should be capped at start+90s (2:54), got "${outValue}"`
    );
    assert.ok(
      commentary.startsWith("Chapter: Running JavaScript"),
      `commentary should be seeded with the chapter title, got "${commentary}"`
    );

    console.log(
      `PASS: chapters rendered; tap set In=${inValue} Out=${outValue} (90s cap), commentary seeded "${commentary}". Screenshots in .playwright-mcp/.`
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
