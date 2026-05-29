# #3 Web Composer (Article-only) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in user create an **article** annotation on annotated.sh with **zero extension install** — paste a URL in a modal, the worker fetches + cleans it server-side, highlight a passage, add commentary + topics, publish. Delivers the bounty's "a judge can create a clip without installing anything" thesis.

**Architecture:** A new Convex **action** `articles.extractArticle({url})` calls the worker's `/extract-article` server-side (token stays server-side — no bundled token on the web). The web ConvexProvider is already Clerk-authed, so publishing reuses the existing `api.annotations.createArticle` mutation directly via `useMutation` (no token dance). The composer is a brutalist modal reusing the shared `selectArticleHighlight` logic; the highlight interaction ports the extension's pre-wrap-text + DOM-Range-offset technique.

**Tech Stack:** Convex action (Node `fetch`), Next.js 16 App Router client components, `@annotated/shared` (`selectArticleHighlight`, `extractYoutubeVideoId`, `parsePodcastUrl`), brutalist `--b-*` tokens.

**Design source:** `docs/plans/2026-05-28-substack-for-clips-design.md` (#3, scoped article-only per the 2026-05-28 decision; podcast-web is a documented fast-follow).

**Branch:** continue on `feat/topics-ranked-feeds`.

**Scope guards (YAGNI):** article only (YouTube/podcast → "use the extension" hint); **text commentary only** (audio recording is a fast-follow); no draft-save; no threads; no screenshot.

**Backend env (GATED):** the action needs `WORKER_URL` (=`https://annotated-worker-rm.fly.dev`) and `WORKER_AUTH_TOKEN` (already set) on the shared Convex deployment. Setting `WORKER_URL` + deploying the action is a **gated** step — ASK Tarik before `convex env set` / `convex dev --once`. All code/tests up to that point are local.

---

## File Structure
- **Create:** `packages/backend/convex/articles.ts` — the `extractArticle` action.
- **Create:** `apps/web/app/_components/topic-picker.tsx` — web multi-select topic chips (1–3).
- **Create:** `apps/web/app/_components/article-clip-modal.tsx` — the composer modal.
- **Create:** `apps/web/app/_components/new-clip-button.tsx` — auth-gated entry that opens the modal.
- **Modify:** `apps/web/app/_components/site-header.tsx` — mount `<NewClipButton/>`.

---

## Task 1: `articles.extractArticle` Convex action

**Files:**
- Create: `packages/backend/convex/articles.ts`

- [ ] **Step 1: Write the action**

`packages/backend/convex/articles.ts`:
```ts
import { v } from "convex/values";
import { action } from "./_generated/server";

const extractedArticleValidator = v.object({
  title: v.string(),
  textContent: v.string(),
  byline: v.union(v.string(), v.null()),
  siteName: v.union(v.string(), v.null()),
  imageUrl: v.union(v.string(), v.null()),
});

/**
 * Server-side article extraction for the web composer: fetches the worker's
 * Readability endpoint with the worker token held server-side (the web must not
 * ship that token). The worker fetches the page itself when no HTML is supplied.
 * Throws a friendly message on 422 ("not a readable article").
 */
export const extractArticle = action({
  args: { url: v.string() },
  returns: extractedArticleValidator,
  handler: async (_ctx, args) => {
    const workerUrl = process.env.WORKER_URL;
    const workerToken = process.env.WORKER_AUTH_TOKEN;
    if (!workerUrl || !workerToken) {
      throw new Error("Worker is not configured");
    }
    if (!/^https?:\/\//.test(args.url)) {
      throw new Error("Enter a valid http(s) URL");
    }
    const response = await fetch(`${workerUrl}/extract-article`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${workerToken}` },
      body: JSON.stringify({ url: args.url }),
    });
    if (!response.ok) {
      if (response.status === 422) {
        throw new Error(
          "This page doesn't have a clippable article. Try a news story or blog post."
        );
      }
      throw new Error("Couldn't read this article. Please try again in a moment.");
    }
    const body = (await response.json()) as Partial<{
      title: string; textContent: string; byline: string | null;
      siteName: string | null; imageUrl: string | null;
    }>;
    if (typeof body.title !== "string" || typeof body.textContent !== "string") {
      throw new Error("Worker returned an unexpected article response");
    }
    return {
      title: body.title,
      textContent: body.textContent,
      byline: body.byline ?? null,
      siteName: body.siteName ?? null,
      imageUrl: body.imageUrl ?? null,
    };
  },
});
```

- [ ] **Step 2: Typecheck (no deploy)**

Run: `cd packages/backend && npx tsc --noEmit` — clean for `articles.ts` (it references only `_generated/server` + `v`). Do NOT run `convex dev`. (This action calls an external service, so it isn't convex-test'd; it's verified live in Task 5 after the gated deploy.)

- [ ] **Step 3: Commit**
```bash
git add packages/backend/convex/articles.ts
git commit -m "feat(backend): articles.extractArticle action (server-side worker fetch)"
```

---

## Task 2: Web `TopicPicker` component

**Files:**
- Create: `apps/web/app/_components/topic-picker.tsx`

- [ ] **Step 1: Create it**

`apps/web/app/_components/topic-picker.tsx`:
```tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@annotated/backend/convex/_generated/api";

const MAX_TOPICS = 3;

/** Multi-select topic chips (1–3) for the web composer. Lifts selected topic ids. */
export function TopicPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const topics = useQuery(api.topics.list, {});

  function toggle(id: string) {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else if (selected.length < MAX_TOPICS) onChange([...selected, id]);
  }

  if (topics === undefined) {
    return <p className="font-mono text-[12px] text-[color:var(--b-dim)]">Loading topics…</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--b-dim)]">
        Topics (pick 1–3)
      </label>
      <div className="flex flex-wrap gap-1.5">
        {topics.map((t) => {
          const active = selected.includes(t._id);
          const atCap = !active && selected.length >= MAX_TOPICS;
          return (
            <button
              key={t._id}
              type="button"
              onClick={() => toggle(t._id)}
              disabled={atCap}
              className={`border-2 border-[color:var(--b-line)] px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-wide ${
                active
                  ? "bg-[color:var(--b-acid)] text-[color:var(--b-acid-ink)]"
                  : "bg-[color:var(--b-card)] text-[color:var(--b-ink)]"
              } ${atCap ? "cursor-not-allowed opacity-40" : "hover:bg-[color:var(--b-acid)]"}`}
            >
              #{t.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```
(`api.topics.list` IS in the generated types — `topics.ts` predates codegen now. Confirm by typecheck.)

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && npx tsc --noEmit` — clean for this file.

- [ ] **Step 3: Commit**
```bash
git add apps/web/app/_components/topic-picker.tsx
git commit -m "feat(web): TopicPicker multi-select for the composer"
```

---

## Task 3: `ArticleClipModal` composer

**Files:**
- Create: `apps/web/app/_components/article-clip-modal.tsx`

This is the core. It is a brutalist modal with steps: URL → extract → highlight → commentary + topics → publish.

- [ ] **Step 1: Create the component**

`apps/web/app/_components/article-clip-modal.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction, useMutation } from "convex/react";
import { api } from "@annotated/backend/convex/_generated/api";
import {
  selectArticleHighlight,
  extractYoutubeVideoId,
  parsePodcastUrl,
  slugId,
  type ArticleHighlight,
} from "@annotated/shared";
import { TopicPicker } from "./topic-picker";

const MAX_QUOTE_WORDS = 100;

interface Extracted {
  title: string;
  textContent: string;
  byline: string | null;
  siteName: string | null;
  imageUrl: string | null;
}

/** Reads the current text selection's char offsets within the pre-wrap article
 *  container (offsets map 1:1 to textContent because it's a single text node). */
function readSelectionOffsets(container: HTMLElement): { a: number; b: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return null;
  const pre = range.cloneRange();
  pre.selectNodeContents(container);
  pre.setEnd(range.startContainer, range.startOffset);
  const a = pre.toString().length;
  const b = a + range.toString().length;
  return { a, b };
}

export function ArticleClipModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const extract = useAction(api.articles.extractArticle);
  const publish = useMutation(api.annotations.createArticle);

  const [url, setUrl] = useState("");
  const [article, setArticle] = useState<(Extracted & { url: string }) | null>(null);
  const [highlight, setHighlight] = useState<ArticleHighlight | null>(null);
  const [commentary, setCommentary] = useState("");
  const [topicIds, setTopicIds] = useState<string[]>([]);
  const [status, setStatus] = useState<"url" | "extracting" | "compose" | "publishing">("url");
  const [error, setError] = useState<string | null>(null);

  async function handleExtract() {
    setError(null);
    const trimmed = url.trim();
    if (extractYoutubeVideoId(trimmed) || parsePodcastUrl(trimmed)) {
      setError("YouTube and podcasts are clipped in the extension. Paste an article URL here.");
      return;
    }
    setStatus("extracting");
    try {
      const result = await extract({ url: trimmed });
      setArticle({ ...result, url: trimmed });
      setStatus("compose");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extraction failed");
      setStatus("url");
    }
  }

  function onSelect(container: HTMLElement) {
    if (!article) return;
    const offsets = readSelectionOffsets(container);
    if (!offsets) return;
    setHighlight(selectArticleHighlight(article.textContent, offsets.a, offsets.b, MAX_QUOTE_WORDS));
  }

  const canPublish =
    !!article && !!highlight?.valid && commentary.trim().length > 0 && topicIds.length > 0;

  async function handlePublish() {
    if (!article || !highlight) return;
    setStatus("publishing");
    setError(null);
    try {
      const id = await publish({
        canonicalUrl: article.url,
        title: article.title,
        siteName: article.siteName ?? undefined,
        author: article.byline ?? undefined,
        sourceImageUrl: article.imageUrl ?? undefined,
        selectedText: highlight.selectedText,
        textStart: highlight.textStart,
        textEnd: highlight.textEnd,
        commentaryText: commentary.trim(),
        topicIds,
      });
      router.push(`/a/${slugId(article.title, id)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed");
      setStatus("compose");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] text-[color:var(--b-ink)] shadow-[8px_8px_0_0_var(--b-shadow)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b-[3px] border-[color:var(--b-line)] bg-[color:var(--b-chrome)] px-4 py-3 text-[color:var(--b-card)]">
          <span className="font-display text-lg tracking-tight">NEW CLIP</span>
          <button onClick={onClose} aria-label="Close" className="text-xl font-black">×</button>
        </div>

        <div className="p-4">
          {error && (
            <p className="mb-3 border-2 border-[color:var(--b-line)] bg-[#ffecec] px-3 py-2 text-[13px] font-bold text-[#9a0000]">
              {error}
            </p>
          )}

          {status === "url" || status === "extracting" ? (
            <div className="flex flex-col gap-3">
              <label className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--b-dim)]">
                Paste an article URL
              </label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                className="border-[3px] border-[color:var(--b-line)] px-3 py-2 font-mono text-sm"
              />
              <button
                onClick={handleExtract}
                disabled={status === "extracting" || url.trim().length === 0}
                className="border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-acid)] px-4 py-2 font-black uppercase tracking-wide text-[color:var(--b-acid-ink)] shadow-[4px_4px_0_0_var(--b-shadow)] disabled:opacity-50"
              >
                {status === "extracting" ? "Reading…" : "Read article →"}
              </button>
            </div>
          ) : article ? (
            <div className="flex flex-col gap-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--b-dim)]">
                  {article.siteName ?? "Article"} — highlight a passage
                </p>
                <h3 className="text-lg font-extrabold leading-tight">{article.title}</h3>
              </div>
              <div
                onMouseUp={(e) => onSelect(e.currentTarget)}
                className="max-h-[40vh] overflow-y-auto border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-bg)] p-3 text-[14px] leading-relaxed"
                style={{ whiteSpace: "pre-wrap" }}
              >
                {article.textContent}
              </div>
              {highlight?.selectedText && (
                <blockquote className="border-l-[5px] border-[color:var(--b-acid)] pl-3 text-[15px] font-semibold">
                  "{highlight.selectedText}"
                  {highlight.clamped && (
                    <span className="ml-1 font-mono text-[11px] text-[color:var(--b-dim)]">(trimmed to 100 words)</span>
                  )}
                </blockquote>
              )}
              <textarea
                value={commentary}
                onChange={(e) => setCommentary(e.target.value)}
                placeholder="Add your take…"
                rows={3}
                className="border-[3px] border-[color:var(--b-line)] px-3 py-2 text-sm"
              />
              <TopicPicker selected={topicIds} onChange={setTopicIds} />
              <button
                onClick={handlePublish}
                disabled={!canPublish || status === "publishing"}
                className="border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-acid)] px-4 py-2 font-black uppercase tracking-wide text-[color:var(--b-acid-ink)] shadow-[4px_4px_0_0_var(--b-shadow)] disabled:opacity-50"
              >
                {status === "publishing" ? "Publishing…" : "Publish clip"}
              </button>
              {!canPublish && (
                <p className="font-mono text-[11px] text-[color:var(--b-dim)]">
                  Highlight a passage, add a take, and pick at least one topic.
                </p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + build**

Run: `cd apps/web && npx tsc --noEmit` (clean — confirms `api.articles.extractArticle`, `api.annotations.createArticle`, the shared imports, and `slugId` all resolve) then `pnpm build`.
NOTE: `api.articles.extractArticle` requires the generated types to include `articles` — which they will once `articles.ts` exists and codegen has run. If `tsc` errors that `articles` isn't on `api` (because no codegen happened locally), that is the SAME deferred-codegen situation as past work: it will resolve at the gated deploy. If it blocks the build, temporarily reference it via `makeFunctionReference<"action", {url: string}, Extracted>("articles:extractArticle")` instead of `api.articles.extractArticle` (string ref, like the web does elsewhere). Use whichever typechecks; prefer `api.*` if codegen types are present, else the string ref. Report which you used.

- [ ] **Step 3: Commit**
```bash
git add apps/web/app/_components/article-clip-modal.tsx
git commit -m "feat(web): ArticleClipModal composer (paste URL → highlight → publish)"
```

---

## Task 4: Auth-gated "New clip" entry button

**Files:**
- Create: `apps/web/app/_components/new-clip-button.tsx`
- Modify: `apps/web/app/_components/site-header.tsx`

- [ ] **Step 1: Create the button**

`apps/web/app/_components/new-clip-button.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useConvexAuth } from "convex/react";
import { SignInButton } from "@clerk/nextjs";
import { ArticleClipModal } from "./article-clip-modal";

/** Opens the article composer when signed in; otherwise prompts sign-in. */
export function NewClipButton() {
  const { isAuthenticated } = useConvexAuth();
  const [open, setOpen] = useState(false);

  const className =
    "border-2 border-[color:var(--b-acid)] bg-[color:var(--b-acid)] px-3 py-1.5 text-[13px] font-black uppercase tracking-wide text-[color:var(--b-acid-ink)]";

  if (!isAuthenticated) {
    return (
      <SignInButton mode="modal">
        <button className={className}>+ New clip</button>
      </SignInButton>
    );
  }
  return (
    <>
      <button className={className} onClick={() => setOpen(true)}>+ New clip</button>
      {open && <ArticleClipModal onClose={() => setOpen(false)} />}
    </>
  );
}
```

- [ ] **Step 2: Mount it in the header**

In `apps/web/app/_components/site-header.tsx`, import and render `<NewClipButton />` in the right-side action group (the `<div className="ml-auto flex items-center gap-3">`), before the `ThemeToggle`:
```tsx
import { NewClipButton } from "./new-clip-button";
// …inside the ml-auto group, first child:
<NewClipButton />
```

- [ ] **Step 3: Typecheck + build + commit**

Run: `cd apps/web && npx tsc --noEmit && pnpm build`.
```bash
git add apps/web/app/_components/new-clip-button.tsx apps/web/app/_components/site-header.tsx
git commit -m "feat(web): auth-gated New clip entry button"
```

---

## Task 5: Gated deploy + live verification

- [ ] **Step 1: Confirm full local green**

`cd packages/backend && npx tsc --noEmit` ; `cd apps/web && npx tsc --noEmit && pnpm build` — all clean.

- [ ] **Step 2: ASK Tarik, then set env + deploy backend**

The action needs `WORKER_URL` on the shared Convex deployment, and registering `articles.extractArticle` is a push. **Stop and confirm with Tarik.** Then:
```bash
cd packages/backend
npx convex env set WORKER_URL https://annotated-worker-rm.fly.dev   # if not already set
npx convex dev --once   # registers the action (also regenerates api types incl. articles)
```
Confirm `WORKER_AUTH_TOKEN` is present (`npx convex env list`).

- [ ] **Step 3: Deploy web** (Tarik-approved): `npx vercel --prod --yes` from the worktree root.

- [ ] **Step 4: Live verification** (browser): on annotated.sh signed in → click **+ New clip** → paste a real news-article URL → confirm the cleaned text renders → highlight a passage (quote appears) → add a take → pick a topic → **Publish** → lands on `/a/[id]` attributed to the real user, appears in the feed + the topic room. Also confirm pasting a YouTube/podcast URL shows the "use the extension" hint, and a non-article URL shows the friendly 422 message. Screenshot for the record.

---

## Self-Review
- **Spec coverage (#3 article-only):** server-side fetch via Convex action → Task 1; modal paste→extract→highlight→annotate→publish → Task 3; reuse `createArticle` (authed, real user) → Task 3 publish; topic picker → Task 2; auth-gated entry → Task 4; YouTube/podcast deferral hint → Task 3 `handleExtract`. ✓
- **No bundled token on web:** the token lives only in the Convex action's env (Task 1). ✓
- **Type consistency:** `Extracted` shape ↔ action's `extractedArticleValidator` ↔ worker response; `createArticle` args match the verified mutation signature (canonicalUrl/title/siteName?/author?/sourceImageUrl?/selectedText/textStart/textEnd/commentaryText?/topicIds); `selectArticleHighlight(text, a, b, maxWords)` → `{selectedText,textStart,textEnd,valid,clamped}`; `slugId(title, id)` matches existing usage.
- **Testing reality:** the action calls an external worker (not convex-test'able) and the composer is React UI → verified by typecheck + build + the live E2E in Task 5 (the article extraction logic itself is already worker-tested; `selectArticleHighlight` is already unit-tested in shared). Intentional.
- **Deferred (documented):** podcast-web + YouTube-web composer, audio commentary on web, draft-save.
