// Verifies Fix 3: an in-progress clip survives a browser-tab switch. Switching
// tabs unmounts/remounts the composer, which used to drop the in/out points and
// the take. We mount the REAL ClipComposer (shimmed onto a YouTube watch tab),
// type in/out + a take, assert the draft lands in chrome.storage.session via the
// actual save path, then reload the panel (a remount) and assert the fields are
// restored from storage.
//
// Run:
//   pnpm --filter extension build
//   node apps/extension/e2e/verify-clip-draft.e2e.mjs

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
const VIDEO_ID = "dQw4w9WgXcQ";
const DRAFT_KEY = `clip-draft:${VIDEO_ID}`;

// Pin the panel to a YouTube watch tab so ClipComposer mounts. The active-tab
// listeners are no-ops; the real tab id lets the on-detect channel inject run
// (and harmlessly resolve nothing on a non-YouTube page).
const YT_TAB_SHIM = (tab) => {
  const install = () => {
    const c = window.chrome;
    if (!c || !c.tabs) return false;
    c.tabs.query = async () => [{ id: tab.id, url: tab.url, title: tab.title, active: true }];
    c.tabs.sendMessage = () => Promise.reject(new Error("no content script in test"));
    const noop = { addListener() {}, removeListener() {} };
    c.tabs.onActivated = noop;
    c.tabs.onUpdated = noop;
    return true;
  };
  if (!install()) {
    const i = setInterval(() => install() && clearInterval(i), 10);
  }
};

async function readDraft(sw, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const got = await sw.evaluate((k) => chrome.storage.session.get(k), DRAFT_KEY);
    if (got && got[DRAFT_KEY]) return got[DRAFT_KEY];
    await new Promise((r) => setTimeout(r, 150));
  }
  return null;
}

async function main() {
  const userDataDir = await mkdtemp(join(tmpdir(), "annotated-draft-e2e-"));
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

    // A real tab to give the channel inject a valid target (resolves to nulls).
    const realTab = await context.newPage();
    await realTab.goto("https://example.com/", { waitUntil: "domcontentloaded" });
    await realTab.bringToFront();
    const tabId = await sw.evaluate(async () => {
      const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
      return t?.id ?? null;
    });
    assert.ok(tabId != null, "could not resolve a real tab id");

    const shimArg = {
      id: tabId,
      url: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
      title: "Rick Astley - Never Gonna Give You Up",
    };

    const panel = await context.newPage();
    await panel.addInitScript(YT_TAB_SHIM, shimArg);
    await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`, {
      waitUntil: "domcontentloaded",
    });

    // ClipComposer mounted means the two time inputs are present.
    const timeInputs = panel.locator("input.ann-field");
    await timeInputs.first().waitFor({ timeout: 15000 });
    assert.equal(await timeInputs.count(), 2, "expected the In/Out time inputs");

    // Type an in-progress clip.
    await timeInputs.nth(0).fill("0:05");
    await timeInputs.nth(1).fill("0:20");
    await panel.getByLabel("Commentary text").fill("my take across tabs");

    // It should land in chrome.storage.session via the real save effect.
    const saved = await readDraft(sw);
    assert.ok(saved, "draft was never written to chrome.storage.session");
    assert.equal(saved.startInput, "0:05", "saved In point wrong");
    assert.equal(saved.endInput, "0:20", "saved Out point wrong");
    assert.equal(saved.commentary, "my take across tabs", "saved take wrong");

    // Reload the panel = the remount that used to wipe state. The shim re-runs.
    await panel.reload({ waitUntil: "domcontentloaded" });
    await panel.locator("input.ann-field").first().waitFor({ timeout: 15000 });

    await panel.waitForFunction(
      () => {
        const inputs = document.querySelectorAll("input.ann-field");
        return inputs[0]?.value === "0:05" && inputs[1]?.value === "0:20";
      },
      null,
      { timeout: 8000 }
    );
    const restoredTake = await panel.getByLabel("Commentary text").inputValue();
    assert.equal(restoredTake, "my take across tabs", "take was not restored on remount");

    console.log(
      "PASS: in-progress clip persisted to chrome.storage.session and was restored after a panel remount (in/out + take intact)."
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
