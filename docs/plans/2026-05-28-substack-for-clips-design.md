# Substack-for-Clips — Design (4 features)

**Date:** 2026-05-28
**Status:** Validated in brainstorm; ready for implementation planning.
**Goal lens:** **Win the bounty** — "cleanest and most complete execution." These four are beyond-spec growth (the bounty is already spec-complete); they make Annotated read and demo as a real platform.

## Build order (deadline ~1 week; ship highest-leverage first)
1. **#1 Avatar-forward feed** — cheap, immediately visible, defines the identity treatment #2 + #4 reuse.
2. **#3 Hybrid web composer** — the centerpiece + biggest build; do early for runway.
3. **#4 Save-as-image** — self-contained wow; reuses #1's avatar treatment.
4. **#2 /@username profiles** — alias + polish; lowest marginal bounty value, safe to land last or cut.

## Schema delta (total)
Only one optional field: `users.isVerified: v.optional(v.boolean())` (from #1). Everything else (`bio`, `xHandle`, `avatarUrl`, the authed `create{Article,Podcast}` mutations, topics) already exists.

---

## #1 — Avatar-forward feed cards
Today the card header leads with the type label + time; the author is a buried "clipped by {name}" text line. Lead with **who** instead (Substack Notes style).
- Restructure the card top row: `[avatar] [displayName] · [relative time] ····· [small type chip]`. Big type label → small chip (kept as signal); drop the "clipped by" line.
- **New `AuthorAvatar` component** (reused by #2 + #4): **square** (brutalist), ~30px, hard 3px black border; renders `avatarUrl`, else a square initial block in acid-on-chrome. Anonymous → neutral square, name "Anonymous". Links to the author profile.
- **Verified badge:** add optional `users.isVerified` (off by default, set manually for Tarik/publishers → reads as a real platform); small acid check next to verified names.
- Files: `apps/web/app/_components/annotation-card.tsx` (header refactor), new `author-avatar.tsx`, `schema.ts` (+`isVerified`), `toFeedItem` projection (+`isVerified`).

## #3 — Hybrid web composer (article + podcast; YouTube deferred)
"Paste a link → sidebar experience in a modal" — create annotations on annotated.sh with **zero extension install** (the bounty-demo lever). Verified: the worker/actions already resolve all source types server-side from a URL (`extract-article` fetches when no HTML; `resolvePodcast` action; yt-dlp).
- **Entry:** "New clip" button → composer **modal**. Step 1 = URL input + paste; detect type via shared `extractYoutubeVideoId` / `parsePodcastUrl`.
- **Server-side fetch (key shift):** web must NOT bundle the worker token. Call the worker **through Convex actions** (token stays server-side — also retires the bundled-token debt for web):
  - Article: new thin action wrapping worker `/extract-article` ({url}).
  - Podcast: existing `resolvePodcast` action (+ Deepgram transcript).
  - YouTube: **deferred** — needs an embedded-player span-picker; modal shows "YouTube clipping is in the extension."
- **Flow:** paste → resolve → select (article: highlight text → `selectArticleHighlight`; podcast: drag-select transcript → `selectClipSpan`, 90s cap) → annotate (commentary text/audio + `TopicPicker` 1–3 required + anonymous toggle) → **publish via existing `createArticle`/`createPodcast`** → redirect to `/a/[id]`.
- **Component reuse:** the extension composer components have **zero `chrome.*` coupling** and the selection logic is already in `@annotated/shared`. **Port the JSX to web twins** (`ArticleClipPane`, `PodcastClipPane`, web `TopicPicker`/`CommentaryComposer`) wired to Convex data — not a risky shared refactor mid-bounty.
- **Web bonus:** voice commentary is *easier* on web (normal `getUserMedia`; the extension needed an active-tab hack).
- **Styling:** hard-bordered brutalist dialog (acid/offset-shadow) — the sidepanel, in a modal.
- **YAGNI:** no draft-save, no threads, no YouTube in v1.

## #4 — Save-as-image (Stories + Grid)
Extends the **existing** `og-card.tsx` + `next/og` `ImageResponse` infra (already renders 1200×630 brand cards for `/a` + `/t`, fonts solved).
- **New route:** `app/a/[id]/card/route.tsx?format=story|grid` → fetch annotation (same `ConvexHttpClient` path as `opengraph-image.tsx`) → PNG via `ImageResponse`. **Story** 1080×1920, **Grid** 1080×1080.
- **Card design (brutalist, reuses #1 avatar):** quote/commentary as hero (Archivo Black, acid accent block); author avatar + name + verified; source attribution + **annotated.sh** wordmark (drives the share→traffic loop). Anonymous → no identity.
- **UI:** "Save as image" action on `/a/[id]` (mirrors Substack's ··· menu) → preview dialog with **Story/Grid toggle** + **Download**.
- **Satori gotcha:** no text auto-shrink → size the quote in tiers / clamp with ellipsis.
- **YAGNI:** PNG only, 2 formats, no editor.

## #2 — /@username profiles
Alias + polish over the existing `/u/[username]` page (which already lists clips, counts, follow).
- **Routing gotcha:** Next reserves `@folder` for parallel routes — can't make `app/@[username]`. Use a **rewrite in `proxy.ts`** (already runs `clerkMiddleware`): `/@:username` → serves `/u/[username]`. Address bar shows `/@handle`; update author links + canonical to the `@` form.
- **Profile polish (Substack-creator feel):** real avatar (reuse `AuthorAvatar`) + verified; prominent `@username`; render **bio** + **X link** (`bio`/`xHandle` already in schema, just unrendered); cleaner brutalist header block; clips grid below (already wired).
- **No schema change** (fields exist). **YAGNI:** no profile-edit UI, no banners in v1.

---

## Carry-forward notes
- Prod deploys from this worktree (`feat/topics-ranked-feeds`), Convex `strong-eel-665` shared — **ask before `convex dev --once`**.
- Open follow-ups unrelated to these features (rotate `sk_live`, store-ID→Clerk allowlist after Web Store upload, listing screenshots, eyeball brutalist redesign) — see handoff.
