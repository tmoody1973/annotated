# Annotated.com — Claude Code instructions

This repo is a build for a $5,000 bounty from Jason Calacanis: a Chrome sidebar extension that lets users clip and annotate media (YouTube, podcasts, articles) from any website. The judging criterion, in the bounty's own words: *"the cleanest and most complete execution wins."*

Before making any non-trivial decision, read:

- `BUILD-INTENT.md` — the differentiation thesis, scope cuts, non-goals
- `SPEC.md` — the bounty's hard requirements (non-negotiable)
- `ARCHITECTURE.md` — system architecture, data flow, the audio pipeline
- `SETUP.md` — services, env vars, scaffold commands, build order
- `packages/backend/convex/schema.ts` — the data model

## What we're building (one paragraph)

A Chrome sidebar that captures 90-second clips from YouTube, podcasts, or news articles, lets the user add text or recorded-audio commentary, publishes to a source-linked landing page, and surfaces in a public feed with follow + comment. Auth is Clerk-mediated X or Google OAuth. Every annotation has a visible "File a claim" button for fair-use disputes. The differentiation is the **podcast path**: transcript-anchored audio clipping — drag across transcript words, get the matching 90-second audio segment. See BUILD-INTENT.md for the full thesis.

## Stack

| Layer | Tech | Notes |
|---|---|---|
| Web app | Next.js 16 App Router, Vercel | Feed, profiles, annotation landing pages. Note: Next 16 renamed `middleware.ts` → `proxy.ts`. |
| Extension | Plasmo MV3 side panel | React + TypeScript + Tailwind out of the box |
| Worker | Fastify + Node, Fly.io | ffmpeg, yt-dlp, Deepgram webhook handler |
| Backend | Convex | Real-time data, file storage, scheduled functions |
| Auth | Clerk | X + Google providers only; email/password disabled |
| UI library | **HeroUI v3 + HeroUI Pro** (license held) | Shared across web app and extension sidepanel |
| Theme | **`brutalism-light`** (HeroUI v3 official theme) | Brutalism-dark for system dark mode via `next-themes` |
| CSS framework | Tailwind CSS v4 | Required by HeroUI v3; install via `@heroui/styles` |
| Transcription | Deepgram Nova-3 | Podcasts; word-level timestamps + speaker diarization |
| Transcription | yt-dlp VTT | YouTube; no extra service needed |
| Email | Resend | Claim dispute notifications to Tarik; triggered by Convex action on claims insert |
| Package mgr | pnpm workspaces | Turborepo for task orchestration |

### UI conventions (HeroUI-specific)

- Use HeroUI components as the default; only drop to raw Tailwind when no component fits
- Theme is set on `<html>` via `data-theme="brutalism-light"` (or `"brutalism-dark"`) — flip via `next-themes`
- Compound API: `<Card><Card.Header>...</Card.Header></Card>`, not deeply nested prop blocks
- Brutalism discipline: monospace runs are reserved for timestamps and code only — never body text. Audio waveforms read as data viz, not decoration. The brutalism is the *frame*; content stays readable.
- HeroUI Pro MCP is installed in Claude Code — use it to look up component APIs and theme tokens rather than guessing

## Spec requirements (non-negotiable)

Read SPEC.md. Hit every checkbox. The bounty rewards spec-perfect execution. Do not deviate to be clever — the differentiation is in *how well we hit the spec*, not in adding extras.

## Non-goals (v1)

If a feature isn't in SPEC.md or BUILD-INTENT.md's "four amplifiers" section, default to not building it. Explicit non-goals:

- No transcript editing — Deepgram output is what ships
- No support for Spotify-exclusive shows with no RSS feed (graceful "this episode can't be clipped" message instead)
- No claim moderation queue — claims write to the DB and email Tarik; manual review
- No multi-clip threads, AI summarization of clips, cross-source annotations, bookmark folders, or transcript translation

When tempted to add a feature, re-read this section first.

## Code conventions

- TypeScript strict mode everywhere; no `any`
- ESM only in source code
- pnpm for all package operations
- File names: kebab-case (`source-resolver.ts`)
- React components: PascalCase
- Convex functions: organized by table (`convex/annotations.ts`, `convex/sources.ts`); use camelCase
- Zod for runtime validation at every trust boundary (HTTP, Convex args, env)
- Imports order: external → `@annotated/*` workspace → relative
- One responsibility per file; split when a file exceeds ~200 lines

## Build order

Follow SETUP.md section 5 ("Build order"). Each step has a working demo at the end. Don't skip ahead — finish step N before starting step N+1. Update the marker below as we progress.

**Current step: 9 — COMPLETE (9a–9f done). Next: Step 10 (File-a-claim form submission + Resend email to Tarik — closes the spec).** — Step 9 (public feed + follow + comment + like, real-time Convex; + stood up the HeroUI Pro brutalism design system). **9a design system (the risk, spiked first):** the build-marker premise was wrong — `brutalism-light` isn't in base `@heroui/styles`; it ships in **`@heroui-pro/react`** (Pro). Registered the HeroUI Pro **MCP** (`claude mcp add … x-heroui-personal-token`; tools don't hot-load mid-session → driven via **curl JSON-RPC** to `https://mcp.heroui.pro/mcp`, stateless SSE). Pro pkg installed via `npx heroui-pro@latest login` (Tarik GitHub OAuth) + `pnpm dlx heroui-pro install --yes` (npm pkg is a **postinstall bootstrapper**; artifacts download from CDN via license; removed plan-excluded `heroui-native-pro`). Wired: `globals.css` `@import "tailwindcss" → "@heroui/styles/css" → "@heroui-pro/react/css" → "@heroui-pro/react/themes/brutalism"` (**explicit `/css` subpaths** — bare specifiers resolve to the JS export under Turbopack and silently bundle no CSS); `next/font` Share Tech Mono + Anton re-pointed to the theme's font vars; **always-on `brutalism-light` class** on `<html>` + next-themes toggling only the base `light`/`dark` token (a multi-token class value crashes DOMTokenList). HeroUI **v3 needs no provider**. **9b convex (auth-derived, author = Clerk identity):** `annotations.listFeed` (paginated, joins author+source+clipUrl) + `listByAuthor`; `follows.toggleFollow`/`isFollowing`/`getCounts` (rejects self); `comments.add`(++commentCount)/`listByAnnotation`; `likes.toggleLike`/`isLiked` (**likeCount recomputed from rows** — drift-proof, never negative); `users.getByUsername` + `requireCurrentUser` + `by_username` index. **9c feed (home):** real-time `usePaginatedQuery` cards (article/podcast/youtube preview, like, comment link, source link), load-more, `SiteHeader` (logo + theme toggle + Clerk + user-sync), `LikeButton` routes signed-out → sign-in. **9d `/a/[id]`:** like + follow + real-time comment thread/composer (auth-gated) alongside the quote + claim. **9e `/u/[username]`:** profile (avatar, follower/following counts, follow button) + the user's annotations; unknown → 404. **9f verification:** **convex-test** harness (`social.test.ts`, mocked Clerk identities) exercises the whole auth-gated flow (like/follow toggle idempotent + drift-proof counts, comment add+count, self-follow + unauth reject) — **clears Step-5 debt (a)**. **Verified REAL:** light/dark/landing/feed/profile screenshots; live `convex run`; backend 1/1 + shared 71/71 + worker 44/44 vitest; web `tsc` clean + production build (5 routes). **New debt:** (o) Vercel build needs `HEROUI_AUTH_TOKEN` + pnpm `onlyBuiltDependencies:["heroui-pro","@heroui-pro/react"]` for the Pro CDN postinstall; (p) browser-OAuth E2E (X/Google only) not automated — wire `@clerk/testing` for a true sign-in Playwright run; (q) `deriveUsername` can collide (no uniqueness); (r) official brutalism theme is mono-body (Share Tech Mono everywhere) — contradicts the old "mono for timestamps only" note, adopted faithfully, Tarik to confirm. **Step 8 (prior):** Step 8 (article path: detect → Mozilla Readability extract → highlight a span → publish; the cheapest source type, text only — no transcription/yt-dlp/ffmpeg/blob). **Fork (resolved w/ Tarik):** HTML source = **B primary** (content script sends `document.documentElement.outerHTML` — paywalls/JS resolved, no SSRF), **A fallback** (worker SSRF-guarded curl-fetch of url when no html). **8a worker `/extract-article`:** `parseArticle(html)` (TDD vs a real live-fetched NPR fixture; `@mozilla/readability`+`linkedom`; `isProbablyReaderable` gate so thin pages → null; cast to Readability's own API param types since the Node worker has no DOM lib) → `{title,textContent,byline,siteName}` · `extractArticleBodySchema` `{url(http(s)), html?}` · `isPubliclyFetchable` SSRF guard (blocks loopback/private/link-local **+ decimal/hex IPv4 + IPv6 loopback/ULA/link-local/`::ffff:` mapped** — WHATWG URL normalizes mapped IPv4 to hex) · `article-fetcher` curl `--http1.1` + **browser UA** (NPR HTTP/2-stream-errors (curl 92) on bot UAs) + `--proto`/`--max-redirs` · **Fastify `bodyLimit: 16MB`** (real outerHTML exceeds the 1MB default → silent 413). **8b shared (TDD):** `selectArticleHighlight(text,a,b)` → `{selectedText,textStart,textEnd,valid}` (normalize backwards, clamp oob, invalid on empty/whitespace). **8b extension:** `contents/article.ts` (detect `<article>`|`og:type=article`, returns outerHTML; excludes yt/apple/spotify) + `lib/messages.ts` `GET_ARTICLE_PAGE` + `use-active-tab-article.ts` + `worker-client.extractArticle` + `components/article-panel.tsx` (extract → render cleaned text `pre-wrap` so DOM Range offsets map exactly → highlight → take → publish, double-publish ref-lock; re-extract keyed on **url only** so html churn won't wipe an in-progress highlight) + `sidepanel.tsx` branch **youtube → explicit(apple/spotify) podcast → article → generic-RSS podcast** (og:type=article wins over a mere site RSS link). **8c convex:** `sources.upsertArticleSource` (dedup by canonicalUrl, stores siteName+author) · `testing.publishArticleClipDev` (token-guarded; **no `assertPublishable`** — articles have no span; own guards: non-empty quote+commentary, offset↔quote consistency `selectedText.length===textEnd-textStart`, 2000-char excerpt cap for fair-use) · `insertAnnotation` now persists `textStart`/`textEnd` · `getById` projects siteName+author. **8c landing `/a/[id]`:** article branch — quote as hero, **no media element** (no "clip unavailable"), "Clipped from · {siteName}", source link + claim (SPEC); range badge gated to non-article. **Verified REAL end-to-end:** real NPR Ebola article → live worker Readability (option A url-fetch + option B html both 200, 5947 chars; 1.11MB body → 200; metadata-IP → 502) → loaded-extension E2E (article wins over advertised RSS → extract → real DOM-range highlight → publish) → landing renders quote+siteName+source+claim, no media. Worker vitest 44/44, shared 71/71; worker/ext/web `tsc` clean; extension build OK. **`/simplify` (3 angles) fixed 6:** SSRF bypass (decimal/hex/IPv6), Fastify 1MB bodyLimit, getById dropped siteName/author, ungated range badge, publish offset/cap hardening, destructive re-extract. **New debt:** (k) canonicalUrl not normalized (utm/fragment → dedup miss + dirty source link) — fold a shared `normalizeCanonicalUrl` into Step 9 across all three upserts; (l) source metadata never refreshed on dedup (first writer wins); (m) article-vs-generic-RSS first-paint flicker (two independent hooks); (n) option-A fallback unreachable from the current extension flow (intentional, for direct callers / future). **Step 7 (prior):** Step 7 (podcast clip flow: transcribe → drag-select → 90s audio clip → publish). **7a worker `/clip-audio`:** `clipAudioBodySchema` (mp3Url http(s)-only — SSRF guard + reuse `evaluateClipSpan`) · `resolveFinalUrl` follows the tracking-redirect chain via **curl** (`-w %{url_effective}`; undici `fetch` stalls indefinitely on byspotify-prefixed URLs — curl resolves <1s) · `clipAudio` ffmpeg `-ss {start} -i {finalUrl} -t {dur} -c copy` (range-seek, +reconnect/rw_timeout) → mp3 in temp dir (always cleaned) · `clip-uploader` now takes a content-type (audio/mpeg) · route mirrors `/clip-youtube`. **7b transcribe wiring:** reuses existing `/transcribe` (sync Deepgram nova-3, diarize) unchanged — Deepgram fetches the enclosure itself; `worker-client.transcribePodcast` fires once when no transcript; `PodcastClipper` subscribes to `transcripts.getBySource`, surfaces trigger failures (no infinite "transcribing"). **7c canvas + publish:** shared `selectClipSpan` (TDD: span+quote from word range, empty/oob guards, 90s cap) · `TranscriptCanvas` (speaker-grouped words, tap-to-select, auto-quote, take, double-publish ref-lock) · `testing.publishPodcastClipDev` (token-guarded, existing podcast sourceId, rejects empty quote) · `insertAnnotation` persists `selectedText` · landing `/a/[id]` branches `<audio>` vs `<video>` on `source.type` + renders the quote. **Verified REAL end-to-end:** NPR Up First → live Deepgram (2911 words, 13 diarized speakers) → loaded-extension E2E (canvas → tap-select → auto-quote → publish) → real ffmpeg audio clip (ffprobe mp3, range-seek) → landing page plays the clip (audio src 206 audio/mpeg) + quote + source link + claim. Worker/ext/web `tsc` clean; shared 64 + worker 26 vitest green. **`/simplify` fixes:** undici→curl resolve (the hang), SSRF http(s)-only, empty-quote rejection, double-publish lock, transcribe-failure surfaced. **New debt:** (i) publish-after-clip failure orphans the audio blob (same as YouTube gap (d); no cleanup); (j) generic-podcast transcription of a long episode is a sync ~20-40s worker call (no progress streaming). **Step 6 (prior):** podcast detection → resolve to clippable episode MP3. **6a (prior):** `parsePodcastUrl` (Apple/Spotify URL → `PodcastRef`). **6b shared (TDD):** `parseRssFeed(xml)` → `{podcastName, episodes[{guid,title,pubDate,enclosureUrl}]}` (fast-xml-parser; real NPR fixture) + `matchEpisode` (GUID-first, normalized-title fallback, returns null on unresolved ambiguity — never guesses); shared suite 58/58. **6b convex:** `itunesCache` table (appleId→json, 7d); `cache.ts` internal get/set for itunes+rss; `sources.upsertPodcast` (dedup by `podcastEpisodeGuid`, else canonicalUrl); `podcasts.resolvePodcast` **action** (default runtime, `fetch` + `@annotated/shared`) — Apple via iTunes Lookup (`?i=`=episode trackId; enclosure direct from `entity=podcastEpisode`), generic via RSS `<link>`, Spotify → graceful unsupported. Caching is **best-effort** (skip >900KB for Convex's 1MB string cap — NPR's 1.8MB feed resolves fresh). Enclosure stored **verbatim** (tracking-redirect prefix intact; worker follows it in Step 7). **6c extension:** `contents/podcast-rss.ts` (reads RSS `<link rel=alternate>`, broad matches w/ youtube/apple/spotify excluded) + `lib/messages.ts` `GET_PODCAST_PAGE` + `lib/use-active-tab-podcast.ts` (URL→Apple/Spotify, content-script→generic; per-refresh sequence guard) + `components/podcast-panel.tsx` ("🎙 Podcast detected: [episode] — [show], Ready to clip" / Spotify graceful / silent). **Verified REAL:** live `convex run` (TAL Apple + NPR generic → real enclosures; dedup same sourceId; Spotify graceful); enclosures reach **206 audio/mpeg** through 5/3 tracking redirects; loaded-extension Playwright E2E all 4 UI states PASS; extension `tsc` + build clean. **`/simplify` fixes:** guarded iTunes `JSON.parse` (no cache-poison), `matchEpisode` null-on-ambiguity, explicit enclosure guard, detection-hook stale-overwrite race fixed. **New debt:** (f) generic path pins exact episode by page title only (else latest); Apple is exact. (g) podcast-rss injects on all http(s) pages (inherent to "any website" SPEC); on-demand `executeScript` is a later refinement. (h) old Apple episodes absent from the 200-item iTunes listing can't be pinned. **Step 5 (prior):** end-to-end YouTube clip decomposed. **5a:** worker `POST /clip-youtube` → yt-dlp section download + ffmpeg → 240p, ≤90s mp4 into Convex storage, returns `storageId` (ffprobe-verified). **5b:** Convex `sources.upsertYoutube` (dedup) + `annotations.create` (auth-derived) + `getById` (joins clip URL + source + author) + token-guarded `testing.seedAnnotation`. **5c:** Next.js `/a/[id]` landing page (Tailwind brutalism) — clip video + commentary + author + mono timestamp + visible source link (SPEC) + visible "File a claim" button (SPEC; form opens, submission is Step 10); Playwright-verified incl. 404 path. **5d:** extension sidepanel clip UI + publish — content script reads `video.html5-main-video` currentTime → "Set in/out from playback" + manual mm:ss override; brutalism UI (hand-rolled, no HeroUI yet); span validation via shared `clockToMs`/`evaluateClipSpan` (TDD); publish flow panel → worker `/clip-youtube` (CORS-free via host permission) → token-guarded `testing.publishYoutubeClipDev` (dev/seed author) → `/a/[id]`. Verified end-to-end in a **real loaded extension** (Playwright `--load-extension`, full publish + gate + error paths). Enabled `strict:true` in the extension tsconfig (was inheriting Plasmo's `strict:false`). **Known gaps / debt:** (a) auth-gated mutation guards still need a `convex-test` harness; (b) HeroUI v3 + brutalism-light design system still to be stood up before the feed (Step 9); (c) **extension publish auth is dev/seed only** — `publishYoutubeClipDev` is token-guarded and the worker token is bundled (DEV ONLY); real `syncHost` Clerk auth + routing publish through a Convex action (so the secret stays server-side) is a deferred step; (d) clip-fails-after-upload leaves an orphaned storage blob (no cleanup yet); (e) `MAX_CLIP_MS` 90s cap is duplicated in shared/convex/worker. Steps 1–4 done.

## Architecture orientation

Three tiers: **client** (extension + web app) → **services** (Clerk, Convex, Fly worker) → **external APIs** (iTunes Lookup, Podcast Index, Spotify, YouTube Data API, Deepgram).

The Fly.io worker is the heavy-lift service — ffmpeg, yt-dlp, and Deepgram calls all run there. The extension and web app talk to Convex; Convex calls the worker over HTTP for heavy operations and the worker writes results back via the Convex HTTP API. The worker is stateless and horizontally scalable.

See ARCHITECTURE.md for the full diagram and the podcast audio pipeline walkthrough.

## Teaching mode: Socratic Building

Default to the Socratic method when helping me build, design, or debug anything non-trivial. The win condition for a session is *I understand more*, not just *more code shipped*. Full methodology in the `socratic-builder` skill — read it before our first non-trivial move in a session.

**Non-negotiable moves:**
- Before coding a new concept: ask what I think the approach should be and why, before you write anything.
- When I propose something: probe it — edge cases, assumptions, what alternatives I considered.
- When I'm stuck: give the smallest hint that unblocks me, not the whole answer.
- After a concept lands: verify it stuck — "tell me back why X works" or "what breaks if we change Y?"
- End of a meaningful chunk: one-line reflection — what did I learn, what's still fuzzy.

**Bypass — drop Socratic and just do it — when:**
- I say "just do it", "ship it", "no socratic", "just write it", "skip the questions", "I'm in a hurry"
- Trivial work: typo, rename, formatting, mechanical refactor, repetitive boilerplate
- I've already shown mastery of the concept earlier in this session
- I'm in flow asking for the next concrete step

**Escape valve:** if I've struggled past ~2 question rounds on the same point, stop Socratic mode, explain directly, then circle back with one check-for-understanding question. Never let me thrash.

When ambiguous: ask once — "Walk this through Socratically, or just ship it?"

# Clean Code Standards

All code produced in this project must follow these clean code principles. These are non-negotiable defaults — not suggestions.

## Naming

- Every variable, function, and class name must clearly communicate its purpose. No single-letter names, no abbreviations unless universally understood (e.g., `id`, `url`).
- Use `numberOfUsers` not `n`. Use `calculateShippingCost` not `calc`.

## Functions

- Each function does ONE thing (Single Responsibility Principle). If you can describe what a function does using "and," split it.
- Keep functions under 20 lines. If longer, extract helper functions.
- Prefer small, composable functions over large monolithic ones.

## Comments

- Code should be self-explanatory. Comments explain WHY, never WHAT or HOW.
- Bad: `// Loop through users` — Good: `// Retry failed users from the last sync batch`
- Delete comments that restate the code. Outdated comments are worse than no comments.

## Formatting & Consistency

- Use consistent indentation (2 or 4 spaces — pick one, never mix).
- Group related logic with blank lines. Separate concerns visually.
- Use Prettier/ESLint or equivalent formatter. Every file should look like the same person wrote it.

## No Hardcoded Values

- Extract magic numbers and strings into named constants or config.
- Bad: `if (users >= 100)` — Good: `if (users >= MAX_USERS)`

## Project Structure

- Organize by concern: `components/`, `services/`, `utils/`, `tests/`.
- Keep test files outside `src/` in a mirrored structure.
- Never dump everything in one directory.

## Error Handling

- Fail fast. Throw meaningful errors with clear messages.
- Use try/catch blocks. Never silently swallow errors.
- Log like you're documenting a crime scene: precise, relevant, minimal.

## Testing

- Write unit tests for every function with logic.
- Tests should be as clean as production code.
- Test edge cases, not just the happy path.

## Dependency Injection

- Pass dependencies as arguments rather than hardcoding them.
- This makes code testable and swappable.

## The Boy Scout Rule

- Leave every file cleaner than you found it.
- When touching existing code: rename unclear variables, extract messy functions, remove dead code.

## Open/Closed Principle

- Design for extension, not modification. Use polymorphism and composition.
- Adding a new feature should not require rewriting existing working code.

## Code Smells to Fix on Sight

- Duplicated logic → extract into a shared function
- God objects doing everything → split responsibilities
- Long parameter lists → use an options/config object
- Nested conditionals 3+ levels deep → extract or invert early returns
