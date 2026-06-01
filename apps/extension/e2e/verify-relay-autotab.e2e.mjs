// Verifies Fix 2: the Convex-token relay no longer requires a signed-in
// annotated.sh tab to be open. We drive the REAL background fetchConvexToken()
// (via its GET_CONVEX_TOKEN message) with chrome.tabs/scripting patched in the
// service worker so nothing actually navigates, and assert the new control flow:
// no existing tab found -> a *background* (active:false) tab is opened -> the
// token is minted in it -> the created tab is removed -> the token is returned.
//
// Run:
//   pnpm --filter extension build
//   node apps/extension/e2e/verify-relay-autotab.e2e.mjs

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
const CREATED_TAB_ID = 999001;

// Patches chrome in the SW so fetchConvexToken's branches run without touching
// the network or opening real tabs. Records what it was asked to do.
function installRelaySpies() {
  const calls = { queried: [], create: [], get: 0, exec: [], remove: [] };
  globalThis.__relayCalls = calls;
  chrome.tabs.query = async (q) => {
    calls.queried.push(q);
    return []; // no annotated.sh tab open -> forces the auto-open path
  };
  chrome.tabs.create = async (opts) => {
    calls.create.push(opts);
    return { id: 999001, status: "loading" };
  };
  chrome.tabs.get = async (id) => {
    calls.get++;
    return { id, status: "complete" };
  };
  chrome.tabs.remove = async (id) => {
    calls.remove.push(id);
  };
  chrome.scripting.executeScript = async (opts) => {
    calls.exec.push({ tabId: opts?.target?.tabId, world: opts?.world });
    return [{ result: "FAKE_TOKEN" }];
  };
  return {
    queryPatched: chrome.tabs.query !== undefined,
    createPatched: String(chrome.tabs.create).includes("calls.create"),
  };
}

async function main() {
  const userDataDir = await mkdtemp(join(tmpdir(), "annotated-relay-e2e-"));
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

    // Patch the SW BEFORE any page can trigger a token fetch, so nothing ever
    // opens a real annotated.sh tab.
    const patched = await sw.evaluate(installRelaySpies);
    assert.ok(patched.createPatched, "could not patch chrome.tabs.create in the SW");

    // Any extension page can message the SW. The panel is the one we ship.
    const panel = await context.newPage();
    await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`, {
      waitUntil: "domcontentloaded",
    });
    // Let any on-mount token fetch settle, then reset the ledger so we measure
    // only our explicit request.
    await panel.waitForTimeout(500);
    // Clear the ledger IN PLACE — the spy closures hold a reference to this same
    // object, so we must not replace it.
    await sw.evaluate(() => {
      const c = globalThis.__relayCalls;
      c.queried.length = 0;
      c.create.length = 0;
      c.get = 0;
      c.exec.length = 0;
      c.remove.length = 0;
    });

    const token = await panel.evaluate(
      () =>
        new Promise((resolve) =>
          chrome.runtime.sendMessage({ type: "GET_CONVEX_TOKEN" }, (r) => resolve(r))
        )
    );
    const calls = await sw.evaluate(() => globalThis.__relayCalls);

    assert.equal(token?.token, "FAKE_TOKEN", "relay did not return the minted token");
    assert.ok(calls.queried.length >= 1, "should query for existing tabs first");
    assert.equal(calls.create.length, 1, "should open exactly one background tab");
    assert.equal(
      calls.create[0].active,
      false,
      "the auto-opened relay tab must be a BACKGROUND tab (active:false)"
    );
    assert.ok(calls.exec.length >= 1, "should mint the token via executeScript");
    assert.equal(calls.exec[0].world, "MAIN", "token must be minted in the MAIN world");
    assert.ok(
      calls.remove.includes(CREATED_TAB_ID),
      "must close the tab it created after minting"
    );

    console.log(
      "PASS: no open tab -> background tab opened (active:false) -> token minted in MAIN world -> created tab removed -> token returned."
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
