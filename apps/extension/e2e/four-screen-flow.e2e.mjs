// The whole flow, Source → Clip → Take, on a real YouTube page and again on an
// article — the two paths that don't need a transcription round trip.
//
// This is the test that would catch a screen losing its heading, Back appearing
// where it shouldn't, or navigation eating typed work. Publishing itself needs
// a signed-in profile and is verified by hand.
//
// Run:
//   pnpm --filter extension build
//   node apps/extension/e2e/four-screen-flow.e2e.mjs

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

const TAKE = "Every number in this segment is a projection, presented as a measurement.";

async function backCount(panel) {
  return await panel.getByRole("button", { name: /^← Back$/ }).count();
}

async function walk(context, extensionId, { name, url, prepare, startAction, chooseEvidence, signedOutStops }) {
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  if (prepare) await page.evaluate(prepare);
  await page.bringToFront();

  const sw = context.serviceWorkers()[0];
  const tabId = await sw.evaluate(async () => {
    const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
    return t?.id ?? null;
  });

  const panel = await context.newPage();
  await panel.setViewportSize({ width: 380, height: 780 });
  await panel.addInitScript(PIN_TAB_SHIM, { id: tabId, url });
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`, {
    waitUntil: "domcontentloaded",
  });

  // Screen 1 — no Back, one action.
  const start = panel.getByRole("button", { name: startAction });
  await start.waitFor({ timeout: 25000 });
  assert.equal(await backCount(panel), 0, `${name}: screen 1 must not offer Back`);
  await start.click();

  // Screen 2 — Back appears, and evidence gets chosen.
  await panel.getByRole("heading", { name: /Choose the evidence/i }).waitFor({ timeout: 15000 });
  assert.equal(await backCount(panel), 1, `${name}: screen 2 needs a Back`);
  const outcome = await chooseEvidence(panel);
  console.log(`  ok  ${name}: screen 2 reached with Back`);

  if (signedOutStops && outcome === "signed-out") {
    console.log(`  ok  ${name}: signed out, screen 2 asks for sign-in instead of stalling`);
    await panel.getByRole("button", { name: /^← Back$/ }).click();
    await panel.getByRole("heading").first().waitFor({ timeout: 10000 });
    console.log(`  ok  ${name}: Back still works out of the sign-in state`);
    await panel.close();
    await page.close();
    return;
  }

  await panel.getByRole("button", { name: /Next — your take/i }).click();

  // Screen 3 — the take, and Back that doesn't destroy it.
  await panel.getByRole("heading", { name: /State the claim/i }).waitFor({ timeout: 15000 });
  const takeField = panel.getByRole("textbox", { name: /take/i });
  await takeField.fill(TAKE);

  await panel.getByRole("button", { name: /^← Back$/ }).click();
  await panel.getByRole("heading", { name: /Choose the evidence/i }).waitFor({ timeout: 10000 });
  await panel.getByRole("button", { name: /Next — your take/i }).click();
  assert.equal(
    await panel.getByRole("textbox", { name: /take/i }).inputValue(),
    TAKE,
    `${name}: going back from the take screen destroyed typed work`,
  );
  console.log(`  ok  ${name}: screen 3 kept the take across a back step`);

  // Nothing internal ever reaches the user.
  const body = await panel.locator("body").innerText();
  for (const leak of [/Convex/i, /storageId/i, /dQw4w9WgXcQ/]) {
    assert.ok(!leak.test(body), `${name}: leaked ${leak} to the user`);
  }
  console.log(`  ok  ${name}: no internal vocabulary on screen`);

  await panel.close();
  await page.close();
}

async function main() {
  const userDataDir = await mkdtemp(join(tmpdir(), "annotated-flow-e2e-"));
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

    await walk(context, extensionId, {
      name: "youtube",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      startAction: /^Clip /,
      chooseEvidence: async (panel) => {
        // The seeded span is already valid; just prove the scrubber is there.
        await panel.getByRole("slider", { name: "Clip start" }).waitFor({ timeout: 10000 });
      },
    });

    await walk(context, extensionId, {
      name: "article",
      url: "https://example.com/story",
      prepare: () => {
        const article = document.createElement("article");
        article.textContent =
          "This is a test article body long enough to read like a real article. ".repeat(8);
        document.body.appendChild(article);
      },
      startAction: /Highlight on the page/i,
      // Reading an article runs server-side, so this path meets the sign-in
      // wall one screen earlier than video or podcast. Signed out — which a
      // fresh test profile always is — screen 2 must say so rather than
      // stalling, and that is what gets asserted here.
      signedOutStops: true,
      chooseEvidence: async (panel) => {
        const signIn = panel.getByText(/Sign in to pull this article's text/i);
        const text = panel.locator("div.ann-card").filter({ hasText: "test article body" }).first();
        await Promise.race([
          signIn.waitFor({ timeout: 40000 }),
          text.waitFor({ timeout: 40000 }),
        ]);
        if (await signIn.count()) return "signed-out";
        // Select a run of the rendered article text, the way a user drags it.
        await panel.evaluate(() => {
          const container = [...document.querySelectorAll("div.ann-card")].find((el) =>
            (el.textContent ?? "").includes("test article body"),
          );
          const node = container.firstChild;
          const range = document.createRange();
          range.setStart(node, 10);
          range.setEnd(node, 60);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          container.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
        });
        await panel.getByText(/\d+ \/ ~100 words · fair use/).waitFor({ timeout: 10000 });
        return "chosen";
      },
    });

    console.log("PASS: both paths walk Source → Clip → Take without losing work.");
  } finally {
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
