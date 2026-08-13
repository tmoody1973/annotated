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

**Resolved, 2026-08-11 (Plan A Task 8).** The extension no longer holds a worker credential.
`PLASMO_PUBLIC_WORKER_TOKEN` and `PLASMO_PUBLIC_WORKER_URL` are gone from `.env`,
`.env.production` and `.env.example`. All seven former worker calls — `/clip-youtube`,
`/clip-audio`, `/transcribe`, `/transcribe-youtube`, `/extract-article`,
`/transcode-commentary`, `/youtube-chapters` — now run through auth-gated Convex actions that
hold `WORKER_AUTH_TOKEN` server-side.

Verified: the built bundle and all three packaged zips contain no worker token of either
generation, no `fly.dev` host, and no `startThreadDev`. See
`.superpowers/sdd/2026-08-11-extension-foundation/task-8-report.md`.

### Why it mattered more than "someone can burn Fly compute"

Kept here because the architecture that made this dangerous still exists.

`WORKER_AUTH_TOKEN` is a **single symmetric secret in three places**: Fly validates inbound
worker requests with it, the worker authenticates **to Convex** with it
(`apps/worker/src/index.ts`), and Convex validates writes against it (`convex/files.ts`,
`convex/transcripts.ts`). A leaked token therefore also granted `files:generateUploadUrl` —
write access to Convex storage.

That is also why rotation order matters: **Convex first, then Fly.** Setting Fly first leaves
the worker writing to Convex with a token Convex no longer accepts.

**And why the fix had to be structural.** `PLASMO_PUBLIC_*` vars inline at build time, so
rotating faster never helps — every rebuild re-leaks whatever token it was built with. The
only durable fix was removing the extension's need for a credential at all.

### Incident — 2026-08-11 (fixed same day)

The packaged zip was found to contain a **live** worker token in plaintext
(`chrome-mv3-prod/sidepanel.*.js`), verified by calling `POST /clip-youtube` with it: the
bundled token returned 400 (auth passed), a bogus token returned 401.

Rotated the same day on both the Convex deployment (`strong-eel-665`) and the Fly app
(`annotated-worker-rm`) — Convex first, because the worker authenticates to Convex with the
same value and setting Fly first would break writes. Verified afterwards: old token 401, new
token 400.

Rotation broke clipping for every already-distributed build, so the extension was rebuilt
from a gitignored `apps/extension/.env.production` carrying the real production values
(`pk_live_…`, `PLASMO_PUBLIC_CLERK_SYNC_HOST=https://annotated.sh`) rather than the dev
`.env`, which points Clerk at `http://localhost` and would have shipped an extension nobody
could sign in to.

That rebuild was a stopgap: it shipped the *new* token. Task 8 then removed the credential
from the extension entirely, so no further rotation is needed on the extension's account.

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
# The Clerk publishable key is NO LONGER bundled — Plan A moved auth to the
# web-tab relay and dropped the Clerk SDK (3.5MB -> 0.16MB), so nothing in the
# extension reads PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY. Zero pk_live_ hits is
# correct now; a pk_test_ hit still means you built from the dev .env.
unzip -p <zip> '*.js' | grep -c "pk_test_"          # must be 0
# Prove the production env was loaded by its endpoints instead:
unzip -p <zip> '*.js' | grep -c "strong-eel-665"    # must be >= 1
unzip -p <zip> '*.js' | grep -c "annotated.sh"      # must be >= 1
cd /tmp && rm -rf zipcheck && mkdir zipcheck && unzip -q <zip> -d zipcheck
grep -rl 'fly\.dev' zipcheck                                # must print nothing — no worker host
grep -rl 'startThreadDev' zipcheck                          # must print nothing — no token-guarded mutation
grep -rlE '[0-9a-f]{64}' zipcheck --exclude='Web3Solana*'   # must print nothing — no 64-hex secrets
```

---

## Recommendation

For the bounty deadline: **Route A.** Ship a hosted zip + the five-step "Load unpacked"
instructions. It's instant and fully in your control. But the real gating work is the
[Prerequisites](#0-prerequisites-do-this-before-either-route) — **deploy the worker and
repoint the env at prod**, or the judge installs a polished panel that can't actually cut a
clip. Do that first; the install method is the last 5 minutes.

---

## Store listing — paste-ready copy

Everything the Dev Console asks for, written out. Last checked against the
manifest on 2026-08-12 (v0.4.0).

**Summary** (132 char limit)

> Clip up to 90 seconds from any video, podcast or article, add your take, and get a shareable page that links back to the source.

**Description**

> Annotated turns anything you're watching, listening to or reading into a
> short, quotable clip with your commentary attached.
>
> Open the side panel on a YouTube video, a podcast episode page or an article.
> Choose your moment — drag a scrubber for video, drag across the transcript for
> a podcast, highlight the text for an article. Add your take, in writing or in
> your own voice. Publish, and you get a page you can paste anywhere, with the
> clip, your take, and a visible link back to where it came from.
>
> Clips are capped at 90 seconds and every one credits and links its source.
> Anyone who believes a clip oversteps can file a claim directly from its page.

**Privacy policy URL:** https://annotated.sh/privacy

**Data use disclosures** — tick these and use the wording:

| Data | Collected? | Why |
|---|---|---|
| Personally identifiable information | Yes — name, email | Sign-in, via Clerk. Used to attribute your clips to your profile. |
| Authentication information | Yes | A sign-in token, so the extension can publish as you. |
| Website content | Yes | The page you choose to clip: its address, title, and the text or media you select. Sent only when you act. |
| User activity | No | |
| Location, health, financial, personal communications | No | |

Also declare: audio is sent to **Deepgram** for transcription; clips, takes and
transcripts are stored in **Convex**; sign-in is handled by **Clerk**; claim
notifications are sent via **Resend**. All four are named on the privacy page.

Tick: not sold to third parties · not used for unrelated purposes · not used
for creditworthiness.

**Permission justifications** — one line each, all four are used:

- **sidePanel** — the whole interface is a side panel.
- **storage** — keeps a clip in progress while you switch tabs, so you don't lose your take.
- **activeTab** — reads which page you are on, so the panel can offer to clip it.
- **scripting** — reads the page you chose to clip: the player position, the transcript, the article text.
- **host_permissions `https://*/*`** — see the justification wording above. This
  is the one reviewers scrutinise; lead with "the user can clip from *any*
  site" and be explicit that it is page access only, never a backend route.

**`cookies` was removed in v0.4.0.** It was needed by the old Clerk syncHost
sign-in and nothing has called `chrome.cookies` since Plan A replaced that with
the web-tab relay. Do not add it back without a caller — an unused permission is
free review scrutiny.

**Screenshot:** 1280×800, generated from a real loaded panel rather than mocked.
Regenerate by screenshotting the panel at 380px wide and compositing; the last
one lives on Tarik's Desktop as `annotated-store-screenshot-1280x800.png`.

**Visibility:** Unlisted.
