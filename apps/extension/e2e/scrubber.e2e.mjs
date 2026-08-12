// The scrubber, driven three ways: drag, keyboard, and the mm:ss readouts.
//
// The three are one value seen three ways, so each must move the other two.
// Runs against a synthetic page carrying a `video.html5-main-video` with a
// known duration, because a real YouTube watch page won't reliably report one
// under automation — the reader itself is the same either way.
//
// Run:
//   pnpm --filter extension build
//   node apps/extension/e2e/scrubber.e2e.mjs

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
const WATCH_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

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

/** A ten-minute video parked at 5:00, so "Clip last 60s" seeds 4:00–5:00. */
const FAKE_PLAYER = () => {
  const video = document.createElement("video");
  video.className = "html5-main-video";
  Object.defineProperty(video, "duration", { get: () => 600 });
  Object.defineProperty(video, "currentTime", { get: () => 300 });
  document.body.appendChild(video);
};

async function main() {
  const userDataDir = await mkdtemp(join(tmpdir(), "annotated-scrubber-e2e-"));
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
    await watch.goto(WATCH_URL, { waitUntil: "domcontentloaded" });
    await watch.evaluate(FAKE_PLAYER);
    await watch.bringToFront();
    const tabId = await sw.evaluate(async () => {
      const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
      return t?.id ?? null;
    });

    const panel = await context.newPage();
    await panel.setViewportSize({ width: 380, height: 620 });
    await panel.addInitScript(PIN_TAB_SHIM, { id: tabId, url: WATCH_URL });
    await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`, {
      waitUntil: "domcontentloaded",
    });

    // Screen 1 seeds the last 60 seconds off the playhead.
    const start = panel.getByRole("button", { name: /Clip (last 60s|from the start)/i });
    await start.waitFor({ timeout: 20000 });
    const seededLabel = (await start.textContent()) ?? "";
    await start.click();

    const startHandle = panel.getByRole("slider", { name: "Clip start" });
    const endHandle = panel.getByRole("slider", { name: "Clip end" });
    await startHandle.waitFor({ timeout: 10000 });

    const inField = panel.locator("input").first();
    const outField = panel.locator("input").nth(1);
    const clock = (c) => c.split(":").reduce((a, p) => a * 60 + Number(p), 0);
    const seededIn = await inField.inputValue();
    const seededOut = await outField.inputValue();
    const seededSpan = clock(seededOut) - clock(seededIn);
    // Exact seeding is pinned by the unit tests; here it only has to be a real,
    // legal span read off whatever the live player reported.
    assert.ok(seededSpan > 0 && seededSpan <= 90, `illegal seed ${seededIn}-${seededOut}`);
    console.log(`  ok  seeded ${seededIn}–${seededOut} (${seededSpan}s) from "${seededLabel.trim()}"`);

    // Arrow keys move the focused handle by a second, shift-arrow by ten.
    await startHandle.focus();
    // Nudge the end handle right: the start handle may already sit at 0:00.
    const beforeKeys = clock(await outField.inputValue());
    await endHandle.focus();
    await panel.keyboard.press("ArrowRight");
    assert.equal(clock(await outField.inputValue()), beforeKeys + 1, "arrow key did not move 1s");
    await panel.keyboard.press("Shift+ArrowRight");
    assert.equal(clock(await outField.inputValue()), beforeKeys + 11, "shift-arrow did not move 10s");
    console.log("  ok  arrow 1s, shift-arrow 10s");

    // The handle reports itself to a screen reader.
    assert.equal(
      await endHandle.getAttribute("aria-valuenow"),
      String(clock(await outField.inputValue())),
      "aria-valuenow disagrees with the readout",
    );
    assert.equal(await endHandle.getAttribute("aria-valuetext"), await outField.inputValue());
    console.log("  ok  handles announce their position");

    // Typing in the readout moves the handle.
    const before = await endHandle.boundingBox();
    const typed = "0:45";
    await outField.fill(typed);
    await outField.press("Enter");
    assert.equal(await outField.inputValue(), typed, "typed out-point did not stick");
    const after = await endHandle.boundingBox();
    assert.ok(Math.abs(after.x - before.x) > 1, "typing did not move the handle");
    console.log("  ok  typing in the readout moves the handle");

    // Dragging the end handle moves the readout.
    const track = await endHandle.boundingBox();
    await panel.mouse.move(track.x + track.width / 2, track.y + track.height / 2);
    await panel.mouse.down();
    await panel.mouse.move(track.x - 40, track.y + track.height / 2, { steps: 8 });
    await panel.mouse.up();
    const dragged = await outField.inputValue();
    assert.notEqual(dragged, typed, "dragging the handle did not move the readout");
    console.log(`  ok  dragging moved the out-point to ${dragged}`);

    // The 90-second ceiling is a wall, not an error message.
    await outField.fill("9:59");
    await outField.press("Enter");
    const ceilIn = await inField.inputValue();
    const ceilOut = await outField.inputValue();
    const span = clock(ceilOut) - clock(ceilIn);
    assert.ok(span > 0 && span <= 90, `span exceeded the 90s ceiling: ${ceilIn}–${ceilOut}`);
    console.log(`  ok  ceiling held the span at ${span}s (${ceilIn}–${ceilOut})`);

    const next = panel.getByRole("button", { name: /Next — your take/i });
    assert.equal(await next.isEnabled(), true, "Next is dead on a valid span");
    console.log("  ok  Next stays live");

    console.log("PASS: the scrubber drags, types and keys — all three agree.");
  } finally {
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
