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
build time**. `apps/extension/.env`:

```
PLASMO_PUBLIC_CONVEX_URL=https://strong-eel-665.convex.cloud   # already prod (dev+prod share it) ✅
PLASMO_PUBLIC_WEB_URL=https://annotated-eight.vercel.app       # ⚠️ should be the live site
```

Before packaging a build for someone else, fix:

1. **`PLASMO_PUBLIC_WEB_URL`** → `https://annotated-eight.vercel.app`
   (so "View annotation" links open the live landing pages, not the judge's localhost).

There is no worker URL or token to configure. Every clip path (YouTube, podcast, article)
routes through a Convex action that holds the worker credential server-side — see
[Security](#security--the-bundled-token).

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

     **This permission is for content-script page access only — it is not, and has
     never been, how the extension reaches a backend.** The extension holds no
     backend host or credential at all (see [Security](#security--the-bundled-token)):
     every worker call runs server-side through Convex. `host_permissions` exists
     solely so `contents/*.ts` can read `document`/DOM state (transcript text,
     `<audio>`/`<video>` elements, RSS links, article markup) on whatever page the
     user is clipping from, per the SPEC's "any website" requirement.
5. Set **Visibility → Unlisted**.
6. **Submit for review.** When approved, share the item's install link with judges.

**The judge:** open the link → **Add to Chrome** → click the toolbar icon → side panel. Done.

**Pros:** one-click install, no Developer mode, auto-updates, looks legit.
**Cons:** review wait (unpredictable near a deadline); broad `https://*/*` permission can
trigger extra scrutiny (see the justification note above).

---

## Security — the bundled token

**Resolved, 2026-08-11 (Plan A Task 8).** The extension no longer holds a worker credential —
`PLASMO_PUBLIC_WORKER_TOKEN` and `PLASMO_PUBLIC_WORKER_URL` were deleted from `.env`,
`.env.production`, and `.env.example`. Every former worker call (`/clip-youtube`,
`/transcribe`, `/clip-audio`, `/extract-article`, transcode-commentary) now runs through a
Convex action/mutation, which holds `WORKER_AUTH_TOKEN` server-side. Verified: the built
bundle and both packaged zips (`build/chrome-mv3-prod.zip`, the `/extension` sideload zip)
contain no 64-hex secret and no `fly.dev` host — see the acceptance greps in
`docs/superpowers/sdd/2026-08-11-extension-foundation/task-8-report.md`.

### Incident — 2026-08-11 (fixed same day)

The packaged zip was found to contain a **live** worker token in plaintext
(`chrome-mv3-prod/sidepanel.*.js`), verified by calling `POST /clip-youtube` with it: the
bundled token returned 400 (auth passed), a bogus token returned 401.

Rotated the same day on both the Convex deployment (`strong-eel-665`) and the Fly app
(`annotated-worker-rm`) — Convex first, because the worker authenticates to Convex with the
same value and setting Fly first would break writes. Verified afterwards: old token 401, new
token 400. Rotation alone was a stopgap — every rebuild re-leaked whatever token it was built
with, until Task 8 removed the credential from the extension entirely.

## Building for distribution

`plasmo build` loads `.env.production` ahead of `.env`. Keep production values there — it is
gitignored — and never point a distributed build at the dev `.env`:

```bash
pnpm --filter extension build      # → build/chrome-mv3-prod/       (unpacked)
pnpm --filter extension package    # → build/chrome-mv3-prod.zip    (store upload)
```

The public sideload zip served at `/extension` is `apps/web/public/annotated-extension-chrome.zip`
and must unzip to a single `annotated-extension/` folder so "Load unpacked" works. Rebuild it
from the same `chrome-mv3-prod` output whenever the extension changes — it is a **tracked
file**, so a stale one ships silently.

Verify every package before distributing:

```bash
unzip -p <zip> '*.js' | grep -c "pk_live_"          # must be 1 — a pk_test_ key means you built from .env
cd /tmp && rm -rf zipcheck && mkdir zipcheck && unzip -q <zip> -d zipcheck
grep -rlE '[0-9a-f]{64}' zipcheck --exclude='Web3Solana*'   # must print nothing — no 64-hex secrets
grep -rl 'fly\.dev' zipcheck                                # must print nothing — no worker host
```

---

## Recommendation

For the bounty deadline: **Route A.** Ship a hosted zip + the five-step "Load unpacked"
instructions. It's instant and fully in your control. But the real gating work is the
[Prerequisites](#0-prerequisites-do-this-before-either-route) — **deploy the worker and
repoint the env at prod**, or the judge installs a polished panel that can't actually cut a
clip. Do that first; the install method is the last 5 minutes.		 
