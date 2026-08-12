# Chrome Web Store — Unlisted Submission Runbook (Annotated extension)

Goal: publish the extension **Unlisted** (one-click install via private link), then add a "Get the extension" link to annotated.sh.

**Upload package ready:** `annotated-extension-webstore.zip` (in this folder, repo root). Built from `apps/extension/build/chrome-mv3-prod` with the production Clerk config.

---

## ⚠️ Two gotchas specific to this setup (read first)

1. **The Web Store assigns a NEW extension ID** (different from the local `omjepfn…`). After you upload, the dashboard shows the published item's ID. **That `chrome-extension://<store-id>` must be added to Clerk `allowed_origins`**, or sign-in breaks for everyone who installs from the store (judges included) — exactly the error we just fixed. **Send me the store ID after upload and I'll add it to Clerk.**
2. **Bundled worker token (known debt):** the published JS contains `PLASMO_PUBLIC_WORKER_TOKEN`. Anyone who installs can extract it and call the worker's token-guarded endpoints. Acceptable for the bounty/judging (limited blast radius), but the real fix is routing worker calls through authenticated Convex actions so the token stays server-side. Flagging, not blocking.

**Optional pre-submission cleanup (recommended):** the manifest still lists `http://localhost/*` in `host_permissions` (a dev artifact). Reviewers scrutinize host permissions; removing it is cleaner. Say the word and I'll remove it, rebuild, and re-zip. Not required.

---

## Steps

### 1. Developer account
- Go to the **Chrome Web Store Developer Dashboard** (`chrome.google.com/webstore/devconsole`). Pay the **one-time $5** registration fee with a Google account.

### 2. Create the item + upload
- **Add new item** → upload `annotated-extension-webstore.zip`.

### 3. Store listing (copy below)
- **Name:** Annotated
- **Short description (≤132 chars):**
  > Clip and annotate media from any web page — YouTube, podcasts, and articles — then publish to a source-linked page.
- **Detailed description:**
  > Annotated turns any web page into a clip you can annotate and share. Grab a 90-second segment from a YouTube video or podcast, or highlight a passage from an article, add your take (typed or recorded), tag it with topics, and publish to a clean, source-linked page that surfaces in a public feed. Sign in with X or Google. Every clip points back to the original — built for fair-use commentary, not replacement.
- **Category:** Productivity (or News & Weather)
- **Language:** English
- **Screenshots:** 1280×800 (or 640×400), 1–5 images. Capture: the side panel on a YouTube video (clip composer + topics), a podcast transcript clip, an article highlight, and a published landing page on annotated.sh. *(I can help script these if you want.)*
- **Icon:** already in the package (128px).

### 4. Privacy
- **Single purpose:** "Clip and annotate media (YouTube, podcasts, articles) from the current web page and publish it to the user's Annotated account."
- **Permission justifications** (paste per-permission):
  - `sidePanel` — the entire UI is a side panel for clipping the current page.
  - `activeTab` / `scripting` — read the current tab's video playback time, page HTML, and a screenshot at the user's request to build the clip.
  - `storage` — store UI state and the auth token cache.
  - `cookies` + host access to `clerk.annotated.sh` — read the signed-in session from the Annotated web app (Clerk syncHost) so the user doesn't sign in twice.
  - `host_permissions: https://*/*` — the user can clip from **any** website they're viewing; the extension reads page content only on the active tab when the user acts.
- **Privacy policy URL:** required. Use `https://annotated.sh/privacy` — **I can add that page to the web app** (draft content below). Data disclosure to include: account info from Clerk (X/Google), the URLs/selections/screenshots the user chooses to clip, and commentary (text/audio) — sent to Annotated's backend (Convex), clip worker (Fly), and transcription (Deepgram). No selling of data; no tracking/ads.

### 5. Visibility + submit
- Set **Visibility: Unlisted**.
- **Submit for review.** New-item review is typically a few days; you have runway.

### 6. After approval
- Copy the public install link.
- **Give me the store extension ID** (gotcha #1) → I add it to Clerk `allowed_origins`.
- I add a **"Get the extension"** CTA on annotated.sh pointing at the link (I can scaffold it now with an env placeholder so it's ready to flip on).

---

## What I can do for you now (just say go)
- Add a **`/privacy` page** to the web app (so you have the required privacy-policy URL on annotated.sh).
- Scaffold the **"Get the extension" CTA** in the site header / landing (env-driven link, flip on when the store URL exists).
- Remove the `http://localhost/*` host permission + rebuild + re-zip (cleaner review).
- Help script the 4 listing **screenshots**.
