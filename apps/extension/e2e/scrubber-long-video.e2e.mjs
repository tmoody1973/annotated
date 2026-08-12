// The scrubber on a LONG video — the case that made it unusable.
//
// A 90-second clip inside an hour-long talk is ~2% of the video. Drawn against
// the whole timeline that is about eight pixels, with two handles covering it,
// so there was nothing to grab and one pixel meant eleven seconds. The track
// zooms to a window around the clip instead; this asserts the band ends up wide
// enough to actually grab, that the handles never cover it, and that dragging
// it moves the clip without resizing it.
//
// Run:
//   pnpm --filter extension build
//   node apps/extension/e2e/scrubber-long-video.e2e.mjs

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
// A real hour-plus talk — the shape of video that broke the whole-timeline track.
const LONG_VIDEO = "https://www.youtube.com/watch?v=Maw5t-POQ3w";

const PIN_TAB_SHIM = (tab) => {
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

const clock = (c) => c.split(":").reduce((a, p) => a * 60 + Number(p), 0);

async function main() {
  const userDataDir = await mkdtemp(join(tmpdir(), "annotated-longvid-e2e-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
    ],
  });

  try {
    const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
    const extensionId = new URL(sw.url()).host;

    const watch = await context.newPage();
    await watch.goto(LONG_VIDEO, { waitUntil: "domcontentloaded" });
    await watch.bringToFront();
    await watch.waitForTimeout(3000);
    const tabId = await sw.evaluate(async () => {
      const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
      return t?.id ?? null;
    });

    const panel = await context.newPage();
    await panel.setViewportSize({ width: 380, height: 640 });
    await panel.addInitScript(PIN_TAB_SHIM, { id: tabId, url: LONG_VIDEO });
    await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`, {
      waitUntil: "domcontentloaded",
    });

    await panel.getByRole("button", { name: /^Clip / }).click({ timeout: 30000 });
    const inField = panel.locator("input").first();
    const outField = panel.locator("input").nth(1);
    await outField.waitFor({ timeout: 15000 });

    // Put the clip deep into the video and stretch it to the full 90 seconds —
    // exactly the state that left nothing grabbable.
    await inField.fill("18:04");
    await inField.press("Enter");
    await outField.fill("19:34");
    await outField.press("Enter");
    await panel.waitForTimeout(400);
    assert.equal(clock(await outField.inputValue()) - clock(await inField.inputValue()), 90);
    console.log("  ok  90s clip placed at 18:04 in an hour-long video");

    const band = panel.locator('div[title="Drag to move the clip"]');
    const box = await band.boundingBox();
    assert.ok(box.width >= 60, `band is only ${Math.round(box.width)}px wide — not grabbable`);
    console.log(`  ok  band is ${Math.round(box.width)}px wide, not 8`);

    // The handles must sit outside the band, never on top of it.
    const startHandle = await panel.getByRole("slider", { name: "Clip start" }).boundingBox();
    const endHandle = await panel.getByRole("slider", { name: "Clip end" }).boundingBox();
    assert.ok(
      startHandle.x + startHandle.width <= box.x + 1,
      "the start handle overlaps the band",
    );
    assert.ok(endHandle.x >= box.x + box.width - 1, "the end handle overlaps the band");
    console.log("  ok  handles sit outside the band, covering none of it");

    // Grab the middle: the clip moves, its length does not change.
    const before = { in: clock(await inField.inputValue()), out: clock(await outField.inputValue()) };
    await panel.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await panel.mouse.down();
    await panel.mouse.move(box.x + box.width / 2 + 70, box.y + box.height / 2, { steps: 12 });
    await panel.mouse.up();
    const after = { in: clock(await inField.inputValue()), out: clock(await outField.inputValue()) };
    assert.ok(after.in > before.in, "dragging the band did not move the clip");
    assert.equal(after.out - after.in, before.out - before.in, "moving the clip changed its length");
    console.log(`  ok  band drag moved it ${after.in - before.in}s, still ${after.out - after.in}s long`);

    // The zoom is honest about itself.
    const zoomNote = await panel.getByText(/zoomed ·/).count();
    assert.equal(zoomNote, 1, "no indication the track is zoomed");
    console.log("  ok  the track says it is zoomed and gives the full duration");

    console.log("PASS: a 90s clip in an hour-long video is grabbable and movable.");
  } finally {
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
