# #1 Avatar-Forward Feed — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make feed cards identity-forward (author avatar + name + optional verified badge at the top), Substack-Notes style, with a reusable `AuthorAvatar` component that #2/#4 will reuse.

**Architecture:** A pure `authorInitials` helper in `@annotated/shared` (deduping two existing copies), one optional `users.isVerified` schema field projected through the feed/landing views, a square brutalist `AuthorAvatar` web component, and a card-header refactor. TDD where the codebase supports it (shared = vitest, backend = convex-test); React UI verified by typecheck + a live screenshot.

**Tech Stack:** `@annotated/shared` (vitest), Convex (`convex-test`), Next.js 16 App Router + Tailwind v4 `--b-*` brutalist tokens.

**Design source:** `docs/plans/2026-05-28-substack-for-clips-design.md` (#1 section).

**Branch:** continue on `feat/topics-ranked-feeds` in the current worktree. **Convex `strong-eel-665` is shared local+prod — do NOT run `convex dev --once` here; verify backend with `convex-test` only. The live schema push is gated and happens later with Tarik's go-ahead.**

---

## File Structure
- **Create:** `packages/shared/src/author-initials.ts` (+ `.test.ts`) — pure initials helper.
- **Create:** `apps/web/app/_components/author-avatar.tsx` — square brutalist avatar (image or initials) + optional verified check.
- **Modify:** `packages/shared/src/index.ts` — export `authorInitials`.
- **Modify:** `packages/backend/convex/schema.ts` — add `users.isVerified`.
- **Modify:** `packages/backend/convex/annotations.ts` — project `isVerified` in `toFeedItem` (~line 82-87) and `toLandingView` (~line 543-547).
- **Modify:** `apps/web/app/_components/annotation-card.tsx` — `FeedItem.author.isVerified?`, avatar-forward header, use `AuthorAvatar`.
- **Modify (DRY):** `apps/web/app/_components/right-rail.tsx`, `apps/web/app/u/[username]/page.tsx` — drop local `initials()`, use `AuthorAvatar`/shared helper.
- **Test:** `packages/shared/src/author-initials.test.ts`, append to `packages/backend/convex/social.test.ts` (or a small new test) for the projection.

---

## Task 1: Shared `authorInitials` helper

**Files:**
- Create: `packages/shared/src/author-initials.ts`
- Test: `packages/shared/src/author-initials.test.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write the failing test**

`packages/shared/src/author-initials.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { authorInitials } from "./author-initials.js";

describe("authorInitials", () => {
  it("takes the first letter of the first two words, uppercased", () => {
    expect(authorInitials("Tarik Moody")).toBe("TM");
  });
  it("handles a single name", () => {
    expect(authorInitials("Madonna")).toBe("M");
  });
  it("ignores extra whitespace", () => {
    expect(authorInitials("  Renée   Del  Rio ")).toBe("RD");
  });
  it("returns empty string for empty input", () => {
    expect(authorInitials("")).toBe("");
  });
});
```

- [ ] **Step 2: Run it — expect FAIL (module missing)**

Run: `cd packages/shared && pnpm vitest run author-initials`
Expected: FAIL — cannot find `./author-initials`.

- [ ] **Step 3: Implement** `packages/shared/src/author-initials.ts`:
```ts
/** First letters of the first two words, uppercased — for avatar fallbacks. */
export function authorInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
```

- [ ] **Step 4: Export from index** — append to `packages/shared/src/index.ts`:
```ts
export { authorInitials } from "./author-initials";
```

- [ ] **Step 5: Run — expect PASS**

Run: `cd packages/shared && pnpm vitest run author-initials` → 4 passed.
Then `pnpm typecheck` (clean).

- [ ] **Step 6: Commit**
```bash
git add packages/shared/src/author-initials.ts packages/shared/src/author-initials.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): authorInitials helper for avatar fallbacks"
```

---

## Task 2: `users.isVerified` schema field + projections

**Files:**
- Modify: `packages/backend/convex/schema.ts`
- Modify: `packages/backend/convex/annotations.ts`
- Test: `packages/backend/convex/social.test.ts` (append one test)

- [ ] **Step 1: Add the field to the schema**

In `packages/backend/convex/schema.ts`, in the `users` table (after `xHandle: v.optional(v.string()),`):
```ts
    isVerified: v.optional(v.boolean()),
```

- [ ] **Step 2: Project it in `toFeedItem`**

In `packages/backend/convex/annotations.ts`, the `toFeedItem` author block (currently `username`/`displayName`/`avatarUrl`) — add `isVerified`:
```ts
    author: author
      ? {
          username: author.username,
          displayName: author.displayName,
          avatarUrl: author.avatarUrl,
          isVerified: author.isVerified ?? false,
        }
      : null,
```

- [ ] **Step 3: Project it in `toLandingView`**

In the same file's `toLandingView` author block (the second author projection, ~line 543-547), add the same `isVerified: author.isVerified ?? false,` line.

- [ ] **Step 4: Write the failing test** — append to `packages/backend/convex/social.test.ts`:
```ts
test("feed projects an author's verified flag", async () => {
  const t = convexTest(schema, modules);
  const verifiedUserId = await t.run(async (ctx) => {
    const uid = await ctx.db.insert("users", {
      clerkId: "clerk_verified",
      username: "verified_user",
      displayName: "Verified User",
      isVerified: true,
    });
    const sourceId = await ctx.db.insert("sources", {
      type: "article",
      canonicalUrl: "https://example.com/v",
      title: "V",
    });
    await ctx.db.insert("annotations", {
      authorId: uid,
      sourceId,
      selectedText: "q",
      commentaryText: "c",
      isPublic: true,
      publishedAt: Date.now(),
      commentCount: 0,
      likeCount: 0,
    });
    return uid;
  });
  const feed = await t.query(api.annotations.listFeed, { paginationOpts: { numItems: 10, cursor: null } });
  const card = feed.page.find((c) => c.author?.username === "verified_user");
  expect(card?.author?.isVerified).toBe(true);
});
```
(If `social.test.ts` lacks the `import schema`/`api`/`modules`/`test` setup, copy it from the file's top — it already uses convex-test.)

- [ ] **Step 5: Run the backend suite — expect PASS**

Run: `cd packages/backend && pnpm vitest run` (all green, incl. the new test).
Also `npx tsc --noEmit` — clean (do NOT run `convex dev`).

- [ ] **Step 6: Commit**
```bash
git add packages/backend/convex/schema.ts packages/backend/convex/annotations.ts packages/backend/convex/social.test.ts
git commit -m "feat(backend): users.isVerified + project through feed/landing"
```

---

## Task 3: `AuthorAvatar` web component

**Files:**
- Create: `apps/web/app/_components/author-avatar.tsx`

- [ ] **Step 1: Create the component**

`apps/web/app/_components/author-avatar.tsx`:
```tsx
import { authorInitials } from "@annotated/shared";

interface AuthorAvatarProps {
  displayName: string;
  avatarUrl?: string | null;
  size?: number; // px; default 30
}

/** Square brutalist avatar: the author's photo, or an acid initials block when
 *  there's no photo. Hard black border to match the card system. */
export function AuthorAvatar({ displayName, avatarUrl, size = 30 }: AuthorAvatarProps) {
  const px = `${size}px`;
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote avatar (Clerk/X)
      <img
        src={avatarUrl}
        alt={displayName}
        width={size}
        height={size}
        className="flex-none border-[3px] border-[color:var(--b-line)] object-cover"
        style={{ width: px, height: px }}
      />
    );
  }
  return (
    <span
      className="grid flex-none place-items-center border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-acid)] font-black text-[color:var(--b-acid-ink)]"
      style={{ width: px, height: px, fontSize: Math.round(size * 0.42) }}
      aria-label={displayName}
    >
      {authorInitials(displayName) || "·"}
    </span>
  );
}

/** Small acid verified check, shown next to verified author names. */
export function VerifiedBadge() {
  return (
    <span
      title="Verified"
      className="inline-grid size-[14px] flex-none place-items-center bg-[color:var(--b-acid)] text-[10px] font-black text-[color:var(--b-acid-ink)]"
      aria-label="Verified"
    >
      ✓
    </span>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && npx tsc --noEmit` — must be clean for this file.

- [ ] **Step 3: Commit**
```bash
git add apps/web/app/_components/author-avatar.tsx
git commit -m "feat(web): AuthorAvatar + VerifiedBadge components"
```

---

## Task 4: Avatar-forward card header

**Files:**
- Modify: `apps/web/app/_components/annotation-card.tsx`

- [ ] **Step 1: Extend `FeedItem.author`**

In `annotation-card.tsx`, add to the `author` shape in the `FeedItem` interface:
```ts
  author: {
    username: string;
    displayName: string;
    avatarUrl?: string;
    isVerified?: boolean;
  } | null;
```

- [ ] **Step 2: Import the avatar components** — add near the top imports:
```ts
import { AuthorAvatar, VerifiedBadge } from "./author-avatar";
```

- [ ] **Step 3: Replace the header + drop the "clipped by" line**

The current top row is the type glyph + label + age; below the title is a `clipped by` paragraph. Make the header identity-forward. Replace the existing top `<div className="flex items-center gap-2.5 px-4 pt-3.5">…</div>` with:
```tsx
      <div className="flex items-center gap-2.5 px-4 pt-3.5">
        {item.isAnonymous ? (
          <AuthorAvatar displayName="Anonymous" avatarUrl={null} />
        ) : author ? (
          <Link href={`/u/${author.username}`} className="flex-none">
            <AuthorAvatar displayName={author.displayName} avatarUrl={author.avatarUrl} />
          </Link>
        ) : (
          <AuthorAvatar displayName="Unknown" avatarUrl={null} />
        )}
        <div className="min-w-0 leading-tight">
          <div className="flex items-center gap-1">
            {item.isAnonymous ? (
              <span className="truncate text-[14px] font-extrabold">Anonymous</span>
            ) : author ? (
              <Link href={`/u/${author.username}`} className="truncate text-[14px] font-extrabold hover:underline">
                {author.displayName}
              </Link>
            ) : (
              <span className="truncate text-[14px] font-extrabold">Unknown</span>
            )}
            {!item.isAnonymous && author?.isVerified && <VerifiedBadge />}
          </div>
          <span className="font-mono text-[11px] text-[color:var(--b-dim)]">{age}</span>
        </div>
        <span className={`ml-auto grid size-[22px] flex-none place-items-center text-xs font-black ${meta.box}`}>
          {meta.glyph}
        </span>
      </div>
```

- [ ] **Step 4: Remove the old "clipped by" paragraph**

Delete the `<p className="flex items-center gap-1.5 px-4 pb-3 …">clipped by …</p>` block — BUT keep the thread badge it contained. Move the thread badge to just under the title (`<h2>`). The thread badge JSX (the `{isThread && (<Link …>🧵 {item.clipCount} clips</Link>)}`) goes right after the `</h2>` line, wrapped so it has padding:
```tsx
      {isThread && (
        <div className="px-4 pb-1">
          <Link
            href={detailHref}
            className="inline-block border-2 border-[color:var(--b-line)] bg-[color:var(--b-acid)] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[color:var(--b-acid-ink)]"
          >
            🧵 {item.clipCount} clips
          </Link>
        </div>
      )}
```
The `meta.label`/`siteName` text label is now dropped from the header (the glyph chip + the existing source link at the card bottom carry the type/source signal). Leave the bottom source link untouched.

- [ ] **Step 5: Typecheck + build**

Run: `cd apps/web && npx tsc --noEmit` (clean) then `pnpm build` (succeeds).

- [ ] **Step 6: Commit**
```bash
git add apps/web/app/_components/annotation-card.tsx
git commit -m "feat(web): avatar-forward feed card header"
```

---

## Task 5: DRY — reuse AuthorAvatar in right-rail + profile

**Files:**
- Modify: `apps/web/app/_components/right-rail.tsx`
- Modify: `apps/web/app/u/[username]/page.tsx`

- [ ] **Step 1: right-rail** — delete its local `function initials(...)`; replace the initials `<Link>` block with `AuthorAvatar` (size 36 to match `size-9`):
```tsx
import { AuthorAvatar } from "./author-avatar";
// …
<Link href={`/u/${p.username}`} className="flex-none">
  <AuthorAvatar displayName={p.displayName} avatarUrl={p.avatarUrl} size={36} />
</Link>
```
(If `suggestions` doesn't project `avatarUrl`, pass `avatarUrl={undefined}` — the initials fallback still renders. Check `users.suggestions` projection; if it already returns `avatarUrl`, use it.)

- [ ] **Step 2: profile page** — delete its local `function initials(...)`; replace the initials block with `AuthorAvatar` (size 64) wired to `user.avatarUrl`:
```tsx
import { AuthorAvatar } from "../../_components/author-avatar";
// …
<AuthorAvatar displayName={user.displayName} avatarUrl={user.avatarUrl} size={64} />
```
(Confirm `users.getByUsername` returns `avatarUrl`; if not, that's fine — initials fallback. Do NOT change the query in this task.)

- [ ] **Step 3: Typecheck + build**

Run: `cd apps/web && npx tsc --noEmit && pnpm build` — clean/succeeds. If either consumer's query doesn't supply `avatarUrl`, the fallback covers it; do not expand scope.

- [ ] **Step 4: Commit**
```bash
git add apps/web/app/_components/right-rail.tsx "apps/web/app/u/[username]/page.tsx"
git commit -m "refactor(web): reuse AuthorAvatar; drop duplicated initials()"
```

---

## Task 6: Visual verification

- [ ] **Step 1: Run the worktree dev server**

From `apps/web`: copy env if absent (`cp /Users/tarikmoody/Documents/Projects/annotated/apps/web/.env.local .env.local`), then `PORT=3001 pnpm dev`.

- [ ] **Step 2: Screenshot the feed** — open `http://localhost:3001/` and confirm: each card leads with a square avatar (photo or acid initials) + author name + relative time; verified authors show the acid ✓; anonymous cards show a neutral square + "Anonymous"; thread badge still appears under the title. Capture a screenshot for Tarik to eyeball.

- [ ] **Step 3: Report** — note anything that needs a design tweak; do not deploy (deploy is a separate, Tarik-approved step).

---

## Self-Review
- **Spec coverage (#1 design):** identity-forward header → Task 4; `AuthorAvatar` square+border+initials fallback → Task 3 (+ shared helper Task 1); verified badge via `isVerified` → Task 2 + Task 3/4; anonymous handling → Task 4; reuse by #2/#4 → component is standalone. ✓
- **Placeholders:** none — all code shown.
- **Type consistency:** `author.isVerified?: boolean` (FeedItem) ↔ `isVerified: author.isVerified ?? false` (projection) ↔ `users.isVerified: v.optional(v.boolean())`; `authorInitials` name consistent across shared/export/component; `AuthorAvatar` prop names (`displayName`, `avatarUrl`, `size`) consistent across all call sites.
- **Web test reality:** web has no component-test harness, so UI is verified by `tsc` + `pnpm build` + a live screenshot; the genuinely testable units (`authorInitials`, the `isVerified` projection) get real tests. This is intentional, not a gap.
