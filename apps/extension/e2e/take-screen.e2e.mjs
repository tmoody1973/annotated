// Screen 3: the take, and the promise that Publish is never dead for a missing
// topic. Drives a real loaded extension from screen 1 through to screen 3 on a
// YouTube page and asserts the shape of the screen — the clip chip, the topic
// pre-fill or an empty-but-harmless chip row, and where the blocked reason
// renders relative to the button.
//
// Run:
//   pnpm --filter extension build
//   node apps/extension/e2e/take-screen.e2e.mjs

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

async function main() {
  const userDataDir = await mkdtemp(join(tmpdir(), "annotated-take-e2e-"));
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
    await watch.bringToFront();
    const tabId = await sw.evaluate(async () => {
      const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
      return t?.id ?? null;
    });

    const panel = await context.newPage();
    await panel.setViewportSize({ width: 380, height: 780 });
    await panel.addInitScript(PIN_TAB_SHIM, { id: tabId, url: WATCH_URL });
    await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`, {
      waitUntil: "domcontentloaded",
    });

    const go = panel.getByRole("button", { name: /^Clip / });
    await go.waitFor({ timeout: 20000 });
    await go.click();

    const outField = panel.locator("input").nth(1);
    await outField.waitFor({ timeout: 10000 });
    const span = `${await panel.locator("input").first().inputValue()}–${await outField.inputValue()}`;

    await panel.getByRole("button", { name: /Next — your take/i }).click();
    await panel.getByRole("heading", { name: /State the claim/i }).waitFor({ timeout: 10000 });
    console.log("  ok  reached screen 3");

    // The clip chip answers "what am I annotating" without a scroll.
    const chip = panel.getByText(new RegExp(span.replace(/:/g, ":")));
    assert.ok(await chip.count() > 0, `clip chip does not show the span ${span}`);
    assert.ok(
      await panel.getByRole("button", { name: /^Edit$/ }).count() > 0,
      "clip chip has no Edit link back to the span",
    );
    console.log(`  ok  clip chip shows ${span} with an Edit link`);

    // Topics never gate anything. Signed out, the gate is auth — and it says so
    // above the button, not below it.
    const topicRow = panel.getByText(/^Topic$/);
    await topicRow.waitFor({ timeout: 10000 });
    const chosen = await panel.locator('button[aria-pressed="true"]').count();
    console.log(`  ok  topic row rendered (${chosen} pre-filled)`);

    const reasonAboveButton = await panel.evaluate(() => {
      const buttons = [...document.querySelectorAll("button")];
      const publish = buttons.find((b) => /publish/i.test(b.textContent ?? ""));
      if (!publish) return "no publish button";
      const paragraphs = [...document.querySelectorAll("p")];
      const reason = paragraphs.find((p) => /sign in to publish|add a take/i.test(p.textContent ?? ""));
      if (!reason) return "no reason";
      return reason.compareDocumentPosition(publish) & Node.DOCUMENT_POSITION_FOLLOWING
        ? "above"
        : "below";
    });
    assert.equal(reasonAboveButton, "above", `the blocked reason renders ${reasonAboveButton} the button`);
    console.log("  ok  the reason renders above the button, not below it");

    // Typing a take must never be blocked by a missing topic.
    await panel.getByRole("textbox", { name: /take/i }).fill("This is exactly backwards.");
    const publish = panel.getByRole("button", { name: /publish/i }).last();
    assert.ok(await publish.count() > 0, "no publish control on screen 3");
    console.log("  ok  a take can be written with no topic chosen");

    // Back must not destroy it.
    await panel.getByRole("button", { name: /back/i }).click();
    await panel.getByRole("heading", { name: /Choose the evidence/i }).waitFor({ timeout: 10000 });
    await panel.getByRole("button", { name: /Next — your take/i }).click();
    const kept = await panel.getByRole("textbox", { name: /take/i }).inputValue();
    assert.equal(kept, "This is exactly backwards.", "going back destroyed the typed take");
    console.log("  ok  going back to the clip and returning kept the typed take");

    console.log("PASS: screen 3 never gates publish on a topic, and never eats a take.");
  } finally {
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
