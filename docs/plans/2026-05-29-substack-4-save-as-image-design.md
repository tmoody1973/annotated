# #4 Save-as-image — Design

**Date:** 2026-05-29
**Status:** DESIGN — validated with Tarik, ready to turn into an implementation plan.
**Branch:** continue on `feat/topics-ranked-feeds`.

## Goal
Any clip on annotated.sh can be turned into a downloadable, face-forward share image — an Instagram **Story** (1080×1920) or a square **Grid** (1080×1080) card — reusing the #1 avatar identity treatment. This closes the share→traffic loop (the same loop the 2026-05-28 OG-domain fix repaired: `og:image`/canonical now point at `annotated.sh`, not the stale `annotated-eight.vercel.app`).

## Context / what already exists (verified 2026-05-29)
- `next/og` `ImageResponse` (Satori) already renders 1200×630 OG cards for `/a` and `/t` via `opengraph-image.tsx` — fonts and the brutalist palette are already solved in `apps/web/app/_components/og-card.tsx`.
- The clip page already fetches its annotation server-side with `ConvexHttpClient` + the `annotations:getById` string ref (`apps/web/app/a/[id]/opengraph-image.tsx`). The card route reuses this exact path.
- `getById` (`packages/backend/convex/annotations.ts`) projects author `{id, username, displayName}` plus a top-level `isVerified`. **It does NOT project `avatarUrl`.** The `users` table HAS `avatarUrl`, `displayName`, `username`, `isVerified` — so the only backend gap is the projection.

## Architecture (4 pieces)

### 1. Backend (one-line projection change)
Add `avatarUrl: author?.avatarUrl ?? null` to `getById`'s return in `annotations.ts` (alongside the existing `author` object / `isVerified`). No schema change, no new function. This is the only backend work.

### 2. Card route — `app/a/[id]/card/route.tsx`
- Reads `?format=story|grid` (default `grid`).
- Fetches the annotation via `ConvexHttpClient` + `getById` (same pattern as `opengraph-image.tsx`), keyed on the id parsed from the slug with `splitSlugId`.
- Renders a PNG with `next/og` `ImageResponse` at the format's dimensions: **story** = `{width:1080,height:1920}`, **grid** = `{width:1080,height:1080}`.
- When `?dl=1`, set `Content-Disposition: attachment; filename="annotated-<slug>.png"` so the link downloads instead of rendering inline. Without `dl`, render inline (so the dialog `<img>` can preview it).
- Bad/unknown id → fall back to a default card (mirror `opengraph-image.tsx`'s try/catch), never 500.

### 3. Share card component — `app/_components/share-card.tsx`
- Satori-safe: explicit flexbox on every container, no React `AuthorAvatar` (Satori can't run it). Inline `<img src={avatarUrl}>` for the avatar; square initial block (acid-on-chrome, using shared `authorInitials`) when no avatar.
- Renders: type chip + ANNOTATED wordmark (top), quote as hero, optional commentary, then identity row = **avatar + displayName + verified ✓** and source attribution, with the **annotated.sh** wordmark anchored bottom (the traffic driver).
- Two layouts off the `format` prop: Story is taller (more vertical breathing room, larger hero), Grid is compact square. Share the same sub-pieces.
- **Anonymous** clips (`isAnonymous`): neutral square, name "Anonymous", no avatar, no verified.
- **Satori gotcha:** no text auto-shrink. Size the quote in tiers by length (or clamp with ellipsis like `og-card.tsx`'s `clamp`). Reuse the existing clamp helper pattern.

### 4. UI — preview dialog
- A "Save as image" action on `/a/[id]` (near the vote/follow row) opens `app/_components/save-image-dialog.tsx`: a brutalist modal (hard border + offset shadow, matching `ArticleClipModal`).
- Dialog body: a **Story / Grid toggle** and a live preview via `<img src={/a/[id]/card?format=...}>`.
- A **Download** button = `<a href={/a/[id]/card?format=...&dl=1} download>` — no client blob code, no extra deps. The route's `Content-Disposition` does the rest.

## Data flow
clip page action → open dialog → `<img>` GET `/a/[id]/card?format=F` → route fetches `getById` from Convex (`strong-eel-665`, the live deployment) → Satori PNG → preview; Download = same route with `&dl=1` → attachment.

## Scope guards (YAGNI)
- PNG only; exactly 2 formats (Story, Grid); no in-browser editor; no custom colors/themes; reuse the brutalist palette from `og-card.tsx`.
- No new env vars. No new Convex functions (only the `getById` projection addition).

## Testing / verification
- Satori card rendering isn't unit-tested (matches the existing `og-card.tsx` precedent); verify by hitting `/a/[id]/card?format=story` and `?format=grid` live and eyeballing both PNGs, plus a `&dl=1` download, plus an anonymous clip.
- Backend projection change is covered by the existing `getById` consumers compiling; optionally assert `avatarUrl` present in the convex-test for getById if one exists.

## Sequencing note
Builds on #1 (avatar/verified identity, live) and #3 (composer, live). The OG-domain fix (`SITE_URL` → annotated.sh, committed `039131d`, empty Vercel env var removed) is a prerequisite already landed. #2 (/@username profiles) is the remaining feature after this.
