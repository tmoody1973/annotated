# Annotated — Extension Experience Redesign

> **What this is.** The design for rebuilding the Chrome side panel from a working prototype
> into a product: a staged four-screen flow, an honest publish path, and the architectural
> change that stops shipping a live credential in the bundle.
>
> **Grounded in:** `docs/interaction-flow.md` (the breadboard this finally implements),
> `docs/jason-persona.md`, `docs/jason-gap-specs.md`, and the shipped code as of `86ea3fb`.
> **Status:** design approved 2026-08-11. **Scope:** the extension. The web app is a
> separate cycle.

---

## Why

The panel works. Four things are weak at once, and they share a cause.

| Symptom | Where |
|---|---|
| YouTube in/out is a type-the-digits `mm:ss` input — the persona's named friction-killer | `apps/extension/components/clip-composer.tsx:124` |
| No auto-copy on publish; the payoff is a bare "View annotation ⟶" link | `clip-composer.tsx:331-360` |
| Publish is hard-gated on topics, and the reason renders *below* the disabled button | `clip-composer.tsx:415, 429` |
| Publish blocks through clip → transcode → save with no optimistic path | `clip-composer.tsx:269-317` |
| Developer copy on screen: `YouTube clip`, a raw `<code>{videoId}</code>`, "Checking Convex…" | `apps/extension/sidepanel.tsx:41-120` |
| One-sentence empty state; no orientation, no reasoned dead-ends | `sidepanel.tsx:131` |
| No Back or Cancel once you are in the composer | `clip-composer.tsx` |
| No dark mode, while the web app has one | `apps/extension/lib/clip-styles.ts` |

The cause is that the panel has no stages. Everything lives in one scroll, so there is
nowhere to put a Back button, nowhere to orient a newcomer, no finish line to make a
payoff out of, and no room to give any single control the space it needs.

`docs/interaction-flow.md` already breadboarded the answer — five places with explicit
affordances and conditions. It was never built. This spec builds it.

---

## Decisions

| Decision | Choice |
|---|---|
| Panel shape | Staged flow, with a one-obvious-action opening |
| Screen count | Four: Source → Clip → Take → Published |
| Topic requirement | Pre-filled and editable; never blocks Publish |
| Publish wait | Optimistic — the row and its URL exist in ~2s, the clip fills in behind |
| Visual treatment | Existing brutalist palette, weight dialed for 380px, dark mode added |
| Worker calls | Move server-side into a Convex action |
| Vocabulary | Rename `commentary*` → `take*` in this cycle; `likes` → `votes` deferred to the web cycle |

---

## The four screens

The spine is constant. Only screen 2 changes shape by source type.

### 1 — Source

Wakes on the active tab and resolves to one state. In the detected state it shows a source
card (title, show/channel, type) and **one primary action**, pre-seeded from context:

- YouTube — **"Clip last 60s"**, anchored to the live playhead
- Podcast — **"Clip from the transcript"**
- Article — **"Highlight on the page"**

Secondary affordances (pick a chapter, set manually) are demoted to a ghost row beneath.
A quiet line reads "Up to 90 seconds · fair use" — the persona asks for the fair-use frame
to be visible at the point of clipping, not buried in onboarding.

Arriving must never present a form.

### 2 — Clip

Gets the whole panel. Header carries Back and a step indicator.

**YouTube.** A scrubber with draggable in/out handles and a visible playhead. The `mm:ss`
fields survive as **readouts you can still type into**, not the primary affordance. Duration
reads large with `/ 1:30 max` beside it. A "Preview the clip" control plays the selection.

**Podcast — the differentiator.** Speaker-grouped transcript filling the panel. Drag across
words → the audio span is derived and the quote auto-fills. This is the interaction the
product is built around and the reason it gets a dedicated screen.

**Article.** Selection happens in the page; the panel mirrors it live, shows a running
`n / ~100 words · fair use` count, and **stops extending at the ceiling** rather than
erroring (`MAX_QUOTE_WORDS`, clamped at a word boundary). The fair-use screenshot of the
original is captured here, silently.

**Podcast, transcript not ready.** A truthful elapsed-plus-estimate indicator
("22s elapsed · ~35s for a 48-min episode") *and something to do inside the wait* — a
"Write the take first" affordance that jumps to screen 3 and returns. A dead wait here is
the podcast path's biggest threat to the 90-second target.

### 3 — Take

- A **clip chip** at the top — `▶ 4:19–5:19 · 1:00` with an **Edit** link that returns to
  screen 2 without discarding the take text. This answers "what am I annotating?" without
  a scroll.
- The take field, labelled, with the placeholder "BS or brilliant? Say why."
- "🎙 Record it instead" — one tap to the audio path, which keeps the take counter and
  waveform preview.
- Topic, **pre-filled** (see below), shown as an editable chip.
- "Publish anonymously" toggle, default off.
- Publish. **Publish is never disabled for a missing topic.** It is disabled only while a
  publish is in flight, or when both take text and take audio are empty — mandatory
  commentary is a fair-use value, not merely validation.

**Topic pre-fill order:** the topic this source was last tagged with → a keyword match on
the source title → the user's most-used topic → a fallback bucket. No model call; the
common case is zero interaction.

### 4 — Published

The URL is the payload.

- The `/a/[id]` URL, prominent, **already on the clipboard**, with a "Copy again" control
- A preview card: the take, the source line, and — while the slice is still running — a
  `◐ clip processing…` line with an elapsed count
- **"+ Add another clip → thread"** as the loudest action, because threading is the
  persona's #1 flow and the current panel buries it
- "Open the page ⟶" and "New clip" as secondary

No confirmation modal anywhere in the flow.

---

## The states that were never designed

Screen 1 currently has exactly one fallback sentence. The full set:

| State | Content |
|---|---|
| **First run** | One screen, hard limit. "Clip it. Say why. Share the link." plus one sentence of explanation and the two auth buttons. Onboarding past one screen is a named demo-killer. |
| **Detecting** | "Looking at this page…" plus a line naming what works. **Never** "Checking Convex…" — the panel describes the user's world, not ours. |
| **Nothing clippable** | Names what this page is, lists the three things Annotated works on, and offers an exit into the feed. |
| **Can't be clipped** | Names the *cause* ("Spotify-exclusive shows don't publish an audio feed, so there's no file to clip from") and offers a next move. "Can't" without "why" reads as broken. |
| **Signed out** | X and Google only, returning to the affordance that triggered the gate. |
| **Publish failed** | Retry, or Back to the Take screen with everything intact. |

---

## Visual treatment

The palette is not in question: `clip-styles.ts` already mirrors the web's brutalist tokens.
Two things change.

**Weight, dialed for 380px.** Hard offset shadows drop from 6px to 3px, and only the
*primary action* on a screen keeps one. Cards lose their shadows. Same palette, same type,
same square corners — brutalism was designed for wide canvases, and at panel width the
heavy version reads as crowded rather than confident.

**Dark mode**, using the web app's existing dark tokens verbatim (`apps/web/app/globals.css:70-80`):
near-black page, **cards stay light paper**, shadows turn acid. The panel docks beside
YouTube, which is dark by default; today it glows cream.

Labels, the explicit step indicator, and the visible anonymous toggle are **kept**. The
brutalist language is declarative and labelled, and explicit structure helps a newcomer
build the model.

**Tokens move to one shared source** both surfaces import. Two hand-maintained copies
already drifted — that drift is why the panel has no dark set at all.

---

## Architecture

### Worker calls move server-side

Today the panel calls the Fly worker directly with a bearer token, then calls Convex.
This inverts:

1. The publish mutation creates the annotation row with `mediaState: "processing"` and
   returns the id — the Published screen and its copyable URL are real in ~2s
2. The mutation schedules a Convex action that calls the worker. **This pattern already
   exists** — `packages/backend/convex/articles.ts:23` does exactly this for extraction
3. The worker slices and uploads; the action patches `clipStorageId` and flips
   `mediaState` to `"ready"`
4. On failure the action sets `"failed"` and cleans up any orphaned blob

What this buys, beyond the optimistic URL:

- **The extension stops needing a worker token at all.** `PLASMO_PUBLIC_WORKER_TOKEN` is
  deleted, not rotated. See Security below.
- The job survives the panel closing — the class of bug patched in `b621b92`
- Orphaned-blob debt (d/i) is closed by construction

### Worker latency

`apps/worker/src/youtube-clipper.ts:51` passes `--force-keyframes-at-cuts`. The measurement
in `docs/interaction-flow.md:176-184` attributes ~85% of YouTube slice time to that single
flag: 19–27s with it, 3.7s without. It forces a re-encode inside yt-dlp purely for a
frame-exact start — but lines 74-95 **already re-encode** for the 240p downscale.

Fix: drop the flag, download a slightly padded section, and add `-ss <pad>` to the existing
ffmpeg pass. The exact start comes free in work already being done.

The current `estimateMs={audioBlob ? 9000 : 6000}` (`clip-composer.tsx:424`) is fiction for
an operation that measures 24–32s locally. After the fix, estimates are set per source type
against measured values, and `ProgressIndicator` is given staged labels
(Slicing → Uploading → Publishing).

---

## Schema

```ts
// annotations — the only new column
mediaState: v.optional(v.union(
  v.literal("processing"), v.literal("ready"), v.literal("failed")
)),
takeText: v.optional(v.string()),               // was commentaryText
takeAudioStorageId: v.optional(v.id("_storage")),
takeAudioTranscript: v.optional(v.string()),
```

`mediaState` absent means `ready` — existing rows need no backfill.

**`clipStorageId` needs no schema change.** It is already `v.optional` at `schema.ts:114`,
and both read paths already guard it (`annotations.ts:30`, `:556`) because articles have no
clip. What changes is only the *mutation argument* — `v.id("_storage")` becomes optional at
`annotations.ts:238` and `:290`, so a row can be created before the slice exists.

The `commentary*` → `take*` rename is applied across `annotations.ts`, `insertAnnotation`,
`getById`, all three create mutations, `convex-publish.ts`, and the composer components,
with the old field names read as a fallback in projections until a backfill runs.

`likes` → `votes` is **not** in this cycle. It is a web-app concern (vote buttons, feed,
landing) with its own migration and backfill.

---

## Web app changes (the minimum optimistic publish forces)

Only two renderers, not the web cycle:

- The feed card renders `processing` as a skeleton with a "clip processing" line, and
  `failed` without a broken player
- `/a/[id]` does the same, and offers the author a retry on `failed`

---

## Extension structure

`sidepanel.tsx` becomes a router over the four screens plus the state set. One component
per screen; per-source Clip screens (`clip-youtube.tsx`, `clip-podcast.tsx`,
`clip-article.tsx`) behind a common interface: given a detected source, produce a valid
span or text range. Files stay under ~200 lines per the project convention.

Draft persistence (`clip-draft.ts`) extends to cover which screen you were on, so switching
tabs and returning restores position as well as content.

---

## Security

**Already done, 2026-08-11.** `annotated-extension-webstore.zip` contained the worker bearer
token in plaintext (`chrome-mv3-prod/sidepanel.aa9c292a.js`) alongside the worker URL.
`PLASMO_PUBLIC_*` vars inline at build time, so it shipped in the bundle. The token was
verified live against `POST /clip-youtube` — bundled token returned 400 (auth passed),
a bogus token returned 401.

`WORKER_AUTH_TOKEN` is a shared symmetric secret in three places: Fly validates inbound
requests with it, the worker authenticates *to Convex* with it (`apps/worker/src/index.ts:25`),
and Convex validates writes against it (`convex/files.ts:12`, `convex/transcripts.ts:15`).
The leak therefore also granted `files:generateUploadUrl` — write access to Convex storage.

Rotated on both the Convex deployment (`strong-eel-665`) and the Fly app
(`annotated-worker-rm`), and verified: old token now 401, new token 400. Local `.env` files
updated.

**This cycle's job is to make the exposure structurally impossible.** Moving worker calls
into a Convex action removes the need for the extension to hold any worker credential.
Until then, each rebuild re-embeds a token; `PLASMO_PUBLIC_WORKER_TOKEN` should be deleted
from `apps/extension/.env` and the manifest's worker host permission narrowed in the same
change that lands the action.

---

## Out of scope

The web app cycle (feed, profiles, threads, landing beyond the two renderers above);
`likes` → `votes`; the claims rate limit (debt s); `canonicalUrl` normalization (debt k);
an injected overlay panel as an alternative to the native side panel (documented as a
deliberate deferral in `jason-gap-specs.md` §11).

---

## Acceptance

1. Opening the panel on a YouTube watch page shows a source card and one primary action —
   no form, no raw video id, no "Checking Convex…"
2. Clipping never requires typing a timecode; drag sets the span and the readouts follow
3. Publish is never disabled because a topic is missing; the topic arrives pre-filled
4. Publishing returns a real `/a/[id]` URL on the clipboard within ~3s of the tap, on all
   three source types, with the YouTube clip appearing on the landing page afterward
5. Closing the side panel mid-publish does not abort the clip; the annotation completes
6. A 60-second YouTube slice completes in **under 15s on Fly**, measured end to end, and
   the displayed estimate is within ±50% of the measured time on all three source types
7. Every processing state shows elapsed time against an estimate; none shows a bare spinner
8. Back exists on every screen after the first and never discards entered text
9. All six states render with real copy — no state falls through to a blank panel
10. The panel renders correctly in dark mode, and the built bundle contains **no** worker
    token (`grep` the packaged zip)
11. `pnpm typecheck` clean across all packages; extension E2E covers the four-screen flow
    against a loaded extension

---

## Risks

- **Podcast transcription latency** stays the biggest threat to the 90-second target. The
  wait is now honest and occupied, but not shorter. Debt j (async Deepgram callback) is not
  resolved here.
- **Optimistic publish crosses into the web app.** Kept to two renderers, but a `processing`
  row rendering badly in the feed would be visible to everyone, not just the clipper.
- **One extra tap.** The four-screen flow is only correct if the steps read as momentum.
  If the stopwatched hot path gets slower rather than faster, the screen count is the first
  thing to revisit.
- **Rebuild required now.** The shipped extension holds the rotated-out token, so clipping
  is broken for anyone running it until a new build ships.
