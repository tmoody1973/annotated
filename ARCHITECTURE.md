# Architecture

Three-tier architecture: client surfaces on top, our services in the middle, external APIs on the bottom. Read this before making decisions about which layer should own a new responsibility.

```
┌─────────────────────────────────────────────────────────────────────┐
│  CLIENT                                                              │
│  ┌──────────────────────────┐    ┌──────────────────────────┐       │
│  │  Chrome extension        │    │  Next.js web app         │       │
│  │  Plasmo MV3 sidepanel    │    │  Feed, profiles, landings│       │
│  └──────────────────────────┘    └──────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────┘
            │ Convex client                  │ Convex client + Clerk
            ▼                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SERVICES                                                            │
│  ┌─────────────┐    ┌─────────────────┐    ┌─────────────────────┐  │
│  │  Clerk      │    │  Convex         │    │  Fly.io worker      │  │
│  │  X + Google │◀──▶│  Realtime DB    │───▶│  ffmpeg, yt-dlp,    │  │
│  │  OAuth      │    │  + functions    │    │  Deepgram client    │  │
│  └─────────────┘    └─────────────────┘    └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                                       │
                                                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│  EXTERNAL APIS                                                       │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐           │
│  │ iTunes Lookup  │ │ Podcast Index  │ │ Deepgram       │           │
│  │ podcast → RSS  │ │ fallback feeds │ │ audio → words  │           │
│  └────────────────┘ └────────────────┘ └────────────────┘           │
│  ┌────────────────┐ ┌────────────────┐                              │
│  │ Spotify API    │ │ YouTube Data   │                              │
│  │ metadata only  │ │ API v3         │                              │
│  └────────────────┘ └────────────────┘                              │
└─────────────────────────────────────────────────────────────────────┘
```

## Layer responsibilities

**Client (browser-side).** Two surfaces. The Plasmo extension is the primary product (sidepanel + content script for page detection); the Next.js web app serves the feed, profiles, and annotation landing pages. Both authenticate via Clerk and read/write via the Convex client. Both use HeroUI v3 with the `brutalism-light` theme as the component layer — same design language across surfaces. **No business logic lives in the client beyond UI state.** All mutations go through Convex functions; all heavy lifting goes through the Fly worker.

**Services (our backend).** Three pieces. Clerk owns identity. Convex owns data, realtime subscriptions, and orchestration logic. The Fly worker owns anything that needs ffmpeg, yt-dlp, large file processing, or sustained background work — things Convex either can't do or shouldn't be paying for.

**External APIs.** All called server-side only (from the Fly worker or Convex actions). Never from the client — keeps secrets out of the browser and lets us cache aggressively.

## The audio pipeline (the wedge)

This is the load-bearing flow. When a user opens the sidebar on a podcast page:

1. **Page detection (extension).** Content script identifies the page is a podcast surface (Apple Podcasts, Spotify, or any site with `<link rel="alternate" type="application/rss+xml">`). Extracts the Apple ID, Spotify episode ID, or RSS URL.
2. **Resolve to RSS (Convex action → external API).** Convex calls the appropriate lookup: iTunes Lookup API for Apple IDs, Spotify Web API for Spotify pages (metadata only, then bounce to Podcast Index by show name), or directly fetch the RSS for show sites.
3. **Match episode (Convex action).** Fetches the RSS feed (cached 6 hours), finds the specific episode by GUID/title/date, extracts the `<enclosure url="..."/>` MP3 URL.
4. **Upsert source (Convex mutation).** Insert or look up the `sources` row by canonical URL. Two users clipping the same episode share this row.
5. **Transcribe if needed (Convex → worker → Deepgram).** If no `transcripts` row exists for this source, Convex calls the Fly worker's `POST /transcribe` endpoint with the MP3 URL. Worker streams the MP3 to Deepgram with `diarize=true` and a Convex webhook URL. Deepgram processes async (10-60s for a typical episode) and POSTs back to the worker, which writes the `transcripts` row.
6. **Stream transcript to sidebar (Convex subscription).** The sidebar subscribes to the transcript by source ID. As soon as it lands, the sidebar renders the words with drag-select.
7. **User drags clip span.** Sidebar computes `clipStartMs` and `clipEndMs` from the word boundaries. The sidebar UI enforces the 90-second spec limit by capping the drag selection; the Convex `createAnnotation` mutation also validates `clipEndMs - clipStartMs ≤ 90000` and rejects the call if exceeded.
8. **Slice audio (sidebar → Convex → worker).** Convex calls worker's `POST /slice-audio` with `{ audioUrl, startMs, endMs }`. Worker runs `ffmpeg -ss {start} -t {duration} -i {url} -acodec copy out.mp3`, uploads result to Convex file storage, returns the storage ID.
9. **User adds commentary.** Text or recorded audio. Audio uploads directly to Convex storage.
10. **Publish annotation (Convex mutation).** Insert into `annotations` table with `isPublic: true`. Convex real-time push notifies the feed subscribers.

Steps 1-6 should complete on first sidebar open (~5-60s depending on episode length); they're idempotent and cached. Steps 7-10 are interactive — sub-second.

## The YouTube pipeline (simpler)

Same shape but no Deepgram and no RSS resolution.

1. Extension detects YouTube page, extracts video ID.
2. Convex action calls YouTube Data API `videos.list` (1 quota unit) for title/duration/channel.
3. Worker runs `yt-dlp -f bv*+ba/b --write-auto-subs --sub-lang en --convert-subs vtt {url}` for video + auto-captions.
4. Caption VTT becomes the transcript (`provider: "youtube-vtt"`).
5. User drags clip span.
6. Worker runs `ffmpeg -ss {start} -t {duration} -i input.mp4 -vf scale=-2:240 -an out.mp4` (or with audio).
7. Steps 8-10 same as podcast.

## The article pipeline (simplest)

1. Extension detects article page (heuristic: has `<article>` tag or Open Graph article metadata).
2. Worker calls Mozilla Readability on the page URL, extracts cleaned HTML + title + byline.
3. Sidebar shows the cleaned text; user highlights a span.
4. No transcription, no ffmpeg.
5. Steps 9-10 same as podcast.

## Why this split

**Convex vs the worker.** Convex is fast for queries and mutations but charges for compute time and isn't designed for long-running CPU-bound work like ffmpeg or 60-second Deepgram waits. The worker is a stateless Node service we can scale horizontally on Fly. Anything that touches a child process (ffmpeg, yt-dlp) or holds a long HTTP connection (Deepgram async) goes to the worker.

**Worker is stateless.** All state lives in Convex. The worker reads inputs from Convex (or its HTTP request), processes, writes outputs back to Convex via the Convex HTTP API. If the worker crashes mid-job, Convex retries — there's no local state to lose.

**Source dedup is global, not per-user.** `sources` and `transcripts` are shared across all users. The second person to clip a popular episode gets instant transcript playback because someone before them paid the transcription cost. As the catalog grows this becomes a moat — Crate-adjacent thinking.

## Security boundaries

- **Worker ↔ Convex auth.** Shared bearer token in env (`WORKER_AUTH_TOKEN`). Worker verifies inbound requests are from Convex; Convex verifies inbound worker callbacks. Rotate quarterly.
- **External API keys.** Live in the worker's Fly secrets and Convex env vars. Never in the extension or web app bundle.
- **Clerk JWT.** Convex verifies Clerk-issued JWTs on every authenticated mutation. JWT template configured in Clerk dashboard with the Convex issuer URL.
- **CORS.** Worker accepts requests from Convex only (allowlisted). Convex HTTP endpoints are public but require JWT.

## Caching strategy

| What | Where | TTL |
|---|---|---|
| RSS feed contents | Convex (key: feedUrl) | 6 hours |
| iTunes Lookup results | Convex (key: appleId) | 7 days |
| YouTube `videos.list` results | Convex (key: videoId) | 7 days |
| Source rows | Convex (permanent) | Forever (dedup is the point) |
| Transcripts | Convex (permanent) | Forever |
| Sliced clips | Convex file storage | Forever (small) |
| Spotify access token | Worker memory | 50 minutes (refresh before 1h expiry) |
| Podcast Index auth header | Per request (cheap) | None |

## Claim dispute flow

When a user submits a "File a claim" form on an annotation landing page, a Convex mutation inserts a row into the `claims` table. A Convex action triggered by that insert calls the Resend API (`RESEND_API_KEY` in Convex env) to email Tarik with the claimant name, email, reason, and a link to the annotation. Manual review only in v1 — no moderation queue, no automated takedown.

Every annotation landing page must display the source's `canonicalUrl` as a visible, clickable link back to the original content. This is a hard spec requirement ("all clipped content must link back to its original source URL").

## When something goes wrong

- **yt-dlp breaks (YouTube changed internals).** Worker falls back to YouTube Data API for metadata + shows a "video clipping temporarily unavailable" message in sidebar. Update yt-dlp version.
- **Deepgram down.** Sidebar shows "transcription unavailable — try again in a few minutes." Spec doesn't require a manual fallback for v1.
- **Spotify episode is exclusive (no RSS).** Sidebar shows graceful "this episode can't be clipped" message with explanation. Documented non-goal.
- **Convex rate limit.** Shouldn't happen at bounty traffic but if it does, add request-level batching in the worker.

## Amplifiers

The four competitive differentiators from BUILD-INTENT.md. Each builds on the base spec without adding new infrastructure.

**1. Smart clip suggestions**
When a transcript becomes `ready`, a Convex action runs a single pass over the word array scoring candidate spans: speaker-change density (diarization from Deepgram), named-entity density (simple regex for proper nouns and numbers), and paragraph boundaries. The top 3 spans (max 90s each) are written to a `suggestedClips` array on the `transcripts` row. The sidebar reads this array and renders three tap-to-select highlights in the transcript view. No ML model required — purely heuristic, runs in a Convex action.

**2. Quote card export**
The annotation landing page (Next.js) renders a hidden `<div>` at 1080×1080px containing the clip's selected text or transcript segment, source attribution, a static waveform visualization, and the Annotated watermark. `html2canvas` (or `@vercel/og` as a Vercel edge function) captures it as a PNG on demand when the user clicks "Export card." The PNG is served via a `/api/og/[annotationId]` route — shareable directly to X.

**3. Speaker badges**
Deepgram diarization assigns a `speaker` field to each word in the transcript. When rendering a transcript segment in the sidebar or on the landing page, group consecutive words by speaker and prepend the speaker label (e.g., "Speaker 0:" or a resolved name if the podcast has known hosts). Speaker names can be mapped manually in the source metadata if needed. No additional API calls — this is free output from the existing Deepgram payload.

**4. Source-page badge**
When the sidebar opens on a page that already has annotations in the `annotations` table (matched by `canonicalUrl`), a badge count appears in the sidebar header. Tapping it opens an inline list of existing annotations for that source. Implemented as a Convex query `getAnnotationsBySource(canonicalUrl)` — no new infrastructure, just a query and a UI panel.
