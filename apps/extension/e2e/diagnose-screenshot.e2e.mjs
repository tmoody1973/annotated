// Diagnostic: does chrome.tabs.captureVisibleTab work in the loaded extension
// with the current manifest permissions (host_permissions https://*/* + activeTab,
// NO user gesture)? §4 screenshots publish empty, and the capture is best-effort
// (silent catch), so we pinpoint whether the CAPTURE throws.
//
// Run: pnpm --filter extension build && node apps/extension/e2e/diagnose-screenshot.e2e.mjs

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
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
    for (const e of readdirSync(npxCache)) bases.push(join(npxCache, e, "node_modules"));
  }
  for (const base of bases) {
    try {
      return createRequire(join(base, "noop.js"))("playwright").chromium;
    } catch {
      /* next */
    }
  }
  throw new Error("playwright not found");
}

const chromium = resolveChromium();
const EXTENSION_PATH = resolve(__dirname, "..", "build", "chrome-mv3-prod");

async function main() {
  const userDataDir = await mkdtemp(join(tmpdir(), "annotated-shot-diag-"));
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

    // A real https tab — covered by host_permissions https://*/*.
    const tab = await context.newPage();
    await tab.goto("https://example.com/", { waitUntil: "domcontentloaded" });
    await tab.bringToFront();

    const result = await sw.evaluate(async () => {
      const out = {};
      // Which permissions does the extension actually have at runtime?
      try {
        const perms = await chrome.permissions.getAll();
        out.permissions = perms.permissions;
        out.origins = perms.origins;
      } catch (e) {
        out.permsError = String(e?.message ?? e);
      }
      // The actual call the screenshot code makes.
      try {
        const dataUrl = await chrome.tabs.captureVisibleTab(
          chrome.windows.WINDOW_ID_CURRENT,
          { format: "jpeg", quality: 80 }
        );
        out.capture = { ok: true, length: dataUrl?.length ?? 0, prefix: dataUrl?.slice(0, 24) };
      } catch (e) {
        out.capture = { ok: false, error: String(e?.message ?? e) };
      }
      return out;
    });

    console.log("DIAGNOSIS:", JSON.stringify(result, null, 2));
  } finally {
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("HARNESS FAIL:", err.message);
  process.exit(1);
});
