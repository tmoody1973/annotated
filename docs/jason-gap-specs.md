# Jason-gap enhancement specs

Implementation-ready specs for the gaps surfaced by comparing `docs/jason-persona.md` against the
shipped build (Steps 1–10.5). Each maps to a numbered gap from that review. The bounty floor (SPEC.md's 9 boxes) is already
met; these are the "most complete execution" + "Jason loves it" layer.

Priority tiers: **Critical** (his named #1 flow + core trigger emotion) → **High** → **Medium**.
Effort: S ≈ <2h, M ≈ ~half day, L ≈ ~1–2 days.

Current data model facts (from `convex/schema.ts`): `annotations` is a singleton (no thread link);
`comments` is flat (no `parentId`); `likes` is like-only (`{annotationId, userId}`); counts
(`commentCount`, `likeCount`) are denormalized on `annotations` and recomputed from rows.

---

## 1. Threading — multi-clip from one source (CRITICAL)

**Goal.** Jason's #1 canonical flow (JTBD #1): clip the most offensive NYT sentence → comment →
publish → add three more clips from the *same* article, threaded into **one shareable URL showing
all clips in order.** Target: 90s first clip, **30s per follow-on**. Persona calls this "the
highest-leverage feature you can add beyond the spec."

**Approach / key decision.** Lightweight thread as an ordered list of annotations sharing one
source + author. A thread is its own addressable URL.
- **Data model:** new table
  `threads: { authorId: id("users"), sourceId: id("sources"), title: optional(string), createdAt: number }`
  with `.index("by_author", ["authorId"])`. On `annotations` add `threadId: optional(id("threads"))`
  and `threadOrder: optional(number)`, plus `.index("by_thread", ["threadId"])`.
- **Canonical URL:** new route `/t/[threadId]` renders all annotations ordered by `threadOrder`
  (each clip + its commentary + per-clip comments). `/a/[id]` for a threaded clip **301s to
  `/t/[threadId]#clip-[order]`** so a clip link still resolves; standalone clips keep `/a/[id]`.
- **Backend:** `threads.create({sourceId})` (auth-derived author) returns threadId; `annotations`
  publish path accepts optional `threadId` and assigns the next `threadOrder`; `threads.getWithClips`
  joins source + ordered annotations + author. Feed shows the thread **head** with a "🧵 N clips"
  badge (don't flood the feed with each clip).
- **Extension UX:** after a successful publish from source S, show **"Add another clip to this
  thread"** — keeps the same `threadId`, re-opens the clip surface on the same source. The 30s target
  means: no re-auth, no re-detect, source already resolved.

**Acceptance.**
- Publish clip A from source S (no thread) → standalone `/a/[A]`.
- "Add to thread" → publish B, C, D from S → `/t/[id]` shows A,B,C,D in order under one URL.
- `/a/[B]` 301s into the thread; feed shows one head card with "🧵 4 clips".
- A second user clipping S starts their **own** thread (threads are per-author).
- Follow-on publish path has no redundant steps (source pre-resolved).

**Effort:** L. **Open decision:** dedicated `/t/[id]` (recommended, matches "single shareable URL")
vs. expanding `/a/[id]` to render a chain. Recommendation: `/t/[id]`.

---

## 2. Up/down voting — "BS or brilliant" (CRITICAL)

**Goal.** Jason's core trigger is binary emotion: amplify ("brilliant") or push back ("BS").
Like-only can't express the negative pole. Persona: "single up/down arrow per annotation, no
Reddit-style score wars."

**Approach / key decision.** Generalize the `likes` table into votes with a signed value.
- **Data model:** rename `likes` → `votes`, add `value: union(literal(1), literal(-1))`. Keep the
  `by_annotation_and_user` unique index (one vote per user; toggling the same arrow clears it,
  pressing the opposite flips it). On `annotations` replace `likeCount` with `upCount: number` +
  `downCount: number` (or a single `score`). Recompute from rows on every toggle (drift-proof, the
  pattern already used for `likeCount`).
- **Migration:** backfill existing `likes` rows as `value: 1`; set `upCount = old likeCount`,
  `downCount = 0`.
- **Backend:** `votes.toggleVote({annotationId, value})` (auth-derived), `votes.getMyVote`,
  counts recomputed. Reject self-vote? No — Jason votes his own; leave it.
- **UI:** replace `LikeButton` with a compact `VoteButtons` (▲ brilliant / ▼ BS), the user's current
  choice highlighted, **net score shown small** (persona: no score wars — show net, not a leaderboard).

**Acceptance.** Up toggles on/off; down toggles on/off; up→down flips (never both); counts equal the
row counts after rapid toggling; signed-out routes to sign-in (current LikeButton behavior).

**Effort:** M. **Open decision:** show net `score` vs. separate up/down counts. Recommendation: net
score, de-emphasized. **Tie-in:** pair with gap-style "no tepid middle" — see note in §10/persona.

---

## 3. Threaded comments (HIGH)

**Goal.** He confirmed threaded comments twice. Currently flat.

**Approach.** One level of nesting (comment → replies), not arbitrary depth (keeps the UI clean,
avoids Reddit sprawl).
- **Data model:** add `parentId: optional(id("comments"))` to `comments`, `.index("by_parent",
  ["parentId"])`. A reply's `parentId` is the **top-level** comment (flatten deeper replies to one
  level).
- **Backend:** `comments.add` accepts optional `parentId`; `listByAnnotation` returns top-level
  comments each with a `replies[]` array; `commentCount` increments for replies too.
- **UI:** "Reply" affordance under each top-level comment; replies render indented one level with the
  replier's avatar + handle.

**Acceptance.** Add top comment; reply to it (renders nested one level); replying to a reply attaches
to the same top-level parent; `commentCount` counts top + replies.

**Effort:** S–M.

---

## 4. Source screenshot on the annotation page (HIGH)

**Goal.** Strong signal, tied to the fair-use *soul*: "we're pointing at it, not replacing it." The
annotation page should show a screenshot of the original source so the clip reads as a citation, not
a repost. Today the article landing shows the quote with no visual of the original.

**Approach / key decision.** Screenshot is primarily an **article** feature; YouTube/podcast reuse
existing artwork.
- **Articles — capture in the extension at clip time** (recommended over server-side headless):
  `chrome.tabs.captureVisibleTab` grabs exactly what the clipper saw (paywall-resolved, JS-rendered),
  with **no new heavy worker dep and no SSRF surface**. Encode → base64 → upload via the existing
  clip/commentary upload path → store a storage id. (Alternative: worker headless Chromium of the
  canonical URL behind the existing `isPubliclyFetchable` SSRF guard — cleaner full-page capture but
  adds Playwright to the worker, breaks on paywalls/JS. Not recommended.)
- **YouTube / podcast:** reuse `sources.youtubeThumbnailUrl` / podcast cover art as the "original"
  visual — no page capture needed.
- **Data model:** `annotations.screenshotStorageId: optional(id("_storage"))` (per-annotation: the
  capture is a moment-in-time of what that clipper saw; article content drifts). `getById` projects a
  `screenshotUrl`.
- **Backend:** publish path accepts the screenshot (base64 → upload, mirroring the commentary-audio
  flow) and persists `screenshotStorageId`.
- **Permissions:** `captureVisibleTab` needs `activeTab` (already in the manifest) for the focused
  https tab — works on the article flow without new host perms.
- **UI:** article landing renders the screenshot as the "pointing at it" visual (beside or above the
  quote), labeled **"Original — annotated points at it, doesn't replace it"** with the source link +
  claim button nearby. Keep it modest (capped height, click-to-open original).

**Acceptance.** Publish an article clip → landing shows a real screenshot from Convex storage (image
HTTP 200) + the quote + source link + "File a claim" + the fair-use label; YouTube/podcast landings
show the thumbnail/cover as the original visual; a clip with no screenshot still renders cleanly
(graceful absence, no broken image).

**Effort:** M. **Open decisions:** extension viewport capture (recommended) vs. worker headless;
per-annotation vs. shared per-source storage (recommendation: per-annotation).

---

## 5. Quote-card / og:image — X distribution (HIGH)

**Goal.** Success-bar mechanism: "posts an annotation URL on X within 10 minutes." Amplifier #2.
Right now an X link-unfurl of `/a/[id]` is bare.

**Approach.** Dynamic Open Graph image via Next's `ImageResponse` (Satori), plus a downloadable
1080×1080 card.
- **og:image:** `apps/web/app/a/[id]/opengraph-image.tsx` (and `/t/[id]/opengraph-image.tsx`) →
  1200×630 PNG: the quote (or commentary excerpt), author handle, source attribution + type icon
  (🎙/▶/📰), `annotated.com` watermark. Add `openGraph` + `twitter: { card: "summary_large_image" }`
  to each page's `metadata` (fetch annotation server-side, which `/a/[id]` already does).
- **Download card:** a "Download quote card" button on the landing rendering a 1080×1080 variant
  (same Satori template, square). No live waveform in Satori — render a stylized static bars motif or
  the source thumbnail instead.

**Acceptance.** `GET /a/[id]/opengraph-image` → 1200×630 PNG; the X Card Validator (or a curl of the
meta tags) shows `summary_large_image` with the quote; download button saves a 1080² PNG; a bad id
yields the default OG, not a crash.

**Effort:** M. **Open decision:** ship og:image first (free unfurl, high leverage), treat the
downloadable square as a fast-follow.

---

## 6. Processing seconds-remaining indicator (HIGH)

**Goal.** Friction intolerance: "any processing state without a seconds-remaining indicator." Podcast
transcription is a 20–40s **sync** worker call today (debt j) with only a binary "transcribing" state.

**Approach.**
- **Transcription:** move podcast transcription to the **async Deepgram-callback path** the
  architecture already describes (worker has a webhook handler). The worker sets
  `transcripts.status = "processing"` on start; the extension subscribes to `transcripts.getBySource`
  and shows an **elapsed timer + estimate** ("Transcribing… ~30s for a 45-min episode") with a
  determinate-feeling bar that fills against the estimate, flipping to ready on the status change.
  (Deepgram sync gives no true % — elapsed + estimate is the honest version of "seconds remaining".)
- **Clip slicing (ffmpeg, <2s):** a labeled "Slicing clip…" state with the ~2s expectation; no bar
  needed.
- **Component:** `<ProgressIndicator label estimateMs startedAt />` reused by both.

**Acceptance.** Starting transcription shows an elapsed counter + estimate immediately; on
`status: ready` it clears into the transcript; on `failed` shows the existing error (no infinite
spinner). No processing state lacks a timer.

**Effort:** M (the async move is the bulk; clears debt j).

---

## 7. Audio-recording polish (MEDIUM)

**Goal.** Persona's specific recording asks so commentary "sounds like his podcast, not a voicemail":
take counter, auto-trim dead air, waveform preview, clean/loud output.

**Approach (per sub-item).**
- **Take counter:** `useVoiceRecorder` tracks an attempt count; re-recording increments a visible
  "Take N" chip (he redoes 2–3×).
- **Waveform preview:** decode the recorded blob via `AudioContext.decodeAudioData` → draw peaks to a
  `<canvas>` in `commentary-composer.tsx` (and reuse on the landing `<audio>`). Small util, no heavy
  lib needed.
- **Auto-trim dead air:** add ffmpeg `silenceremove` (leading + trailing) in
  `commentary-transcoder.ts` ("he starts talking before he hits record").
- **Clean/loud output:** add ffmpeg `loudnorm` (EBU R128) in the same transcode so output sits at
  podcast loudness.

**Acceptance.** Re-record bumps a visible take counter; the recorded preview shows a waveform; output
mp3 is loudness-normalized and has leading/trailing silence trimmed (verify via `ffprobe`/loudnorm
print). The transcode test (`transcode-commentary.test.ts`) extended to assert the filter chain ran.

**Effort:** M (waveform is the largest piece).

---

## 8. ~100-word graceful text ceiling + visible fair-use labels (MEDIUM)

**Goal.** Friction intolerance: the text selector should "just stop highlighting at the limit, don't
error." Persona also wants the fair-use frame **visible** near the handles ("clip up to 90 seconds
(fair use)"), not buried in onboarding. Today there's a 2000-char cap enforced only at publish.

**Approach.**
- **Shared:** add `MAX_QUOTE_WORDS` (≈100); extend `selectArticleHighlight` to **clamp** the
  selection to the ceiling (truncate at the last whole word ≤ limit) and return a `clamped: boolean`.
  Align the publish guard to the same ceiling.
- **Article UI:** when a selection hits the ceiling, stop extending and show inline microcopy
  "Clipped to ~100 words (fair use)" — no error toast.
- **Clip UIs (audio/video):** add a small label near the trim handles / span control:
  "Clip up to 90 seconds (fair use)". Makes the philosophy visible (persona §fair-use).

**Acceptance.** Selecting >100 words clamps to ≤100 at a word boundary with the visible label, no
error; publish guard matches; the 90s clip surfaces show the fair-use label.

**Effort:** S–M.

---

## 9. Anonymous-annotation toggle (MEDIUM)

**Goal.** Medium signal: a publish-flow toggle, **default off**.

**Approach.**
- **Data model:** `annotations.isAnonymous: optional(boolean)`.
- **Backend:** publish path + `insertAnnotation` accept the flag; `getById` / `listFeed` / profile
  queries **mask the author** (omit `authorId`, name, avatar; emit `author: { anonymous: true }`)
  when set. Keep `authorId` server-side for claims/moderation; never project it when anonymous.
- **UI:** a toggle in the composer (default off); feed/landing render "Anonymous" + a neutral avatar;
  anonymous annotations **don't appear on the author's public profile**.

**Acceptance.** Publish anonymous → feed/landing show "Anonymous", API projection has no author
identity; profile page omits it; default-off behaves exactly as today.

**Effort:** S–M. **Open decision:** still count toward the author's like/vote totals privately?
Recommendation: yes server-side, never shown.

---

## 10. Branding read — "type-forward news-app, no cute" (MEDIUM, decision)

**Goal.** Jason wants a **type-forward news-app** aesthetic, explicitly "not scrapbook, not Pinterest,
not Medium," "no cute." Current theme is HeroUI **brutalism** (heavy borders, hard drop-shadows,
yellow accent) — defensibly type-forward, but the shadows/borders can read as "designed" rather than
newsroom-plain.

**Approach (this is a judgment call, not a blind restyle).**
- Run `/design-review` on the live feed + a landing + a thread page against three criteria:
  (1) does the type hierarchy read like a newsroom, (2) do shadows/borders feel deliberate or
  decorative, (3) would Jason call it "cute."
- Produce an A/B: **current brutalism** vs. a **"calmed" variant** (reduce drop-shadow depth, tighten
  to near-monochrome + one accent, restore monospace to timestamps/code only — note the official
  brutalism theme is mono-body, which contradicts the original "mono for timestamps only" intent and
  is itself worth a decision). All via HeroUI theme tokens in `globals.css` — no component rewrites.

**Acceptance.** A documented decision (keep bold vs. calmed) with before/after screenshots; if calmed,
shadow/border intensity reduced and mono usage scoped, verified in a browser at the same routes.

**Effort:** S to spec + decide, M to execute. **This needs Tarik's eye — I won't restyle
unilaterally.**

---

## 11. Sidebar overlay vs. push (MEDIUM, mostly a documented tradeoff)

**Goal.** Persona dislikes a sidebar that **pushes** page content instead of overlaying. Chrome's
**native side panel** (`chrome.sidePanel`, which the SPEC requires and which we ship) inherently
resizes the viewport — there is no overlay mode for the official side panel.

**Approach / recommendation.**
- **Keep the native side panel as the primary surface.** It *is* the "Chrome sidebar" Jason specced;
  the push is inherent to the platform, and the side panel is what reads as a first-class sidebar to a
  judge. Document this tradeoff so it's a deliberate choice, not an oversight.
- **Optional future enhancement (defer):** an injected **floating overlay panel** (content-script
  iframe, fixed-position, doesn't resize the page) as an *alternate* surface toggle. This is real work
  (re-host the panel UI in a content script, message-bridge to the worker/Convex) and risks looking
  less like a "sidebar." Only build if the push genuinely bothers Jason in testing.

**Acceptance (for the documented decision).** A short note in `ARCHITECTURE.md` explaining the side
panel push is intentional + spec-driven, with the overlay listed as a deferred option.

**Effort:** S to document; L if the overlay is built. **Recommendation: document + defer the overlay.**

---

## Recommended sequencing

1. **§2 voting** (M) and **§3 threaded comments** (S–M) — small schema evolutions, immediate
   "feels inhabited / BS-or-brilliant" payoff.
2. **§1 threading** (L) — the biggest gap and his #1 demo flow; do it deliberately.
3. **§4 source screenshot** (M, fair-use soul) + **§5 og:image** (M, distribution) — both reinforce
   the "citation, not repost" framing and the X success bar.
4. **§6 progress indicator** (M, clears debt j), **§8 fair-use ceiling/labels** (S–M),
   **§7 audio polish** (M), **§9 anonymous** (S–M).
5. **§10 branding** and **§11 sidebar** — decisions for Tarik, minimal/deferred build.

## Open decisions to confirm before building
- **§1** dedicated `/t/[id]` route (recommended) vs. expanding `/a/[id]`.
- **§2** `likes` → `votes` migration (rename table + backfill `value:1`); net `score` vs. up/down counts.
- **§6** move podcast transcription to the async Deepgram-callback path to get real status streaming.
- **§10** keep bold brutalism vs. a calmed news-app variant (needs Tarik's eye).
