// Loaded-extension visual + DOM check for the calm restyle + §9 anonymous toggle.
//
// Opens the real sidepanel page (chrome.sidePanel can't be driven by Playwright),
// shims chrome.tabs.query to present a YouTube watch tab so the ClipComposer
// renders, then asserts the calm UI + "Post anonymously" toggle are present and
// screenshots the panel for a human/visual check.
//
// Run:
//   pnpm --filter extension build
//   node apps/extension/e2e/verify-calm-ui.e2e.mjs
//   # screenshot written to $E2E_SHOT or /tmp/annotated-calm-ui.png

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
      // try the next base
    }
  }
  throw new Error("playwright not found — run `npx playwright install chromium` or set PLAYWRIGHT_DIR.");
}

const chromium = resolveChromium();
const EXTENSION_PATH = resolve(__dirname, "..", "build", "chrome-mv3-prod");
const SHOT = process.env.E2E_SHOT ?? join(tmpdir(), "annotated-calm-ui.png");

// Present a YouTube watch tab to the panel so the ClipComposer renders. The panel
// reads only the active tab's URL (use-active-tab-youtube.ts); listeners are no-ops.
const TAB_SHIM = () => {
  const install = () => {
    const c = window.chrome;
    if (!c || !c.tabs) return false;
    const fakeTab = { id: 1, url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", active: true };
    c.tabs.query = async () => [fakeTab];
    const noop = { addListener() {}, removeListener() {} };
    c.tabs.onActivated = noop;
    c.tabs.onUpdated = noop;
    return true;
  };
  if (!install()) {
    const id = setInterval(() => install() && clearInterval(id), 10);
  }
};

async function main() {
  const userDataDir = await mkdtemp(join(tmpdir(), "annotated-calm-e2e-"));
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
    await page.addInitScript(TAB_SHIM);
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`, {
      waitUntil: "domcontentloaded",
    });

    // The §9 toggle only exists inside a rendered composer → proves the YouTube
    // ClipComposer mounted with the shimmed tab.
    await page.getByText("Post anonymously").waitFor({ timeout: 15000 });

    const anonymous = await page.getByText("Post anonymously").count();
    const fairUse = await page.getByText(/fair use/i).count();
    const publish = await page.getByRole("button", { name: /Publish clip/i }).count();

    assert.ok(anonymous > 0, "§9 anonymous toggle not found");
    assert.ok(fairUse > 0, "§8 fair-use label not found");
    assert.ok(publish > 0, "publish button not found");

    await page.setViewportSize({ width: 420, height: 900 });
    await page.screenshot({ path: SHOT, fullPage: true });

    console.log(
      `PASS: calm ClipComposer rendered — anonymous toggle:${anonymous}, fair-use label:${fairUse}, publish:${publish}. Screenshot: ${SHOT}`
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
