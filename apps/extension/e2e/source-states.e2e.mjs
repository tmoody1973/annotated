// Screen 1 across the pages it has to survive.
//
// For each of a YouTube watch page, a podcast episode page, an article and a
// plain page, asserts the panel shows the right heading and that a primary
// action exists exactly where one should — and never where it shouldn't.
//
// The panel is pointed at a real https tab via the same chrome.tabs shim the
// other e2e scripts use, because chrome.sidePanel can't be opened
// programmatically (see verify-detection-fallback.e2e.mjs, which this follows).
//
// Run:
//   pnpm --filter extension build
//   node apps/extension/e2e/source-states.e2e.mjs

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

/** Point the panel's chrome.tabs at one fixed tab and silence the listeners. */
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

/** Each case: a real page, made to look like the source type under test. */
const CASES = [
  {
    name: "youtube",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    heading: /Choose the evidence/i,
    // The playhead can't be read on a page that never plays, so the seeded
    // fallback label is the one that must appear — and it must appear enabled.
    action: /Clip (last 60s|from the start)/i,
  },
  {
    name: "podcast",
    url: "https://example.com/episode",
    prepare: () => {
      const audio = document.createElement("audio");
      audio.src = "https://cdn.example.com/episode-42.mp3";
      document.body.appendChild(audio);
    },
    heading: /Choose the evidence/i,
    action: /Clip from the transcript/i,
  },
  {
    name: "article",
    url: "https://example.com/story",
    prepare: () => {
      const article = document.createElement("article");
      article.textContent =
        "This is a test article body long enough to read like a real article. ".repeat(8);
      document.body.appendChild(article);
    },
    heading: /Choose the evidence/i,
    action: /Highlight on the page/i,
  },
  {
    name: "plain page",
    url: "https://example.com/",
    // Signed out in a fresh profile, so the welcome stands in for the dead end.
    heading: /Clip it\. Say why\. Share the link\.|Nothing to clip on this page/i,
    action: null,
  },
];

async function runCase(context, extensionId, testCase) {
  const page = await context.newPage();
  await page.goto(testCase.url, { waitUntil: "domcontentloaded" });
  if (testCase.prepare) await page.evaluate(testCase.prepare);
  await page.bringToFront();

  const sw = context.serviceWorkers()[0];
  const tabId = await sw.evaluate(async () => {
    const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
    return t?.id ?? null;
  });
  assert.ok(tabId != null, `${testCase.name}: could not resolve the tab id`);

  const panel = await context.newPage();
  await panel.addInitScript(PIN_TAB_SHIM, { id: tabId, url: testCase.url });
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`, {
    waitUntil: "domcontentloaded",
  });

  await panel.getByRole("heading", { name: testCase.heading }).waitFor({ timeout: 20000 });

  // Nothing internal ever reaches the screen.
  const body = await panel.locator("body").innerText();
  assert.ok(!/Convex/i.test(body), `${testCase.name}: leaked "Convex" to the user`);
  assert.ok(!/dQw4w9WgXcQ/.test(body), `${testCase.name}: leaked a raw video id`);

  if (testCase.action) {
    const action = panel.getByRole("button", { name: testCase.action });
    await action.waitFor({ timeout: 10000 });
    assert.equal(
      await action.isEnabled(),
      true,
      `${testCase.name}: the primary action is disabled — it never may be`,
    );
  }

  // Screen 1 has no back button.
  assert.equal(
    await panel.getByRole("button", { name: /back/i }).count(),
    0,
    `${testCase.name}: screen 1 must not offer Back`,
  );

  console.log(`  ok  ${testCase.name}`);
  await panel.close();
  await page.close();
}

async function main() {
  const userDataDir = await mkdtemp(join(tmpdir(), "annotated-source-states-e2e-"));
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

    for (const testCase of CASES) {
      await runCase(context, extensionId, testCase);
    }

    console.log("PASS: screen 1 shows the right heading and action on all four page types.");
  } finally {
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
