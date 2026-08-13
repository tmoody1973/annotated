# Publishing Annotated to the Chrome Web Store

A click-by-click guide. Everything you need to paste is in here — you shouldn't
have to look anything up or make anything up.

**Time:** about 30 minutes of your attention, then a review wait you can't
control (usually hours, sometimes a few days).

**Version being published:** 0.4.0

---

## Before you start

Two files are already on your Desktop. Check they're there:

- [ ] `~/Desktop/annotated-STORE-UPLOAD-0.4.0.zip` — the package you upload
- [ ] `~/Desktop/annotated-store-screenshot-1280x800.png` — the store screenshot

If either is missing, regenerate the zip with:

```bash
cd ~/Documents/Projects/annotated/apps/extension
pnpm build && pnpm package:store
cp build/chrome-mv3-store.zip ~/Desktop/annotated-STORE-UPLOAD-0.4.0.zip
```

> ⚠️ **`package:store`, not `package`.** There are two zips and they are not
> interchangeable. The store one has the `key` field stripped out; upload the
> other and Google refuses it with *"key field is not allowed in manifest."*
>
> The reason: `key` pins a fixed extension id, which the sideload build needs
> (that id is registered in Clerk) and which the store forbids, because Google
> assigns the id itself.

> **Don't unzip the file you upload.** The store wants the zip exactly as it is.

---

## Step 1 — Developer account (one time, ~$5)

1. [ ] Go to **<https://chrome.google.com/webstore/devconsole>**
2. [ ] Sign in with the Google account you want to own this listing
   — this is permanent and awkward to move later, so use the one you'll keep
3. [ ] Pay the one-time **$5** registration fee if you haven't before
4. [ ] Fill in the publisher contact email and **verify it** — Google won't let
   you submit until that email is verified, and it's easy to miss

---

## Step 2 — Upload the package

1. [ ] Click **Add new item**
2. [ ] Drag in `~/Desktop/annotated-extension-0.4.0.zip`
3. [ ] Wait for it to process — it lands you on the listing form

If it rejects the upload, jump to [Troubleshooting](#troubleshooting).

---

## Step 3 — Store listing tab

**Name**

```
Annotated
```

**Summary** (128 characters, fits the 132 limit)

```
Clip up to 90 seconds from any video, podcast or article, add your take, and get a shareable page that links back to the source.
```

**Description**

```
Annotated turns anything you're watching, listening to or reading into a short, quotable clip with your commentary attached.

Open the side panel on a YouTube video, a podcast episode page or an article. Choose your moment — drag a scrubber for video, drag across the transcript for a podcast, highlight the text for an article. Add your take, in writing or in your own voice. Publish, and you get a page you can paste anywhere, with the clip, your take, and a visible link back to where it came from.

Clips are capped at 90 seconds and every one credits and links its source. Anyone who believes a clip oversteps can file a claim directly from its page.
```

**Category**

- [ ] Choose **Productivity** (Communication is the reasonable alternative — pick one and don't agonise)

**Language**

- [ ] English

**Screenshots** — all four are in `~/Desktop/annotated-store-assets/`
(and kept in the repo at `docs/store-assets/`):

- [ ] `screenshot-1-scrubber.png` — the scrubber
- [ ] `screenshot-2-transcript.png` — clipping a podcast from the transcript
- [ ] `screenshot-3-take.png` — writing the take
- [ ] `screenshot-4-page.png` — the published page

Upload them in that order; it reads as the actual sequence of using the thing.
One is enough to submit — the other three are for the person who clicks your
link, not the reviewer.

**Promo tiles — optional, and skippable here**

The console asks for a **small promo tile (440×280)** and a **marquee promo tile
(1400×560)**. Both are optional. They exist so the store can feature you in
browsing and category pages — which an **Unlisted** item never appears in. So
for this submission they change nothing a judge will see.

They're made anyway, in the same folder, if you'd rather the listing look
finished:

- [ ] `promo-small-440x280.png`
- [ ] `promo-marquee-1400x560.png`

All six are 24-bit PNG with no alpha channel, which is what the console
requires — a normal screenshot usually has alpha and gets rejected.

**Store icon**

- [ ] 128×128 — the console pulls this from the package. If it asks for one
  separately, export `apps/extension/assets/icon.png` at 128×128.

---

## Step 4 — Privacy tab

This is the part that decides how long review takes. Be complete and be honest;
vagueness is what gets things bounced.

**Single purpose description**

```
Annotated lets a user clip a short excerpt from the video, podcast or article they are currently viewing, add their own commentary, and publish it to a shareable page that links back to the original source.
```

**Permission justifications** — paste one per permission. All four are used;
there are no spare permissions in this build.

| Permission | Paste this |
|---|---|
| `sidePanel` | The entire user interface is a browser side panel. |
| `storage` | Saves a clip you are part-way through so switching tabs doesn't lose your selection or your written take. |
| `activeTab` | Detects what kind of page you are on — video, podcast or article — so the panel can offer to clip it. |
| `scripting` | Reads the page you chose to clip: the player's position for video, the transcript for a podcast, the article text for a page. |

**Host permission justification** (`https://*/*`) — the one reviewers look at
hardest. Paste this whole thing:

```
The extension lets the user clip media from any website, so it must be able to read the page the user is currently on regardless of domain. This permission is used solely for content-script page access: reading the video player's current position, an episode's audio element or RSS link, and an article's text, on whatever page the user has chosen to clip.

It is not used to reach any backend. The extension contains no server address and no credential; all server-side work runs through authenticated Convex functions. Nothing is read from any page until the user opens the panel and asks to clip that page.
```

**Are you using remote code?**

- [ ] **No, I am not using remote code**

Verified against the actual upload package, not the source: no external
`<script src>`, no remote `.js`/`.mjs`/`.wasm` referenced anywhere, and zero
uses of `eval(`, `new Function` or `importScripts`. All nine
`chrome.scripting.executeScript` calls pass `func:` — a function compiled into
the extension — never a string or file fetched at runtime.

The two things that make people answer "yes" by mistake, and why neither counts:

- **The extension injects scripts into pages.** Those functions ship inside the
  package. Running packaged code in a page is what every content script does; it
  is not remote code.
- **It talks to a server.** It fetches JSON. Data is not code.

Answering "yes" moves the submission into a slower review lane and asks you to
justify something that isn't happening.

If a justification box appears anyway, paste this:

```
All executable code is contained in the package. The extension loads no scripts from any remote host: there are no external script tags, no remotely fetched JavaScript or WebAssembly, and no use of eval, new Function, or importScripts.

Scripts injected into pages are functions compiled into the extension bundle and passed to chrome.scripting.executeScript directly; nothing is fetched at runtime and executed. Network requests carry JSON data to and from the extension's own backend, and that data is never evaluated as code.
```

**Data usage** — tick these and nothing else:

| Data type | Collect? | If asked why |
|---|---|---|
| Personally identifiable information | **Yes** | Name and email, for sign-in, so clips are attributed to the right person. |
| Authentication information | **Yes** | A sign-in token so the extension can publish as the signed-in user. |
| Website content | **Yes** | The address, title and the specific text or media the user selects on a page they chose to clip. |
| Location | No | |
| Health information | No | |
| Financial and payment information | No | |
| Personal communications | No | |
| User activity | No | |

Three certifications to tick:

- [ ] I do not sell or transfer user data to third parties, outside of approved use cases
- [ ] I do not use or transfer user data for purposes unrelated to my item's single purpose
- [ ] I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL**

```
https://annotated.sh/privacy
```

> That page already names the four services that touch user data — Deepgram
> (transcription), Convex (storage), Clerk (sign-in) and Resend (claim emails).
> If a reviewer asks where data goes, that page is the answer.

---

## Step 5 — Distribution tab

- [ ] **Visibility: Unlisted**

Unlisted means anyone with the link can install it, but it doesn't appear in
search. That's what you want for judging — you control who sees it, without a
public launch.

- [ ] Regions: leave as all, unless you have a reason

---

## Step 6 — Submit

1. [ ] Click **Submit for review**
2. [ ] If it refuses, it will name the missing field — go fix that one thing and
   resubmit. Nothing is lost.
3. [ ] You'll get an email when it's approved or rejected

**Expect the broad `https://*/*` permission to add review time.** That's normal
for a clipping tool and not a sign anything is wrong.

---

## Step 7 — The moment it's approved, test this first

⚠️ **This is the one thing that could be broken and wouldn't show up until now.**

The Chrome Web Store gives your extension a **different ID** than the one you've
been sideloading. Sign-in goes through a tab on annotated.sh rather than through
the extension's own identity, so it *should* be unaffected — but it has never
been tested from a store install.

1. [ ] Open the store link in a fresh Chrome profile
2. [ ] **Add to Chrome**
3. [ ] Click the toolbar icon → the panel opens
4. [ ] Go to a YouTube video → **sign in** → publish a clip

If sign-in fails, it is almost certainly the new extension ID missing from
Clerk's allowed origins. It is **not** a rebuild. The fix is a `PATCH` to
`https://api.clerk.com/v1/instance` adding `chrome-extension://<new-id>` to
`allowed_origins` — **merging with the existing list, not replacing it**, or you
knock out the ones that already work. Ask me and I'll run it.

---

## Publishing an update later

1. [ ] Bump the version in `apps/extension/package.json`
   — the store **rejects a re-upload that reuses a version number**
2. [ ] `pnpm build && pnpm package` in `apps/extension`
3. [ ] Dev Console → your item → **Package** → upload the new zip
4. [ ] Submit for review again
5. [ ] Add an entry to `apps/web/content/changelog.ts` and deploy the site, so
   the changelog doesn't drift from what people are running

Keep the extension version and the changelog version the same number. They
drifted once already (0.2.0 vs v0.4.0 for the same product) and it's confusing
to untangle after the fact.

---

## Troubleshooting

**"An extension with this version already exists"**
You're re-uploading a version number already used. Bump
`apps/extension/package.json`, rebuild, upload again.

**"Manifest is not valid JSON" / package rejected**
You probably uploaded an unzipped folder, or zipped the folder rather than its
contents. Upload `build/chrome-mv3-prod.zip` exactly as `pnpm package` produced
it — don't rezip it by hand.

**Rejected for permissions**
Read which permission they name. All four in this build have a real caller, and
the justifications above say what each one does. Reply with the justification
text rather than removing the permission.

**Rejected for the privacy policy**
Usually means the policy doesn't mention something you declared. The page at
annotated.sh/privacy names Deepgram, Convex, Clerk and Resend — if a reviewer
wants something more specific, add it there and reply with the link.

**It's been days and nothing has happened**
Normal for broad host permissions. There's a "Contact support" option in the
console, but resubmitting doesn't speed anything up and resets your place.

---

## What's already done

You don't need to do any of these — noting them so you don't wonder.

- The package holds no credentials — checked for the worker token, backend host
  and any 64-character secret; all clean
- It's built from production settings, pointed at the live backend and
  annotated.sh, not localhost
- `cookies` was removed in 0.4.0 — nothing had called it since sign-in moved to
  the web-tab relay, and an unused permission is free scrutiny
- annotated.sh already serves this same build for people who prefer to sideload
- The changelog on the site describes what's in this release
