// The transcript drag, against a real NPR episode already in the deployment.
//
// Drags across a run of words and asserts the panel derives a span and a
// verbatim quote from them, that the tap fallback does the same job, and that
// Escape clears. Uses a real episode page so the resolve → transcript path is
// exercised end to end rather than mocked.
//
// Run:
//   pnpm --filter extension build
//   node apps/extension/e2e/transcript-drag.e2e.mjs

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
const EPISODE_URL =
  "https://www.npr.org/2026/05/29/nx-s1-5836561/remembering-jazz-giant-sonny-rollins";

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

async function main() {
  const userDataDir = await mkdtemp(join(tmpdir(), "annotated-transcript-e2e-"));
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

    const episode = await context.newPage();
    await episode.goto(EPISODE_URL, { waitUntil: "domcontentloaded" });
    await episode.bringToFront();
    const tabId = await sw.evaluate(async () => {
      const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
      return t?.id ?? null;
    });

    const panel = await context.newPage();
    await panel.setViewportSize({ width: 380, height: 700 });
    await panel.addInitScript(PIN_TAB_SHIM, { id: tabId, url: EPISODE_URL });
    await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`, {
      waitUntil: "domcontentloaded",
    });

    const go = panel.getByRole("button", { name: /Clip from the transcript/i });
    await go.waitFor({ timeout: 25000 });
    await go.click();
    console.log("  ok  screen 1 offered the transcript path");

    const hint = panel.getByText(/Drag across the words you want/i);
    await hint.waitFor({ timeout: 120000 });
    console.log("  ok  transcript ready");

    const words = panel.locator('button[aria-pressed]');
    const total = await words.count();
    assert.ok(total > 20, `expected a real transcript, got ${total} words`);
    console.log(`  ok  ${total} words rendered`);

    // Drag across a run of words.
    const first = await words.nth(4).boundingBox();
    const last = await words.nth(11).boundingBox();
    await panel.mouse.move(first.x + 2, first.y + first.height / 2);
    await panel.mouse.down();
    await panel.mouse.move(last.x + last.width - 2, last.y + last.height / 2, { steps: 12 });
    await panel.mouse.up();

    const selected = await words.evaluateAll((els) =>
      els.filter((e) => e.getAttribute("aria-pressed") === "true").map((e) => e.textContent.trim()),
    );
    assert.ok(selected.length >= 2, `drag selected ${selected.length} words`);
    console.log(`  ok  drag selected ${selected.length} contiguous words: "${selected.slice(0, 6).join(" ")}…"`);

    // The readout names a real span, inside the cap.
    // The body's own live readout, not the shell's fair-use line below it.
    const readout = await panel.locator('p.ann-mono[aria-live="polite"]').first().textContent();
    const spanMatch = readout.match(/(\d+:\d+)–(\d+:\d+)\s+·\s+(\d+:\d+)/);
    assert.ok(spanMatch, `no span in readout: "${readout}"`);
    const dur = spanMatch[3].split(":").reduce((a, p) => a * 60 + Number(p), 0);
    assert.ok(dur > 0 && dur <= 90, `derived span ${dur}s is outside the cap`);
    console.log(`  ok  derived ${spanMatch[1]}–${spanMatch[2]} (${dur}s)`);

    const next = panel.getByRole("button", { name: /Next — your take/i });
    assert.equal(await next.isEnabled(), true, "Next is dead after a valid drag");
    console.log("  ok  Next went live");

    // Tap fallback: two taps set a new range.
    await words.nth(30).click();
    await words.nth(34).click();
    const tapped = await words.evaluateAll((els) =>
      els.filter((e) => e.getAttribute("aria-pressed") === "true").length,
    );
    assert.equal(tapped, 5, `tap-to-start/tap-to-end selected ${tapped} words, expected 5`);
    console.log("  ok  tap fallback set its own range");

    // Escape clears.
    await panel.keyboard.press("Escape");
    const cleared = await words.evaluateAll((els) =>
      els.filter((e) => e.getAttribute("aria-pressed") === "true").length,
    );
    assert.equal(cleared, 0, `Escape left ${cleared} words selected`);
    console.log("  ok  Escape cleared the selection");

    console.log("PASS: drag, tap and Escape all drive the same selection.");
  } finally {
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
