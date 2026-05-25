// Loaded-extension mic-capture E2E for Annotated.
//
// Verifies the "key runtime discovery": getUserMedia does NOT work from the MV3
// side panel, so the recorder (lib/use-voice-recorder.ts) captures the mic in
// the ACTIVE TAB via chrome.scripting.executeScript and returns the blob as
// base64. This drives that exact bridge from the extension service worker with
// a FAKE audio device, asserting a non-empty audio blob comes back.
//
// Why standalone (not @playwright/test): the repo has no Playwright dependency
// (prior E2E ran ad-hoc via npx). This resolves chromium from the npx cache so
// nothing is added to the repo. Loaded extensions require headed Chromium.
//
// Run:
//   pnpm --filter extension build           # refresh build/chrome-mv3-prod
//   node apps/extension/e2e/mic-record.e2e.mjs
//
// Requires: network access to the active-tab URL. It must match the manifest
// host_permissions (https://*/*), so the default is an https page — the app's
// own http://localhost:3000 is NOT injectable (only https://*/* + localhost:8080).

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import { tmpdir, homedir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Playwright isn't a repo dependency (prior E2E ran ad-hoc via npx). Resolve it
// from PLAYWRIGHT_DIR, the workspace, or any npx cache that has it — no
// machine-specific path hardcoded.
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
  throw new Error(
    "playwright not found — run `npx playwright install chromium`, or set PLAYWRIGHT_DIR to a node_modules dir that has playwright."
  );
}

const chromium = resolveChromium();
const EXTENSION_PATH = resolve(__dirname, "..", "build", "chrome-mv3-prod");
const ACTIVE_TAB_URL = process.env.E2E_ACTIVE_URL ?? "https://example.com/";
const RECORD_MS = 1200;

async function main() {
  const userDataDir = await mkdtemp(join(tmpdir(), "annotated-mic-e2e-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  });

  try {
    // A real, injectable http page is the "active tab" the recorder targets.
    const page = await context.newPage();
    await page.goto(ACTIVE_TAB_URL, { waitUntil: "domcontentloaded" });
    await page.bringToFront();

    // The MV3 background service worker holds chrome.scripting + chrome.tabs —
    // the same APIs the side-panel recorder uses. Drive the bridge from there.
    const sw =
      context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));

    // START: inject getUserMedia + MediaRecorder into the active tab.
    const started = await sw.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return { ok: false, reason: "no active tab" };
      const [inj] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () =>
          navigator.mediaDevices
            .getUserMedia({ audio: true })
            .then((stream) => {
              const rec = new MediaRecorder(stream);
              const chunks = [];
              rec.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
              };
              rec.start();
              window.__annotatedMic = { rec, chunks, stream };
              return { ok: true };
            })
            .catch((err) => ({ ok: false, reason: String(err) })),
      });
      return inj?.result ?? { ok: false, reason: "no injection result" };
    });
    assert.equal(started.ok, true, `mic start failed: ${started.reason ?? ""}`);

    await new Promise((r) => setTimeout(r, RECORD_MS));

    // STOP: stop the recorder, return the recorded blob as base64.
    const stopped = await sw.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const [inj] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () =>
          new Promise((resolve) => {
            const mic = window.__annotatedMic;
            if (!mic) return resolve(null);
            mic.rec.onstop = () => {
              const blob = new Blob(mic.chunks, {
                type: mic.rec.mimeType || "audio/webm",
              });
              mic.stream.getTracks().forEach((t) => t.stop());
              delete window.__annotatedMic;
              const reader = new FileReader();
              reader.onloadend = () => {
                const dataUrl = String(reader.result || "");
                resolve({
                  base64: dataUrl.slice(dataUrl.indexOf(",") + 1),
                  mimeType: blob.type,
                });
              };
              reader.readAsDataURL(blob);
            };
            if (mic.rec.state !== "inactive") mic.rec.stop();
            else resolve(null);
          }),
      });
      return inj?.result ?? null;
    });

    assert.ok(stopped, "stop returned no blob");
    assert.ok(stopped.base64.length > 0, "recorded base64 is empty");
    assert.match(stopped.mimeType, /^audio\//, `unexpected mimeType: ${stopped.mimeType}`);

    console.log(
      `PASS: recorded ${stopped.base64.length} base64 chars (${stopped.mimeType}) via active-tab executeScript with fake mic.`
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
