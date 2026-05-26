# Getting the extension into a judge's browser

Two ways to put the Annotated Chrome extension in front of a judge. For a hackathon
deadline, **Route A (hosted zip + load-unpacked) is the right call** — no review wait,
you control the timing. Route B (Chrome Web Store *Unlisted*) is more polished but
reintroduces a review delay.

> **Read this first — the install method is the easy part.** A judge can install the
> extension in 60 seconds either way. What actually makes it *usable* is that the build
> points at live services. See [Prerequisites](#0-prerequisites-do-this-before-either-route).

---

## 0. Prerequisites (do this before either route)

The extension is built from `apps/extension` with `PLASMO_PUBLIC_*` env vars **baked in at
build time**. Today `apps/extension/.env` points at localhost:

```
PLASMO_PUBLIC_CONVEX_URL=https://strong-eel-665.convex.cloud   # already prod (dev+prod share it) ✅
PLASMO_PUBLIC_WORKER_URL=http://localhost:8080                  # ⚠️ judge's machine has nothing here
PLASMO_PUBLIC_WEB_URL=http://localhost:3000                    # ⚠️ should be the live site
PLASMO_PUBLIC_WORKER_TOKEN=<dev token>                          # ⚠️ bundled client-side (see Security)
```

Before packaging a build for someone else, fix these:

1. **`PLASMO_PUBLIC_WEB_URL`** → `https://annotated-eight.vercel.app`
   (so "View annotation" links open the live landing pages, not the judge's localhost).
2. **`PLASMO_PUBLIC_WORKER_URL`** → the deployed worker's HTTPS URL.
   **There is no deployed worker yet.** Until one exists, every clip path that touches the
   worker fails for the judge:
   - YouTube clip → worker `/clip-youtube`
   - Podcast → worker `/transcribe` + `/clip-audio`
   - Article → worker `/extract-article` (+ voice-commentary transcode)
   - (Article *screenshot* upload goes straight to Convex, so that part works without a worker.)

   → **Deploy the worker first** (Fly or similar), then set this URL. Also update
   `apps/extension/package.json` → `manifest.host_permissions`: replace
   `"http://localhost:8080/*"` with the worker's `https://…/*` origin, or the panel's
   cross-origin `fetch` to it will be blocked.
3. **`PLASMO_PUBLIC_WORKER_TOKEN`** — see [Security](#security--the-bundled-token) before
   any *public/unlisted* distribution.

Then build:

```bash
pnpm --filter extension build      # → apps/extension/build/chrome-mv3-prod/   (unpacked, for Route A)
pnpm --filter extension package    # → apps/extension/build/chrome-mv3-prod.zip (for Route B upload)
```

Sanity-check the build is current and typechecks:

```bash
pnpm --filter extension typecheck
```

---

## Route A — Hosted zip + "Load unpacked" (recommended for a deadline)

No store, no review, instant. The judge needs ~4 clicks and Developer mode on.

**You:**
1. `pnpm --filter extension build` (Prereqs done first).
2. Zip the **unpacked** folder so it unzips to a folder of files (not a nested zip):
   ```bash
   cd apps/extension/build && zip -r annotated-extension.zip chrome-mv3-prod
   ```
3. Host `annotated-extension.zip` somewhere with a stable link:
   - **GitHub Release** on `tmoody1973/annotated` (Releases → Draft → attach the zip) — clean and private-repo-friendly (release assets are downloadable even on a private repo if you share the asset link, or make just the release public).
   - or any file host / signed link.
4. Put the link + the steps below in your submission.

**The judge:**
1. Download and **unzip** `annotated-extension.zip` → a `chrome-mv3-prod` folder.
2. Open `chrome://extensions`.
3. Toggle **Developer mode** on (top-right).
4. Click **Load unpacked** → select the `chrome-mv3-prod` folder.
5. Pin "Annotated" and click it to open the side panel.

**Pros:** zero wait, you control timing, nothing public, easy to re-issue a fixed build.
**Cons:** judge must enable Developer mode; a scary-ish "Load unpacked" step; no auto-update.

---

## Route B — Chrome Web Store, **Unlisted** visibility

Goes through Google's review, but the listing is **not publicly searchable** — only people
with the link can install, one click, no Developer mode. More polished; reintroduces the
review wait (hours to a few days, and broad permissions slow it — see below).

**One-time setup:**
1. Register a Chrome Web Store **developer account** (~$5 one-time fee) at
   <https://chrome.google.com/webstore/devconsole>.

**Each submission:**
2. `pnpm --filter extension package` → `build/chrome-mv3-prod.zip`.
3. Dev Console → **New item** → upload the zip.
4. Fill the store listing (all required before submit):
   - Name, summary, description.
   - At least one screenshot (1280×800 or 640×400) — a sidepanel shot works.
   - An icon (128×128).
   - A **privacy policy URL** and data-use disclosures (you transcribe audio via Deepgram,
     store clips in Convex, auth via Clerk — declare it).
   - **Permission justifications.** The manifest requests `sidePanel`, `storage`,
     `activeTab`, `scripting`, and **`host_permissions: https://*/*`**. The broad
     all-hosts permission is the one reviewers scrutinize most — justify it plainly
     ("the user can clip media from *any* site, so the panel reads the active tab's
     page across all https sites"). Expect this to add review time.
5. Set **Visibility → Unlisted**.
6. **Submit for review.** When approved, share the item's install link with judges.

**The judge:** open the link → **Add to Chrome** → click the toolbar icon → side panel. Done.

**Pros:** one-click install, no Developer mode, auto-updates, looks legit.
**Cons:** review wait (unpredictable near a deadline); broad `https://*/*` permission can
trigger extra scrutiny; the bundled worker token is now publicly extractable (see below).

---

## Security — the bundled token

`PLASMO_PUBLIC_WORKER_TOKEN` is compiled **into the extension bundle** (all `PLASMO_PUBLIC_*`
vars are client-visible). It guards the dev publish mutations (`testing.*ClipDev`) and the
worker. Anyone who installs the extension can extract it from the bundle and call those
token-guarded endpoints directly.

- **Route A (privately-shared zip):** lower exposure — only people you send the link to.
- **Route B (Unlisted store):** the bundle is downloadable by anyone with the link, so treat
  the token as compromised-by-design. Before a store upload, rotate it to a throwaway value
  and be ready to rotate again after judging — or, better, replace the dev publish path with
  real Clerk auth + a server-side worker call (the deferred "production auth" debt) so no
  secret ships client-side.

---

## Recommendation

For the bounty deadline: **Route A.** Ship a hosted zip + the five-step "Load unpacked"
instructions. It's instant and fully in your control. But the real gating work is the
[Prerequisites](#0-prerequisites-do-this-before-either-route) — **deploy the worker and
repoint the env at prod**, or the judge installs a polished panel that can't actually cut a
clip. Do that first; the install method is the last 5 minutes.
