// Chapters, in a REAL loaded extension, on the four-screen panel.
//
// The feature was lost when the single-scroll composer was deleted; this is the
// test that says it is back. It asserts the three things that make it worth
// having: the list renders on the Clip screen, tapping a chapter sets the clip
// to that chapter capped at 90 seconds, and the take arrives on screen 3
// already titled with the chapter.
//
// The chapter lookup now runs through the Convex action `media:youtubeChapters`
// rather than a direct worker call, so the intercept sits on Convex's /api/action
// and only answers for that one function — every other action still goes through.
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
    for (const entry of readdirSync(npxCache)) {
      bases.push(join(npxCache, entry, "node_modules"));
    }
  }
  for (const base of bases) {
    try {
      return createRequire(join(base, "noop.js"))("playwright").chromium;
    } catch {
      /* try the next candidate */
    }
  }
  throw new Error("playwright not found — set PLAYWRIGHT_DIR to its node_modules");
}

const chromium = resolveChromium();
const EXTENSION_PATH = resolve(__dirname, "..", "build", "chrome-mv3-prod");
const SHOT_DIR = resolve(__dirname, "..", "..", "..", ".playwright-mcp");
const WATCH_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

/** Real yt-dlp shape, already parsed into the Chapter type the action returns. */
const CHAPTERS_FIXTURE = [
  { title: "Cold open", startMs: 0, endMs: 84_000 },
  // Deliberately 3m10s long, so the 90s cap has something to bite on.
  { title: "Running JavaScript", startMs: 84_000, endMs: 274_000 },
  { title: "Questions", startMs: 274_000, endMs: 402_000 },
];

// Deliberately no auth shim: chapters must work signed out, because clipping
// does and chapters are how you decide what to clip.
const PIN_TAB_SHIM = (tab) => {
  const install = () => {
    const c = window.chrome;
    if (!c || !c.tabs) return false;
    c.tabs.query = async () => [{ id: tab.id, url: tab.url, active: true }];
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

    const page = await context.newPage();
    await page.goto(WATCH_URL, { waitUntil: "domcontentloaded" });
    const tabId = await sw.evaluate(async () => {
      const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
      return t?.id ?? null;
    });

    const panel = await context.newPage();
    await panel.setViewportSize({ width: 380, height: 780 });
    await panel.addInitScript(PIN_TAB_SHIM, { id: tabId, url: WATCH_URL });

    // Answer only the chapters action; let every other Convex call through.
    await panel.route("**/api/action", async (route) => {
      const body = route.request().postData() ?? "";
      if (!body.includes("media:youtubeChapters")) return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "success", value: CHAPTERS_FIXTURE }),
      });
    });

    await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`, {
      waitUntil: "domcontentloaded",
    });

    // Screen 1 → 2.
    const start = panel.getByRole("button", { name: /^Clip / });
    await start.waitFor({ timeout: 25000 });
    await start.click();
    await panel
      .getByRole("heading", { name: /Choose the evidence/i })
      .waitFor({ timeout: 15000 });

    // Signed out — the "Sign in" affordance is still showing — and the list is
    // there anyway.
    await panel.getByText(/Sign in/i).first().waitFor({ timeout: 10000 });

    // The list is back.
    await panel.getByText(/Chapters · tap to set the clip/i).waitFor({ timeout: 15000 });
    const chapter = panel.getByRole("button", { name: /Running JavaScript/ });
    await chapter.waitFor({ timeout: 10000 });
    await panel.screenshot({ path: join(SHOT_DIR, "chapters-list.png"), fullPage: true });

    // Tapping sets the clip: start at the chapter, end capped at start + 90s.
    await chapter.click();
    const startSlider = panel.getByRole("slider", { name: "Clip start" });
    const endSlider = panel.getByRole("slider", { name: "Clip end" });
    await startSlider.waitFor({ timeout: 10000 });
    // The sliders report seconds (aria-valuenow), with mm:ss in aria-valuetext.
    const startSec = Number(await startSlider.getAttribute("aria-valuenow"));
    const endSec = Number(await endSlider.getAttribute("aria-valuenow"));
    await panel.screenshot({ path: join(SHOT_DIR, "chapters-tapped.png"), fullPage: true });

    assert.equal(startSec, 84, `clip should start at the chapter (1:24), got ${startSec}s`);
    assert.equal(
      endSec,
      174,
      `clip should end at start + 90s (2:54), not the chapter's own end, got ${endSec}s`
    );

    // The take arrives on screen 3 already titled, and is editable.
    await panel.getByRole("button", { name: /Next — your take/i }).click();
    await panel.getByRole("heading", { name: /State the claim/i }).waitFor({ timeout: 15000 });
    const takeField = panel.getByRole("textbox", { name: /take/i });
    const seeded = await takeField.inputValue();
    assert.ok(
      seeded.startsWith("Chapter: Running JavaScript"),
      `take should be seeded with the chapter title, got "${seeded}"`
    );
    await takeField.fill(`${seeded}he never answers the question.`);
    assert.ok(
      (await takeField.inputValue()).endsWith("he never answers the question."),
      "the seeded take must stay editable"
    );

    console.log(
      `PASS: chapters render; tap set ${startSec}s→${endSec}s (90s cap held); take seeded "${seeded}" and still editable.`
    );
  } finally {
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error("FAIL:", error.message);
  process.exit(1);
});
