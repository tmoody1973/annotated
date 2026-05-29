# #4 Save-as-image Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any clip on annotated.sh be downloaded as a face-forward share image — an Instagram **Story** (1080×1920) or square **Grid** (1080×1080) card — via a "Save as image" dialog on `/a/[id]`.

**Architecture:** A new Next.js Route Handler `app/a/[id]/card/route.tsx` renders a PNG with `next/og` `ImageResponse` (Satori), reading the annotation through the existing `ConvexHttpClient` + `annotations:getById` path. A Satori-safe `ShareCard` component draws the brutalist card (quote + commentary + author avatar/name/verified + annotated.sh wordmark) in two layouts. A brutalist `SaveImageDialog` client component previews the card via `<img>` and downloads it via an `<a download>` to the route with `&dl=1` (which sets `Content-Disposition: attachment`). The only backend change is adding `avatarUrl` to `getById`'s author projection.

**Tech Stack:** Next.js 16 App Router Route Handler, `next/og` `ImageResponse` (Satori), `convex/browser` `ConvexHttpClient` + `makeFunctionReference`, `@annotated/shared` (`splitSlugId`, `slugId`, `authorInitials`), brutalist `--b-*` tokens (hard-coded hex in Satori — it can't read CSS vars).

**Design source:** `docs/plans/2026-05-29-substack-4-save-as-image-design.md`.

**Branch:** continue on `feat/topics-ranked-feeds`.

**Scope guards (YAGNI):** PNG only; exactly 2 formats (Story, Grid); no in-browser editor; no custom colors; no new env vars; no new Convex functions (only the `getById` projection add). Anonymous clips render a neutral card (no avatar, name "Anonymous", no verified).

**Verification reality:** Satori card rendering is not unit-tested (matches the existing `og-card.tsx` precedent — there are no tests for it). It is verified by hitting the route live and eyeballing the PNGs. The backend projection change is verified by `tsc` + the existing convex-test suite still passing. Do NOT run `convex dev`/`convex deploy` during local tasks — that is the gated final step (shared live deployment `strong-eel-665`; see CLAUDE.md memory).

---

## File Structure
- **Modify:** `packages/backend/convex/annotations.ts` — add `avatarUrl` to the `getById`/`toLandingView` author projection (~line 544-551).
- **Create:** `apps/web/app/_components/share-card.tsx` — the Satori-safe card component (two layouts).
- **Create:** `apps/web/app/a/[id]/card/route.tsx` — the Route Handler returning the PNG.
- **Create:** `apps/web/app/a/[id]/save-image-dialog.tsx` — the client preview/download dialog.
- **Modify:** `apps/web/app/a/[id]/page.tsx` — add `avatarUrl` to the `AnnotationView` author type + mount `<SaveImageDialog>` in the action row.

---

## Task 1: Add `avatarUrl` to the `getById` author projection

**Files:**
- Modify: `packages/backend/convex/annotations.ts` (the `toLandingView` author projection, ~line 544-551)

- [ ] **Step 1: Add the field**

In `packages/backend/convex/annotations.ts`, find the author projection inside `toLandingView` (the function `getById` calls). It currently reads:

```ts
    author: author
      ? {
          id: author._id,
          username: author.username,
          displayName: author.displayName,
          isVerified: author.isVerified ?? false,
        }
      : null,
```

Change it to add `avatarUrl` (the `users` table has `avatarUrl: v.optional(v.string())`; `toFeedItem` already projects it the same way):

```ts
    author: author
      ? {
          id: author._id,
          username: author.username,
          displayName: author.displayName,
          avatarUrl: author.avatarUrl,
          isVerified: author.isVerified ?? false,
        }
      : null,
```

- [ ] **Step 2: Typecheck (no deploy)**

Run: `cd packages/backend && npx tsc --noEmit`
Expected: clean (no new errors). Do NOT run `convex dev`/`convex deploy`.

- [ ] **Step 3: Run the backend test suite (confirm no regression)**

Run: `cd packages/backend && pnpm vitest run`
Expected: all pass (the change only adds an optional field to the projection).

- [ ] **Step 4: Commit**

```bash
git add packages/backend/convex/annotations.ts
git commit -m "feat(backend): project author avatarUrl in getById (for share cards)"
```

---

## Task 2: `ShareCard` Satori component

**Files:**
- Create: `apps/web/app/_components/share-card.tsx`

Satori constraints (learned from `og-card.tsx`): every container needs an explicit `display: "flex"`; no CSS variables (hard-code hex); no external React components that rely on runtime CSS; no text auto-shrink (clamp long text). Palette from the brutalist theme: bg `#f4f1e8`, ink `#111111`, acid `#ffe600`, acid-ink `#111111`, dim `#555555`.

- [ ] **Step 1: Create the component**

`apps/web/app/_components/share-card.tsx`:
```tsx
import { authorInitials } from "@annotated/shared";

export type ShareFormat = "story" | "grid";

export interface ShareCardData {
  quote: string;
  commentary?: string;
  authorName?: string; // undefined => anonymous
  avatarUrl?: string | null;
  isVerified?: boolean;
  sourceTitle?: string;
  sourceType: string;
}

const COLORS = {
  bg: "#f4f1e8",
  ink: "#111111",
  acid: "#ffe600",
  acidInk: "#111111",
  dim: "#555555",
} as const;

function clamp(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function typeLabel(sourceType: string): string {
  switch (sourceType) {
    case "podcast":
      return "Podcast";
    case "youtube":
      return "Video";
    case "article":
      return "Article";
    default:
      return "Clip";
  }
}

/** Square avatar (photo or acid initials block) sized for the card. Inline —
 *  Satori can't render the app's AuthorAvatar component (it relies on CSS vars). */
function CardAvatar({
  authorName,
  avatarUrl,
  size,
}: {
  authorName: string;
  avatarUrl?: string | null;
  size: number;
}) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          border: `3px solid ${COLORS.ink}`,
          objectFit: "cover",
        }}
      />
    );
  }
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        border: `3px solid ${COLORS.ink}`,
        background: COLORS.acid,
        color: COLORS.acidInk,
        fontSize: Math.round(size * 0.42),
        fontWeight: 700,
      }}
    >
      {authorInitials(authorName) || "·"}
    </div>
  );
}

/**
 * The downloadable share card rendered by `next/og` (Satori). Two layouts off
 * `format`: Story (1080×1920, taller hero) and Grid (1080×1080, compact). The
 * annotated.sh wordmark anchors the bottom — it drives the share→traffic loop.
 */
export function ShareCard({
  data,
  format,
}: {
  data: ShareCardData;
  format: ShareFormat;
}) {
  const isStory = format === "story";
  const pad = isStory ? 88 : 64;
  const quoteSize = isStory ? 72 : 60;
  const commentarySize = isStory ? 34 : 30;
  const avatarSize = isStory ? 72 : 60;
  const identitySize = isStory ? 34 : 30;
  const quoteMax = isStory ? 220 : 180;
  const commentaryMax = isStory ? 200 : 140;
  const anonymous = !data.authorName;
  const name = data.authorName ?? "Anonymous";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: COLORS.bg,
        color: COLORS.ink,
        padding: `${pad}px`,
        borderLeft: `28px solid ${COLORS.acid}`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: isStory ? 34 : 28,
          fontWeight: 700,
          letterSpacing: 2,
          textTransform: "uppercase",
        }}
      >
        <div style={{ display: "flex" }}>Annotated</div>
        <div
          style={{
            display: "flex",
            border: `3px solid ${COLORS.ink}`,
            padding: "6px 18px",
            fontSize: isStory ? 28 : 22,
          }}
        >
          {typeLabel(data.sourceType)}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          marginTop: isStory ? 80 : 48,
          fontSize: quoteSize,
          fontWeight: 700,
          lineHeight: 1.12,
        }}
      >
        “{clamp(data.quote, quoteMax)}”
      </div>

      {data.commentary && (
        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: commentarySize,
            lineHeight: 1.3,
            color: COLORS.dim,
          }}
        >
          {clamp(data.commentary, commentaryMax)}
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginTop: "auto",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {!anonymous && (
            <CardAvatar
              authorName={name}
              avatarUrl={data.avatarUrl}
              size={avatarSize}
            />
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: identitySize, fontWeight: 700 }}>
            {name}
            {!anonymous && data.isVerified && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: Math.round(identitySize * 0.8),
                  height: Math.round(identitySize * 0.8),
                  background: COLORS.acid,
                  color: COLORS.acidInk,
                  fontSize: Math.round(identitySize * 0.5),
                  fontWeight: 700,
                }}
              >
                ✓
              </div>
            )}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: isStory ? 28 : 24,
            color: COLORS.dim,
          }}
        >
          <div style={{ display: "flex" }}>
            {data.sourceTitle ? clamp(data.sourceTitle, 56) : ""}
          </div>
          <div style={{ display: "flex", color: COLORS.ink, fontWeight: 700 }}>
            annotated.sh
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: clean for this file (it imports only `@annotated/shared`).

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/_components/share-card.tsx
git commit -m "feat(web): ShareCard Satori component (Story + Grid layouts)"
```

---

## Task 3: Card Route Handler (PNG endpoint)

**Files:**
- Create: `apps/web/app/a/[id]/card/route.tsx`

This is a Next.js Route Handler (not the special `opengraph-image.tsx` convention) so it can read `?format` / `?dl` and set `Content-Disposition`. `ImageResponse` extends `Response`, so headers can be passed in its options. Mirrors the Convex-fetch pattern in `apps/web/app/a/[id]/opengraph-image.tsx` (default nodejs runtime — do NOT add `runtime = "edge"`; that broke Turbopack page-data collection in #3).

- [ ] **Step 1: Create the route**

`apps/web/app/a/[id]/card/route.tsx`:
```tsx
import { ImageResponse } from "next/og";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { splitSlugId, slugId } from "@annotated/shared";
import { ShareCard, type ShareFormat, type ShareCardData } from "../../../_components/share-card";

interface CardAnnotation {
  _id: string;
  selectedText?: string;
  commentaryText?: string;
  commentaryAudioTranscript?: string;
  isAnonymous?: boolean;
  source: { title: string; type: string } | null;
  author: { displayName: string; avatarUrl?: string | null; isVerified?: boolean } | null;
}

const getById = makeFunctionReference<
  "query",
  { annotationId: string },
  CardAnnotation | null
>("annotations:getById");

const STORY = { width: 1080, height: 1920 };
const GRID = { width: 1080, height: 1080 };

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: param } = await params;
  const { id } = splitSlugId(param);
  const url = new URL(request.url);
  const format: ShareFormat = url.searchParams.get("format") === "story" ? "story" : "grid";
  const download = url.searchParams.get("dl") === "1";
  const size = format === "story" ? STORY : GRID;

  let data: ShareCardData = { quote: "A clip on Annotated", sourceType: "" };
  let slug = "clip";
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (convexUrl) {
    try {
      const annotation = await new ConvexHttpClient(convexUrl).query(getById, {
        annotationId: id,
      });
      if (annotation) {
        const anonymous = annotation.isAnonymous === true;
        data = {
          quote:
            annotation.selectedText ??
            annotation.commentaryText ??
            annotation.commentaryAudioTranscript ??
            "A clip on Annotated",
          commentary: annotation.selectedText ? annotation.commentaryText : undefined,
          authorName: anonymous ? undefined : annotation.author?.displayName,
          avatarUrl: anonymous ? undefined : annotation.author?.avatarUrl,
          isVerified: anonymous ? false : annotation.author?.isVerified,
          sourceTitle: annotation.source?.title,
          sourceType: annotation.source?.type ?? "",
        };
        slug = slugId(annotation.source?.title ?? "clip", annotation._id);
      }
    } catch {
      // Bad id (fails Convex v.id validation) — render the default card, never 500.
    }
  }

  const headers: Record<string, string> = {};
  if (download) {
    headers["Content-Disposition"] = `attachment; filename="annotated-${slug}-${format}.png"`;
  }

  return new ImageResponse(<ShareCard data={data} format={format} />, {
    ...size,
    headers,
  });
}
```

- [ ] **Step 2: Typecheck + build**

Run: `cd apps/web && npx tsc --noEmit && pnpm build`
Expected: clean; build succeeds. Confirm the route appears in the build output as `ƒ /a/[id]/card`.

- [ ] **Step 3: Verify the PNG renders locally**

Start (or reuse) the dev server: from `apps/web`, `PORT=3001 pnpm dev` (env already in `apps/web/.env.local`). Then in a browser or curl, against a real published clip id (get one from the feed, e.g. visit `/` and copy an `/a/...` slug):

Run: `curl -s -o /tmp/card-grid.png -w "status=%{http_code} type=%{content_type} bytes=%{size_download}\n" "http://localhost:3001/a/<real-slug>/card?format=grid"`
Expected: `status=200 type=image/png bytes=<nonzero>`.
Repeat with `?format=story` and with `?format=grid&dl=1` (the `dl` variant should additionally carry a `Content-Disposition` header — check with `curl -sI`). Open `/tmp/card-grid.png` and eyeball: quote hero, avatar+name+✓ if verified, `annotated.sh` bottom-right.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/a/[id]/card/route.tsx
git commit -m "feat(web): /a/[id]/card route renders Story/Grid share PNG"
```

---

## Task 4: `SaveImageDialog` + mount on the clip page

**Files:**
- Create: `apps/web/app/a/[id]/save-image-dialog.tsx`
- Modify: `apps/web/app/a/[id]/page.tsx` (add `avatarUrl` to `AnnotationView` author type; mount the dialog in the action row)

- [ ] **Step 1: Create the dialog**

`apps/web/app/a/[id]/save-image-dialog.tsx` (client component; brutalist modal mirroring `ArticleClipModal`/`ClaimButton` patterns; previews via `<img>`, downloads via `<a download>`):
```tsx
"use client";

import { useState } from "react";

type Format = "story" | "grid";

/** "Save as image" — opens a brutalist dialog with a Story/Grid toggle, a live
 *  preview of the share card, and a Download button (an <a download> hitting the
 *  /card route with &dl=1, which sets Content-Disposition: attachment). */
export function SaveImageDialog({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<Format>("grid");

  const cardUrl = `/a/${slug}/card?format=${format}`;
  const downloadUrl = `${cardUrl}&dl=1`;

  const triggerClass =
    "border-2 border-[color:var(--b-line)] bg-[color:var(--b-card)] px-3 py-1.5 text-[13px] font-black uppercase tracking-wide text-[color:var(--b-ink)] hover:bg-[color:var(--b-acid)]";

  return (
    <>
      <button className={triggerClass} onClick={() => setOpen(true)}>
        Save as image
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-8"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] text-[color:var(--b-ink)] shadow-[8px_8px_0_0_var(--b-shadow)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b-[3px] border-[color:var(--b-line)] bg-[color:var(--b-chrome)] px-4 py-3 text-[color:var(--b-card)]">
              <span className="font-display text-lg tracking-tight">SAVE AS IMAGE</span>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-xl font-black">×</button>
            </div>
            <div className="flex flex-col gap-4 p-4">
              <div className="flex gap-2">
                {(["story", "grid"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={`border-2 border-[color:var(--b-line)] px-3 py-1.5 font-mono text-[12px] font-bold uppercase tracking-wide ${
                      format === f
                        ? "bg-[color:var(--b-acid)] text-[color:var(--b-acid-ink)]"
                        : "bg-[color:var(--b-card)] text-[color:var(--b-ink)]"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <div className="flex justify-center border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-bg)] p-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- dynamic PNG from our own route */}
                <img
                  key={format}
                  src={cardUrl}
                  alt="Share card preview"
                  className={format === "story" ? "max-h-[50vh] w-auto" : "w-full"}
                />
              </div>
              <a
                href={downloadUrl}
                download
                className="border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-acid)] px-4 py-2 text-center font-black uppercase tracking-wide text-[color:var(--b-acid-ink)] shadow-[4px_4px_0_0_var(--b-shadow)]"
              >
                Download PNG
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Add `avatarUrl` to the page's author type**

In `apps/web/app/a/[id]/page.tsx`, the `AnnotationView` interface's `author` field currently is:
```ts
  author: { id: string; username: string; displayName: string } | null;
```
Change it to include `avatarUrl` (so the type matches the now-richer `getById` projection; the page itself doesn't have to use it, but the type should be accurate):
```ts
  author: { id: string; username: string; displayName: string; avatarUrl?: string | null } | null;
```

- [ ] **Step 3: Mount the dialog on the clip page**

In `apps/web/app/a/[id]/page.tsx`, add the import near the other local imports (e.g. after `import { ClaimButton } from "./claim-button";`):
```ts
import { SaveImageDialog } from "./save-image-dialog";
```
Then mount it in the action row. That row currently is:
```tsx
        <div className="mt-6 flex items-center gap-3">
          <VoteButtons
            annotationId={annotation._id}
            upCount={annotation.likeCount}
            downCount={annotation.downCount}
          />
          {annotation.author && (
            <FollowButton targetUserId={annotation.author.id} />
          )}
        </div>
```
Add `<SaveImageDialog>` as the last child of that flex row (it uses the canonical slug already computed as `canonicalParam` in the component scope):
```tsx
        <div className="mt-6 flex items-center gap-3">
          <VoteButtons
            annotationId={annotation._id}
            upCount={annotation.likeCount}
            downCount={annotation.downCount}
          />
          {annotation.author && (
            <FollowButton targetUserId={annotation.author.id} />
          )}
          <SaveImageDialog slug={canonicalParam} />
        </div>
```
(`canonicalParam` is defined earlier in `AnnotationPage` as `slugId(annotation.source?.title ?? "clip", annotation._id)` — confirm it is in scope at the action row; it is, since the row is rendered after that line.)

- [ ] **Step 4: Typecheck + build**

Run: `cd apps/web && npx tsc --noEmit && pnpm build`
Expected: clean; build succeeds.

- [ ] **Step 5: Verify in the browser (local)**

With the dev server running (`PORT=3001 pnpm dev` from `apps/web`), open a real clip `http://localhost:3001/a/<real-slug>`, click **Save as image**: the dialog opens, the preview renders, toggling Story/Grid swaps the preview, and **Download PNG** saves a file. Eyeball both formats.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/a/[id]/save-image-dialog.tsx apps/web/app/a/[id]/page.tsx
git commit -m "feat(web): Save-as-image dialog on the clip page"
```

---

## Task 5: GATED deploy + live verification

**This task touches the shared live deployment. STOP and get Tarik's explicit go-ahead before any `convex`/`vercel` command (see CLAUDE.md memory: live site = Convex `strong-eel-665`; deploy web from the worktree ROOT, never `apps/web`).**

- [ ] **Step 1: Confirm full local green**

`cd packages/backend && npx tsc --noEmit && pnpm vitest run` ; `cd apps/web && npx tsc --noEmit && pnpm build` — all clean.

- [ ] **Step 2: ASK Tarik, then deploy backend**

The `avatarUrl` projection must be registered on the live deployment. From `packages/backend`, with NO `--prod` flag (default targets `strong-eel-665`, the deployment annotated.sh actually reads):
```bash
cd packages/backend
npx convex dev --once   # registers the updated getById projection
```
Confirm the echo says `strong-eel-665`, NOT `colorful-beagle-118`.

- [ ] **Step 3: Deploy web** (Tarik-approved): from the worktree ROOT, `npx vercel --prod --yes`. Confirm `cat .vercel/project.json` shows `projectName:"annotated"` first.

- [ ] **Step 4: Live verification** (browser): on a real annotated.sh clip → click **Save as image** → preview renders → toggle Story/Grid → **Download PNG** saves a file → open it and confirm avatar + name + ✓ (verified author) + `annotated.sh` wordmark. Also hit `/a/<slug>/card?format=story` and `?format=grid` directly (200, image/png), and an anonymous clip (no avatar, "Anonymous"). Screenshot for the record.

---

## Self-Review
- **Spec coverage (#4 design):** Story+Grid PNG via Route Handler → Task 3; Satori card reusing #1 avatar/verified identity → Task 2; backend `avatarUrl` projection (the one real gap) → Task 1; preview dialog + Story/Grid toggle + download → Task 4; anonymous handling → Tasks 2+3 (`authorName` undefined path). ✓
- **No new env/functions:** route reuses `NEXT_PUBLIC_CONVEX_URL` + `getById`; no new Convex function, no new env var. ✓
- **Type consistency:** `ShareCardData`/`ShareFormat` defined in Task 2 are imported verbatim in Task 3; `CardAnnotation.author` (Task 3) and `AnnotationView.author` (Task 4) both carry `avatarUrl?: string | null`, matching the Task 1 projection (`author.avatarUrl`, optional on the users table); `slugId(title, id)` and `splitSlugId` usage matches existing `page.tsx`/`opengraph-image.tsx`. ✓
- **Runtime gotcha encoded:** Task 3 explicitly says do NOT add `runtime="edge"` (it broke Turbopack page-data collection in #3) — default nodejs. ✓
- **Satori gotchas encoded:** explicit flex everywhere, hard-coded hex (no CSS vars), text clamping (no auto-shrink). ✓
- **Deploy gotchas encoded:** Task 5 — deploy web from ROOT (not apps/web), backend with no `--prod` (target `strong-eel-665`), both gated. ✓
- **Testing reality:** Satori rendering verified by live route hits (matches `og-card.tsx` precedent — no unit test); backend change covered by `tsc` + existing vitest. Intentional, documented. ✓
