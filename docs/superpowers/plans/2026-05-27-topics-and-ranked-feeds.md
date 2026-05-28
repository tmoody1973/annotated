# Topics & Ranked Feeds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every clip a home beyond the follow-graph — canonical topics joined to annotations, browsable topic rooms with Hot/Top/New ranked feeds, and a topic chip on every card.

**Architecture:** A `topics` table (canonical, seeded) plus an `annotationTopics` join table (carrying a denormalized `publishedAt` for recency-bounded reads). Publishing requires 1–3 topics, validated server-side and threaded through the shared `insertAnnotation`. Ranking is a pure function in `@annotated/shared` (Reddit-hot), called at query time over a bounded candidate set — no denormalized score field. Web adds a `/topics` directory + `/topics/[slug]` room with sort tabs; the extension adds a `TopicPicker` to all three composers.

**Tech Stack:** Convex (backend), `@annotated/shared` (vitest, pure logic), Next.js 16 App Router + Tailwind v4 brutalist tokens (web), Plasmo MV3 + ConvexReactClient (extension).

**Design source:** `docs/plans/2026-05-27-topics-and-ranked-feeds-design.md`

**Route note (deviation from design):** `/t/[id]` is already the *threads* route, so topic rooms live at **`/topics/[slug]`** (directory at `/topics`), not `/t/[slug]`.

**Convex note:** Before backend tasks, read `packages/backend/convex/_generated/ai/guidelines.md` and follow it (function syntax, validators, internal vs public). All new Convex functions use the `{ args, returns, handler }` object syntax already used across this codebase.

**Standing rollout rule:** Convex `strong-eel-665` is shared local+prod. **Ask Tarik before `npx convex dev --once`** (schema push). Tasks 1–13 are code+tests that run offline against `convex-test`; the live push happens only in Task 16.

---

## File Structure

**Create:**
- `packages/shared/src/rank-annotations.ts` — pure ranker (`netScore`, `rankAnnotations`).
- `packages/shared/src/rank-annotations.test.ts` — ranker unit tests.
- `packages/backend/convex/topics.ts` — `seedTopics` (internal), `list`, `getBySlug`.
- `packages/backend/convex/topics.test.ts` — topic validation + listByTopic ranking (convex-test).
- `apps/web/app/topics/page.tsx` — topic directory.
- `apps/web/app/topics/[slug]/page.tsx` — topic room (server: 404 + header).
- `apps/web/app/_components/topic-feed.tsx` — client: sort tabs + ranked cards.
- `apps/web/app/_components/topic-rail.tsx` — client: horizontal topic chips atop the feed.
- `apps/extension/components/topic-picker.tsx` — multi-select topic chips (1–3).

**Modify:**
- `packages/shared/src/index.ts` — export the ranker.
- `packages/backend/convex/schema.ts` — add `topics` + `annotationTopics`.
- `packages/backend/convex/annotations.ts` — `assertTopics`, `insertAnnotation` join writes, `toFeedItem` topics projection, `listByTopic`, `createYoutube` topicIds.
- `packages/backend/convex/testing.ts` — `topicIds` on the 3 `publish*Dev`, new `assignTopicsDev`.
- `packages/backend/convex/{anonymous,commentary,authed-publish,thread-follow-on,screenshot}.test.ts` — seed a topic + pass `topicIds` (they break otherwise).
- `apps/web/app/_lib/urls.ts` — `topicPath`.
- `apps/web/app/_components/annotation-card.tsx` — `topics` on `FeedItem` + chip render.
- `apps/web/app/_components/left-nav.tsx` — "Topics" nav item.
- `apps/web/app/page.tsx` — mount `<TopicRail/>` above `<Feed/>`.
- `apps/extension/lib/convex-publish.ts` — `topicIds` on `YoutubePublishArgs`.
- `apps/extension/components/{clip-composer,transcript-canvas,article-panel}.tsx` — mount `TopicPicker`, gate publish, pass `topicIds`.
- `apps/extension/e2e/*.e2e.mjs` — topic selection before publish.

---

## Task 1: Shared ranker (pure, TDD)

**Files:**
- Create: `packages/shared/src/rank-annotations.ts`
- Test: `packages/shared/src/rank-annotations.test.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write the failing test**

`packages/shared/src/rank-annotations.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { netScore, rankAnnotations, type Rankable } from "./rank-annotations.js";

const mk = (p: Partial<Rankable>): Rankable => ({
  publishedAt: 0,
  likeCount: 0,
  downCount: 0,
  ...p,
});

describe("netScore", () => {
  it("subtracts downvotes from upvotes", () => {
    expect(netScore({ likeCount: 5, downCount: 2 })).toBe(3);
  });
  it("treats an absent downCount as zero (legacy rows)", () => {
    expect(netScore({ likeCount: 4 })).toBe(4);
  });
});

describe("rankAnnotations", () => {
  it("new: orders by publishedAt desc regardless of votes", () => {
    const a = mk({ publishedAt: 1, likeCount: 100 });
    const b = mk({ publishedAt: 2, likeCount: 0 });
    expect(rankAnnotations([a, b], "new").map((x) => x.publishedAt)).toEqual([2, 1]);
  });

  it("top: higher net first, ties broken by newer publishedAt", () => {
    const a = mk({ publishedAt: 1, likeCount: 3 });
    const b = mk({ publishedAt: 9, likeCount: 3 });
    const c = mk({ publishedAt: 5, likeCount: 10 });
    expect(rankAnnotations([a, b, c], "top")).toEqual([c, b, a]);
  });

  it("top: negative net sinks below zero net", () => {
    const bad = mk({ publishedAt: 9, likeCount: 0, downCount: 5 });
    const neutral = mk({ publishedAt: 1, likeCount: 0 });
    expect(rankAnnotations([bad, neutral], "top")).toEqual([neutral, bad]);
  });

  it("hot: at equal net, newer ranks first", () => {
    const older = mk({ publishedAt: 1_000_000, likeCount: 5 });
    const newer = mk({ publishedAt: 9_000_000, likeCount: 5 });
    expect(rankAnnotations([older, newer], "hot")).toEqual([newer, older]);
  });

  it("hot: at equal publishedAt, higher net ranks first", () => {
    const lo = mk({ publishedAt: 5_000_000, likeCount: 1 });
    const hi = mk({ publishedAt: 5_000_000, likeCount: 100 });
    expect(rankAnnotations([lo, hi], "hot")).toEqual([hi, lo]);
  });

  it("does not mutate the input array", () => {
    const items = [mk({ publishedAt: 1 }), mk({ publishedAt: 2 })];
    const snapshot = [...items];
    rankAnnotations(items, "new");
    expect(items).toEqual(snapshot);
  });

  it("returns empty for an empty input", () => {
    expect(rankAnnotations([], "hot")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && pnpm vitest run rank-annotations`
Expected: FAIL — "Cannot find module './rank-annotations.js'".

- [ ] **Step 3: Write minimal implementation**

`packages/shared/src/rank-annotations.ts`:
```ts
export interface Rankable {
  publishedAt?: number;
  likeCount: number;
  downCount?: number;
}

export type RankSort = "hot" | "top" | "new";

/** Net vote score: upvotes minus downvotes. An absent downCount (legacy rows) reads as 0. */
export function netScore(item: Pick<Rankable, "likeCount" | "downCount">): number {
  return item.likeCount - (item.downCount ?? 0);
}

// Reddit's "hot" gravity divisor, expressed in seconds. Each order of magnitude of
// net votes is worth ~12.5 hours of freshness.
const HOT_SECONDS_DIVISOR = 45_000;

function hotRank(item: Rankable): number {
  const net = netScore(item);
  const order = Math.log10(Math.max(Math.abs(net), 1));
  const sign = net > 0 ? 1 : net < 0 ? -1 : 0;
  const seconds = (item.publishedAt ?? 0) / 1000; // publishedAt is ms; the divisor is seconds
  return sign * order + seconds / HOT_SECONDS_DIVISOR;
}

/** Orders candidates by the chosen sort. Pure — returns a new array, never mutates. */
export function rankAnnotations<T extends Rankable>(items: readonly T[], sort: RankSort): T[] {
  const copy = [...items];
  if (sort === "new") {
    return copy.sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
  }
  if (sort === "top") {
    return copy.sort(
      (a, b) => netScore(b) - netScore(a) || (b.publishedAt ?? 0) - (a.publishedAt ?? 0)
    );
  }
  return copy.sort((a, b) => hotRank(b) - hotRank(a));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/shared && pnpm vitest run rank-annotations`
Expected: PASS (all assertions).

- [ ] **Step 5: Export from the package index**

In `packages/shared/src/index.ts`, append:
```ts
export { rankAnnotations, netScore } from "./rank-annotations";
export type { Rankable, RankSort } from "./rank-annotations";
```

- [ ] **Step 6: Typecheck + commit**

Run: `cd packages/shared && pnpm typecheck && pnpm test`
Expected: PASS.
```bash
git add packages/shared/src/rank-annotations.ts packages/shared/src/rank-annotations.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): Reddit-hot ranker for topic feeds"
```

---

## Task 2: Schema — topics + annotationTopics

**Files:**
- Modify: `packages/backend/convex/schema.ts`

- [ ] **Step 1: Add the two tables**

In `packages/backend/convex/schema.ts`, inside the `defineSchema({ ... })` object (e.g. after the `claims` table, before the closing `})`), add:
```ts
  // Canonical, curated topics. Addressable rooms (/topics/[slug]).
  topics: defineTable({
    slug: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
  }).index("by_slug", ["slug"]),

  // Annotation↔topic join. `publishedAt` is denormalized from the annotation
  // (immutable, set once) so a topic room reads its most-recent candidates by index.
  annotationTopics: defineTable({
    annotationId: v.id("annotations"),
    topicId: v.id("topics"),
    publishedAt: v.number(),
  })
    .index("by_topic", ["topicId", "publishedAt"])
    .index("by_annotation", ["annotationId"]),
```

- [ ] **Step 2: Verify the schema typechecks (codegen, no push)**

Run: `cd packages/backend && pnpm typecheck`
Expected: PASS. (Do NOT run `convex dev` here — that pushes to the shared deployment. Codegen for `_generated` happens during the test run / typecheck via convex-test's schema import.)

- [ ] **Step 3: Commit**
```bash
git add packages/backend/convex/schema.ts
git commit -m "feat(backend): topics + annotationTopics tables"
```

---

## Task 3: topics.ts — seed + list + getBySlug

**Files:**
- Create: `packages/backend/convex/topics.ts`

- [ ] **Step 1: Write the module**

`packages/backend/convex/topics.ts`:
```ts
import { v } from "convex/values";
import { query, internalMutation } from "./_generated/server";

/** The canonical starter set (slugs are stable URL keys; refine names freely). */
const SEED_TOPICS: { slug: string; name: string; sortOrder: number }[] = [
  { slug: "news-politics", name: "News & Politics", sortOrder: 0 },
  { slug: "media-accountability", name: "Media & Accountability", sortOrder: 1 },
  { slug: "tech", name: "Tech", sortOrder: 2 },
  { slug: "business-investing", name: "Business & Investing", sortOrder: 3 },
  { slug: "science", name: "Science", sortOrder: 4 },
  { slug: "health", name: "Health", sortOrder: 5 },
  { slug: "education", name: "Education", sortOrder: 6 },
  { slug: "culture-arts", name: "Culture & Arts", sortOrder: 7 },
  { slug: "history", name: "History", sortOrder: 8 },
  { slug: "sports", name: "Sports", sortOrder: 9 },
  { slug: "comedy", name: "Comedy", sortOrder: 10 },
  { slug: "true-crime", name: "True Crime", sortOrder: 11 },
  { slug: "society", name: "Society", sortOrder: 12 },
  { slug: "climate", name: "Climate", sortOrder: 13 },
  { slug: "ideas-philosophy", name: "Ideas & Philosophy", sortOrder: 14 },
];

/** Idempotently insert the canonical topics. Internal — run via `convex run topics:seedTopics`. */
export const seedTopics = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    let created = 0;
    for (const t of SEED_TOPICS) {
      const existing = await ctx.db
        .query("topics")
        .withIndex("by_slug", (q) => q.eq("slug", t.slug))
        .first();
      if (!existing) {
        await ctx.db.insert("topics", t);
        created++;
      }
    }
    return created;
  },
});

/** All topics for the directory + the composer/picker selector. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const topics = await ctx.db.query("topics").collect();
    return topics
      .sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)
      )
      .map((t) => ({ _id: t._id, slug: t.slug, name: t.name, description: t.description }));
  },
});

/** One topic for the room header. Null when the slug is unknown (page 404s on null). */
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const t = await ctx.db
      .query("topics")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    return t ? { _id: t._id, slug: t.slug, name: t.name, description: t.description } : null;
  },
});
```

- [ ] **Step 2: Typecheck + commit**

Run: `cd packages/backend && pnpm typecheck`
Expected: PASS.
```bash
git add packages/backend/convex/topics.ts
git commit -m "feat(backend): topics seed + list + getBySlug"
```

---

## Task 4: Thread topicIds through publishing + validation

**Files:**
- Modify: `packages/backend/convex/annotations.ts:84-169` (assertTopics, AnnotationInsert, insertAnnotation, createYoutube)
- Modify: `packages/backend/convex/testing.ts` (3 `publish*Dev`)
- Test: `packages/backend/convex/topics.test.ts` (validation half)

- [ ] **Step 1: Write the failing validation test**

`packages/backend/convex/topics.test.ts`:
```ts
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.*s");

async function seedClipStorage(t: ReturnType<typeof convexTest>): Promise<Id<"_storage">> {
  return await t.run(async (ctx) => ctx.storage.store(new Blob(["clip"])));
}

async function topicIds(t: ReturnType<typeof convexTest>, slugs: string[]): Promise<Id<"topics">[]> {
  await t.mutation(internal.topics.seedTopics, {});
  return await t.run(async (ctx) => {
    const ids: Id<"topics">[] = [];
    for (const slug of slugs) {
      const topic = await ctx.db
        .query("topics")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();
      if (!topic) throw new Error(`missing seed topic ${slug}`);
      ids.push(topic._id);
    }
    return ids;
  });
}

test("createYoutube requires 1-3 valid topics and writes join rows", async () => {
  const t = convexTest(schema, modules);
  const tarik = t.withIdentity({ subject: "clerk_tarik", name: "Tarik" });
  await tarik.mutation(api.users.ensureCurrentUser, {});
  const clipStorageId = await seedClipStorage(t);
  const [tech, news, science, health] = await topicIds(t, [
    "tech",
    "news-politics",
    "science",
    "health",
  ]);

  const base = {
    videoId: "v1",
    title: "A video",
    clipStorageId,
    clipStartMs: 0,
    clipEndMs: 10_000,
    commentaryText: "take",
  };

  // Zero topics rejected.
  await expect(
    tarik.mutation(api.annotations.createYoutube, { ...base, topicIds: [] })
  ).rejects.toThrow(/1.?3 topics/);

  // Four topics rejected.
  await expect(
    tarik.mutation(api.annotations.createYoutube, {
      ...base,
      topicIds: [tech, news, science, health],
    })
  ).rejects.toThrow(/1.?3 topics/);

  // Non-existent topic rejected.
  const fakeTopicId = await t.run(async (ctx) => {
    const id = await ctx.db.insert("topics", { slug: "tmp", name: "Tmp" });
    await ctx.db.delete(id);
    return id;
  });
  await expect(
    tarik.mutation(api.annotations.createYoutube, { ...base, topicIds: [fakeTopicId] })
  ).rejects.toThrow(/Unknown topic/);

  // Valid 2-topic publish writes two join rows carrying the annotation's publishedAt.
  const annotationId = await tarik.mutation(api.annotations.createYoutube, {
    ...base,
    topicIds: [tech, news],
  });
  const joins = await t.run(async (ctx) =>
    ctx.db
      .query("annotationTopics")
      .withIndex("by_annotation", (q) => q.eq("annotationId", annotationId))
      .collect()
  );
  const annotation = await t.run((ctx) => ctx.db.get(annotationId));
  expect(joins.map((j) => j.topicId).sort()).toEqual([tech, news].sort());
  expect(joins.every((j) => j.publishedAt === annotation?.publishedAt)).toBe(true);
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `cd packages/backend && pnpm vitest run topics`
Expected: FAIL — `createYoutube` has no `topicIds` arg (validator rejects the extra field / type error).

- [ ] **Step 3: Add `assertTopics` + topic writes in `annotations.ts`**

In `packages/backend/convex/annotations.ts`, after `assertPublishable` (ends line 101) add:
```ts
const MIN_TOPICS = 1;
const MAX_TOPICS = 3;

/**
 * Publish-time topic guard: 1–3 distinct topics, each one a real `topics` row.
 * The id list arrives from the client, so never trust the count or membership.
 */
export async function assertTopics(
  ctx: MutationCtx,
  topicIds: Id<"topics">[]
): Promise<void> {
  if (topicIds.length < MIN_TOPICS || topicIds.length > MAX_TOPICS) {
    throw new Error("Pick 1-3 topics");
  }
  if (new Set(topicIds).size !== topicIds.length) {
    throw new Error("Duplicate topic");
  }
  for (const id of topicIds) {
    if (!(await ctx.db.get(id))) {
      throw new Error("Unknown topic");
    }
  }
}
```

In the `AnnotationInsert` interface (line 103-118) add the optional field:
```ts
  topicIds?: Id<"topics">[];
```

In `insertAnnotation` (line 140-169), capture `publishedAt` once and write join rows after the insert. Replace the body so it reads:
```ts
export async function insertAnnotation(
  ctx: MutationCtx,
  input: AnnotationInsert
): Promise<Id<"annotations">> {
  const threadOrder =
    input.threadId !== undefined
      ? await nextThreadOrder(ctx, input.threadId)
      : undefined;
  const publishedAt = Date.now();
  const annotationId = await ctx.db.insert("annotations", {
    authorId: input.authorId,
    sourceId: input.sourceId,
    clipStorageId: input.clipStorageId,
    clipStartMs: input.clipStartMs,
    clipEndMs: input.clipEndMs,
    textStart: input.textStart,
    textEnd: input.textEnd,
    selectedText: input.selectedText,
    commentaryText: input.commentaryText,
    commentaryAudioStorageId: input.commentaryAudioStorageId,
    commentaryAudioTranscript: input.commentaryAudioTranscript,
    screenshotStorageId: input.screenshotStorageId,
    threadId: input.threadId,
    threadOrder,
    isAnonymous: input.isAnonymous,
    isPublic: true,
    publishedAt,
    commentCount: 0,
    likeCount: 0,
  });
  for (const topicId of input.topicIds ?? []) {
    await ctx.db.insert("annotationTopics", { annotationId, topicId, publishedAt });
  }
  return annotationId;
}
```

- [ ] **Step 4: Add `topicIds` to `createYoutube`**

In `createYoutube` (line 178-221): add to `args` (after `threadId`):
```ts
    topicIds: v.array(v.id("topics")),
```
In the handler, after `assertPublishable(args);` add:
```ts
    await assertTopics(ctx, args.topicIds);
```
And add `topicIds: args.topicIds,` to the `insertAnnotation({ ... })` call.

- [ ] **Step 5: Add `topicIds` to the three `publish*Dev` in `testing.ts`**

Import the guard at the top of `testing.ts` (line 6):
```ts
import { assertPublishable, assertTopics, insertAnnotation } from "./annotations";
```
For **each** of `publishYoutubeClipDev`, `publishPodcastClipDev`, `publishArticleClipDev`:
- add `topicIds: v.array(v.id("topics")),` to `args`,
- after the existing validation (just before `const authorId = await resolveSeedUser(ctx);`) add `await assertTopics(ctx, args.topicIds);`,
- add `topicIds: args.topicIds,` to that handler's `insertAnnotation({ ... })` call.

(Leave `seedAnnotation` and `seedThreadDev` untouched — they intentionally create topic-less rows.)

- [ ] **Step 6: Run the validation test — expect PASS**

Run: `cd packages/backend && pnpm vitest run topics`
Expected: PASS for "createYoutube requires 1-3 valid topics…".

- [ ] **Step 7: Fix the existing publish-path tests (they now require topicIds)**

In each of `anonymous.test.ts`, `commentary.test.ts`, `authed-publish.test.ts`, `thread-follow-on.test.ts`, `screenshot.test.ts`: add a helper to seed + fetch one topic id and pass `topicIds: [<id>]` to every `createYoutube` / `publish*Dev` call. Use exactly this helper (paste near the top of each file, after imports):
```ts
async function oneTopic(t: ReturnType<typeof convexTest>): Promise<Id<"topics">[]> {
  await t.mutation(internal.topics.seedTopics, {});
  const id = await t.run(async (ctx) => {
    const topic = await ctx.db
      .query("topics")
      .withIndex("by_slug", (q) => q.eq("slug", "tech"))
      .first();
    return topic!._id;
  });
  return [id];
}
```
Ensure each file imports `internal` (`import { api, internal } from "./_generated/api";`) and `Id` (`import type { Id } from "./_generated/dataModel";`). Then add `topicIds: await oneTopic(t),` to each publish call's args. For the "rejects unauthenticated" / "rejects no commentary" negative tests, still pass a valid `topicIds` so the test fails for the intended reason, not a topic error.

- [ ] **Step 8: Run the whole backend suite — expect PASS**

Run: `cd packages/backend && pnpm vitest run`
Expected: all tests PASS.

- [ ] **Step 9: Typecheck + commit**

Run: `cd packages/backend && pnpm typecheck`
```bash
git add packages/backend/convex/annotations.ts packages/backend/convex/testing.ts packages/backend/convex/topics.test.ts packages/backend/convex/anonymous.test.ts packages/backend/convex/commentary.test.ts packages/backend/convex/authed-publish.test.ts packages/backend/convex/thread-follow-on.test.ts packages/backend/convex/screenshot.test.ts
git commit -m "feat(backend): require 1-3 topics at publish; write join rows"
```

---

## Task 5: toFeedItem topics projection + assignTopicsDev backfill

**Files:**
- Modify: `packages/backend/convex/annotations.ts:17-73` (`toFeedItem`)
- Modify: `packages/backend/convex/testing.ts` (add `assignTopicsDev`)

- [ ] **Step 1: Add the topics read to `toFeedItem`**

In `toFeedItem` (annotations.ts:17), before the `return {` (line 40) add:
```ts
  const topicRows = await ctx.db
    .query("annotationTopics")
    .withIndex("by_annotation", (q) => q.eq("annotationId", annotation._id))
    .collect();
  const topics = (
    await Promise.all(topicRows.map((r) => ctx.db.get(r.topicId)))
  )
    .filter((t): t is Doc<"topics"> => t !== null)
    .map((t) => ({ slug: t.slug, name: t.name }));
```
Then add `topics,` to the returned object (e.g. right after `clipCount,`).

- [ ] **Step 2: Add `assignTopicsDev` to `testing.ts`**

Append to `packages/backend/convex/testing.ts`:
```ts
/**
 * Test-only: (re)assign topics to an existing annotation so launch rooms aren't
 * empty before the composer flow has tagged content. Token-guarded; idempotent
 * (clears prior topic rows first). DEBT: a launch-bootstrap helper, not production.
 */
export const assignTopicsDev = mutation({
  args: {
    annotationId: v.id("annotations"),
    topicIds: v.array(v.id("topics")),
    workerToken: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.workerToken !== process.env.WORKER_AUTH_TOKEN) {
      throw new Error("Unauthorized");
    }
    const annotation = await ctx.db.get(args.annotationId);
    if (!annotation) throw new Error("Annotation not found");
    const existing = await ctx.db
      .query("annotationTopics")
      .withIndex("by_annotation", (q) => q.eq("annotationId", args.annotationId))
      .collect();
    for (const row of existing) await ctx.db.delete(row._id);
    for (const topicId of args.topicIds) {
      await ctx.db.insert("annotationTopics", {
        annotationId: args.annotationId,
        topicId,
        publishedAt: annotation.publishedAt ?? Date.now(),
      });
    }
    return null;
  },
});
```

- [ ] **Step 3: Typecheck + run suite + commit**

Run: `cd packages/backend && pnpm typecheck && pnpm vitest run`
Expected: PASS.
```bash
git add packages/backend/convex/annotations.ts packages/backend/convex/testing.ts
git commit -m "feat(backend): project topics onto feed cards + assignTopicsDev"
```

---

## Task 6: listByTopic ranked query

**Files:**
- Modify: `packages/backend/convex/annotations.ts` (imports + new `listByTopic`)
- Test: `packages/backend/convex/topics.test.ts` (ranking half)

- [ ] **Step 1: Write the failing ranking test**

Append to `packages/backend/convex/topics.test.ts`:
```ts
test("listByTopic ranks Hot/Top/New and collapses thread follow-ons", async () => {
  const t = convexTest(schema, modules);
  const [tech] = await topicIds(t, ["tech"]);

  const sourceId = await t.run(async (ctx) =>
    ctx.db.insert("sources", {
      type: "article",
      canonicalUrl: "https://example.com/x",
      title: "Src",
    })
  );
  const authorId = await t.run(async (ctx) =>
    ctx.db.insert("users", { clerkId: "u1", username: "u1", displayName: "U1" })
  );

  // Three clips in `tech`: old+high-votes, new+no-votes, mid+downvoted.
  async function clip(publishedAt: number, likeCount: number, downCount: number) {
    return await t.run(async (ctx) => {
      const id = await ctx.db.insert("annotations", {
        authorId,
        sourceId,
        commentaryText: "c",
        isPublic: true,
        publishedAt,
        commentCount: 0,
        likeCount,
        downCount,
      });
      await ctx.db.insert("annotationTopics", { annotationId: id, topicId: tech, publishedAt });
      return id;
    });
  }
  const oldHigh = await clip(1_000_000, 50, 0);
  const newZero = await clip(9_000_000, 0, 0);
  const midNeg = await clip(5_000_000, 0, 8);

  const top = await t.query(api.annotations.listByTopic, { slug: "tech", sort: "top" });
  expect(top?.items.map((i) => i._id)).toEqual([oldHigh, newZero, midNeg]);

  const fresh = await t.query(api.annotations.listByTopic, { slug: "tech", sort: "new" });
  expect(fresh?.items.map((i) => i._id)).toEqual([newZero, midNeg, oldHigh]);

  const hot = await t.query(api.annotations.listByTopic, { slug: "tech", sort: "hot" });
  expect(hot?.items[0]?._id).toBe(newZero); // newest dominates at low vote counts
  expect(hot?.topic.slug).toBe("tech");

  // Unknown slug returns null.
  expect(await t.query(api.annotations.listByTopic, { slug: "nope", sort: "hot" })).toBeNull();
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `cd packages/backend && pnpm vitest run topics`
Expected: FAIL — `listByTopic` does not exist.

- [ ] **Step 3: Implement `listByTopic`**

At the top of `annotations.ts`, extend the shared import (line ~ where other imports are) to include the ranker:
```ts
import { rankAnnotations } from "@annotated/shared";
```
Append the query (after `listByAuthor`):
```ts
const TOPIC_CANDIDATE_CAP = 1000;
const TOPIC_PAGE_SIZE = 50;

/**
 * A topic room: published clips carrying `slug`, ranked by `sort`. Candidates are
 * the most-recent rows from the `by_topic` index (capped), thread follow-ons are
 * collapsed to their head, then the pure ranker orders them. Null when the slug
 * is unknown so the page can 404.
 */
export const listByTopic = query({
  args: {
    slug: v.string(),
    sort: v.union(v.literal("hot"), v.literal("top"), v.literal("new")),
  },
  handler: async (ctx, args) => {
    const topic = await ctx.db
      .query("topics")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (!topic) return null;

    const joins = await ctx.db
      .query("annotationTopics")
      .withIndex("by_topic", (q) => q.eq("topicId", topic._id))
      .order("desc")
      .take(TOPIC_CANDIDATE_CAP);

    const annotations = (
      await Promise.all(joins.map((j) => ctx.db.get(j.annotationId)))
    ).filter(
      (a): a is Doc<"annotations"> =>
        a !== null &&
        a.isPublic &&
        (a.threadId === undefined || a.threadOrder === 0)
    );

    const ranked = rankAnnotations(annotations, args.sort).slice(0, TOPIC_PAGE_SIZE);
    return {
      topic: { slug: topic.slug, name: topic.name, description: topic.description },
      items: await Promise.all(ranked.map((a) => toFeedItem(ctx, a))),
    };
  },
});
```

- [ ] **Step 4: Run ranking test — expect PASS**

Run: `cd packages/backend && pnpm vitest run topics`
Expected: PASS.

- [ ] **Step 5: Typecheck + full suite + commit**

Run: `cd packages/backend && pnpm typecheck && pnpm vitest run`
```bash
git add packages/backend/convex/annotations.ts packages/backend/convex/topics.test.ts
git commit -m "feat(backend): listByTopic ranked topic-room query"
```

---

## Task 7: Web url helper + topic chips on cards

**Files:**
- Modify: `apps/web/app/_lib/urls.ts`
- Modify: `apps/web/app/_components/annotation-card.tsx`

- [ ] **Step 1: Add `topicPath`**

Append to `apps/web/app/_lib/urls.ts`:
```ts
export function topicPath(slug: string): string {
  return `/topics/${slug}`;
}
```

- [ ] **Step 2: Add `topics` to `FeedItem` + render chips**

In `apps/web/app/_components/annotation-card.tsx`, add to the `FeedItem` interface (after `author`):
```ts
  topics?: { slug: string; name: string }[];
```
Then, in the JSX, after the commentary block (the `item.commentaryText ? … : null}` block, ~line 127) and before the `{source && (` source-link block, add:
```tsx
      {item.topics && item.topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pt-3">
          {item.topics.map((t) => (
            <Link
              key={t.slug}
              href={`/topics/${t.slug}`}
              className="border-2 border-[color:var(--b-line)] bg-[color:var(--b-card)] px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-[color:var(--b-ink)] hover:bg-[color:var(--b-acid)]"
            >
              #{t.name}
            </Link>
          ))}
        </div>
      )}
```

- [ ] **Step 3: Typecheck + commit**

Run: `cd apps/web && pnpm typecheck`
Expected: PASS.
```bash
git add apps/web/app/_lib/urls.ts apps/web/app/_components/annotation-card.tsx
git commit -m "feat(web): topic chips on clip cards + topicPath helper"
```

---

## Task 8: /topics directory page

**Files:**
- Create: `apps/web/app/topics/page.tsx`

- [ ] **Step 1: Write the page**

`apps/web/app/topics/page.tsx`:
```tsx
import Link from "next/link";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { SiteHeader } from "../_components/site-header";

interface TopicSummary {
  _id: string;
  slug: string;
  name: string;
  description?: string;
}

const listTopics = makeFunctionReference<"query", Record<string, never>, TopicSummary[]>(
  "topics:list"
);

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

async function fetchTopics(): Promise<TopicSummary[]> {
  if (!convexUrl) throw new Error("Missing NEXT_PUBLIC_CONVEX_URL");
  try {
    const client = new ConvexHttpClient(convexUrl);
    return await client.query(listTopics, {});
  } catch {
    return [];
  }
}

export const metadata = { title: "Topics — Annotated" };

export default async function TopicsPage() {
  const topics = await fetchTopics();
  return (
    <main className="flex min-h-screen flex-1 flex-col">
      <SiteHeader />
      <div className="mx-auto w-full max-w-[1100px] px-6 py-8">
        <h1 className="mb-6 font-display text-3xl tracking-tight text-[color:var(--b-onbg)]">
          TOPICS
        </h1>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {topics.map((t) => (
            <Link
              key={t.slug}
              href={`/topics/${t.slug}`}
              className="block border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] p-4 text-[color:var(--b-ink)] shadow-[6px_6px_0_0_var(--b-shadow)] hover:bg-[color:var(--b-acid)]"
            >
              <p className="font-display text-xl leading-tight">#{t.name}</p>
              {t.description && (
                <p className="mt-1.5 text-[13px] font-semibold leading-snug text-[color:var(--b-dim)]">
                  {t.description}
                </p>
              )}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `cd apps/web && pnpm typecheck`
```bash
git add apps/web/app/topics/page.tsx
git commit -m "feat(web): /topics directory page"
```

---

## Task 9: /topics/[slug] room + sort tabs

**Files:**
- Create: `apps/web/app/_components/topic-feed.tsx`
- Create: `apps/web/app/topics/[slug]/page.tsx`

- [ ] **Step 1: Write the client topic feed (tabs + ranked cards)**

`apps/web/app/_components/topic-feed.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@annotated/backend/convex/_generated/api";
import { AnnotationCard, type FeedItem } from "./annotation-card";

const SORTS = [
  ["hot", "Hot"],
  ["top", "Top"],
  ["new", "New"],
] as const;
type Sort = (typeof SORTS)[number][0];

/** A topic room's ranked feed with Hot/Top/New tabs. Real-time via useQuery. */
export function TopicFeed({ slug }: { slug: string }) {
  const [sort, setSort] = useState<Sort>("hot");
  const data = useQuery(api.annotations.listByTopic, { slug, sort });
  const items = (data?.items ?? []) as FeedItem[];

  return (
    <div>
      <div className="mb-5 flex gap-2">
        {SORTS.map(([value, label]) => (
          <button
            key={value}
            onClick={() => setSort(value)}
            className={`border-[3px] border-[color:var(--b-line)] px-3 py-1.5 font-mono text-[12px] font-bold uppercase tracking-[0.12em] shadow-[4px_4px_0_0_var(--b-shadow)] ${
              sort === value
                ? "bg-[color:var(--b-chrome)] text-[color:var(--b-acid)]"
                : "bg-[color:var(--b-card)] text-[color:var(--b-ink)] hover:bg-[color:var(--b-acid)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {data === undefined ? (
        <p className="font-mono text-sm text-[color:var(--b-dim)]">Loading…</p>
      ) : items.length === 0 ? (
        <p className="font-mono text-sm text-[color:var(--b-dim)]">
          No clips in this topic yet.
        </p>
      ) : (
        <div className="gap-6 md:columns-2 [&>*]:break-inside-avoid">
          {items.map((item) => (
            <AnnotationCard key={item._id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write the server page (404 + header)**

`apps/web/app/topics/[slug]/page.tsx`:
```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { SiteHeader } from "../../_components/site-header";
import { TopicFeed } from "../../_components/topic-feed";

interface TopicSummary {
  _id: string;
  slug: string;
  name: string;
  description?: string;
}

const getBySlug = makeFunctionReference<"query", { slug: string }, TopicSummary | null>(
  "topics:getBySlug"
);

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

async function fetchTopic(slug: string): Promise<TopicSummary | null> {
  if (!convexUrl) throw new Error("Missing NEXT_PUBLIC_CONVEX_URL");
  try {
    const client = new ConvexHttpClient(convexUrl);
    return await client.query(getBySlug, { slug });
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const topic = await fetchTopic(slug);
  if (!topic) return { title: "Not found — Annotated" };
  return { title: `#${topic.name} — Annotated` };
}

export default async function TopicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const topic = await fetchTopic(slug);
  if (!topic) notFound();

  return (
    <main className="flex min-h-screen flex-1 flex-col">
      <SiteHeader />
      <div className="mx-auto w-full max-w-[800px] px-6 py-8">
        <header className="mb-6">
          <h1 className="font-display text-3xl tracking-tight text-[color:var(--b-onbg)]">
            #{topic.name}
          </h1>
          {topic.description && (
            <p className="mt-2 text-[15px] font-semibold text-[color:var(--b-dim-onbg)]">
              {topic.description}
            </p>
          )}
        </header>
        <TopicFeed slug={topic.slug} />
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Typecheck + build + commit**

Run: `cd apps/web && pnpm typecheck`
Expected: PASS.
```bash
git add apps/web/app/_components/topic-feed.tsx apps/web/app/topics/[slug]/page.tsx
git commit -m "feat(web): /topics/[slug] room with Hot/Top/New tabs"
```

---

## Task 10: Topics nav link + global feed topic rail

**Files:**
- Modify: `apps/web/app/_components/left-nav.tsx`
- Create: `apps/web/app/_components/topic-rail.tsx`
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Add the Topics nav item**

In `apps/web/app/_components/left-nav.tsx`, change the `items` array (line 3-6) to:
```ts
const items = [
  { label: "Latest", glyph: "◷", href: "/", active: true },
  { label: "Topics", glyph: "#", href: "/topics", active: false },
  { label: "For You", glyph: "✦", href: "/", active: false },
];
```

- [ ] **Step 2: Write the topic rail (client)**

`apps/web/app/_components/topic-rail.tsx`:
```tsx
"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@annotated/backend/convex/_generated/api";

/** A horizontal rail of topic chips above the feed — navigation into rooms. */
export function TopicRail() {
  const topics = useQuery(api.topics.list, {});
  if (!topics || topics.length === 0) return null;
  return (
    <div className="mb-5 flex flex-wrap gap-2">
      {topics.map((t) => (
        <Link
          key={t.slug}
          href={`/topics/${t.slug}`}
          className="border-2 border-[color:var(--b-line)] bg-[color:var(--b-card)] px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--b-ink)] hover:bg-[color:var(--b-acid)]"
        >
          #{t.name}
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Mount the rail above the feed**

In `apps/web/app/page.tsx`, add the import and render it inside the feed `<section>` above `<Feed />`:
```tsx
import { TopicRail } from "./_components/topic-rail";
```
```tsx
        <section className="min-w-0">
          <TopicRail />
          <Feed />
        </section>
```

- [ ] **Step 4: Typecheck + commit**

Run: `cd apps/web && pnpm typecheck`
```bash
git add apps/web/app/_components/left-nav.tsx apps/web/app/_components/topic-rail.tsx apps/web/app/page.tsx
git commit -m "feat(web): Topics nav link + feed topic rail"
```

---

## Task 11: Extension TopicPicker component

**Files:**
- Create: `apps/extension/components/topic-picker.tsx`

- [ ] **Step 1: Write the picker**

`apps/extension/components/topic-picker.tsx`:
```tsx
import { useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";

interface TopicSummary {
  _id: string;
  slug: string;
  name: string;
}

const listTopics = makeFunctionReference<"query", Record<string, never>, TopicSummary[]>(
  "topics:list"
);

const MAX_TOPICS = 3;

/**
 * Multi-select topic chips for the publish composers. Enforces 1-3 selection in
 * the UI (publish is gated on `selected.length >= 1` by the parent). Selection is
 * lifted to the parent as an array of topic ids.
 */
export function TopicPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const topics = useQuery(listTopics, {});

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id));
    } else if (selected.length < MAX_TOPICS) {
      onChange([...selected, id]);
    }
  }

  if (topics === undefined) {
    return <p style={{ fontSize: 12, opacity: 0.6 }}>Loading topics…</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em" }}>
        Topics (pick 1–3)
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {topics.map((t) => {
          const active = selected.includes(t._id);
          const atCap = !active && selected.length >= MAX_TOPICS;
          return (
            <button
              key={t._id}
              type="button"
              onClick={() => toggle(t._id)}
              disabled={atCap}
              style={{
                border: "2px solid #111",
                background: active ? "#d9fb06" : "#fff",
                color: "#111",
                padding: "3px 7px",
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                cursor: atCap ? "not-allowed" : "pointer",
                opacity: atCap ? 0.4 : 1,
              }}
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

- [ ] **Step 2: Typecheck + commit**

Run: `cd apps/extension && pnpm typecheck`
Expected: PASS.
```bash
git add apps/extension/components/topic-picker.tsx
git commit -m "feat(extension): TopicPicker multi-select component"
```

---

## Task 12: Wire TopicPicker into the YouTube (authed) composer

**Files:**
- Modify: `apps/extension/lib/convex-publish.ts`
- Modify: `apps/extension/components/clip-composer.tsx`

- [ ] **Step 1: Add `topicIds` to the authed publish args**

In `apps/extension/lib/convex-publish.ts`, add to `YoutubePublishArgs` (after `threadId?`):
```ts
  topicIds: string[];
```

- [ ] **Step 2: Wire selection + gating into the composer**

In `apps/extension/components/clip-composer.tsx`:
- import the picker: `import { TopicPicker } from "./topic-picker";`
- add state near the other `useState`s: `const [topicIds, setTopicIds] = useState<string[]>([]);`
- render `<TopicPicker selected={topicIds} onChange={setTopicIds} />` next to the `CommentaryComposer` in the publish form.
- pass `topicIds` into the `publishYoutubeAuthed({ ... })` call (line ~211).
- gate the publish button: add `|| topicIds.length === 0` to its existing `disabled={…}` expression, and show a hint when `topicIds.length === 0` (e.g. reuse the existing error/hint text node with "Pick at least one topic").

- [ ] **Step 3: Typecheck + build + commit**

Run: `cd apps/extension && pnpm typecheck && pnpm build`
Expected: PASS / build OK.
```bash
git add apps/extension/lib/convex-publish.ts apps/extension/components/clip-composer.tsx
git commit -m "feat(extension): require topics in the YouTube composer"
```

---

## Task 13: Wire TopicPicker into the podcast + article composers

**Files:**
- Modify: `apps/extension/components/transcript-canvas.tsx`
- Modify: `apps/extension/components/article-panel.tsx`

- [ ] **Step 1: Podcast (transcript-canvas.tsx)**

The dev mutation `testing:publishPodcastClipDev` now requires `topicIds`. In `transcript-canvas.tsx`:
- import `TopicPicker`.
- add `const [topicIds, setTopicIds] = useState<string[]>([]);`
- render `<TopicPicker selected={topicIds} onChange={setTopicIds} />` near the commentary input.
- add `topicIds,` to the `publish({ ... })` mutation args.
- add `|| topicIds.length === 0` to the publish button's `disabled` expression + a "Pick at least one topic" hint.

- [ ] **Step 2: Article (article-panel.tsx)**

Same five edits in `article-panel.tsx` against its `testing:publishArticleClipDev` `publish({ ... })` call.

- [ ] **Step 3: Typecheck + build + commit**

Run: `cd apps/extension && pnpm typecheck && pnpm build`
```bash
git add apps/extension/components/transcript-canvas.tsx apps/extension/components/article-panel.tsx
git commit -m "feat(extension): require topics in podcast + article composers"
```

---

## Task 14: Web E2E — topic room + directory + chips

**Files:**
- Create: `apps/web/e2e/topics.spec.ts` (match the existing web Playwright config/location; if web has no e2e dir, create the Playwright config mirroring the extension's e2e setup, or add to the existing web test runner).

> **Note:** Confirm the web app's existing E2E harness location/command before writing (search for `playwright.config` under `apps/web`). If the web app has no Playwright harness yet, scope this task to a manual verification checklist instead (Task 16 covers live verification) and skip the automated spec.

- [ ] **Step 1: Write the spec (requires seeded topics + at least one tagged clip in the target deployment)**

```ts
import { test, expect } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";

test("topics directory lists rooms and links into them", async ({ page }) => {
  await page.goto(`${BASE}/topics`);
  await expect(page.getByRole("heading", { name: "TOPICS" })).toBeVisible();
  const firstRoom = page.getByRole("link", { name: /#/ }).first();
  await expect(firstRoom).toBeVisible();
  await firstRoom.click();
  await expect(page).toHaveURL(/\/topics\//);
});

test("topic room shows Hot/Top/New tabs and switches sort", async ({ page }) => {
  await page.goto(`${BASE}/topics/tech`);
  await expect(page.getByRole("button", { name: "Hot" })).toBeVisible();
  await page.getByRole("button", { name: "New" }).click();
  await expect(page.getByRole("button", { name: "New" })).toBeVisible();
});

test("unknown topic 404s", async ({ page }) => {
  const res = await page.goto(`${BASE}/topics/this-is-not-a-topic`);
  expect(res?.status()).toBe(404);
});
```

- [ ] **Step 2: Run against a local dev server (after Task 16 seeds topics) — expect PASS**

Run: `cd apps/web && E2E_BASE_URL=http://localhost:3000 pnpm exec playwright test topics`
Expected: PASS (requires the dev server + seeded topics; run after Task 16's seed).

- [ ] **Step 3: Commit**
```bash
git add apps/web/e2e/topics.spec.ts
git commit -m "test(web): topic directory + room E2E"
```

---

## Task 15: Extension E2E — publish gated on topic selection

**Files:**
- Create: `apps/extension/e2e/topics-publish.e2e.mjs` (mirror the existing loaded-extension harness — see `apps/extension/e2e/*.e2e.mjs` and the memory note "Loaded-extension E2E harness").

- [ ] **Step 1: Write the loaded-extension test**

Mirror an existing `*.e2e.mjs` (e.g. the YouTube publish E2E): launch Chromium with `--load-extension`, drive the sidepanel to the publish form, then assert:
- the publish button is **disabled** when no topic chip is selected;
- after clicking one topic chip, the button **enables**;
- completing publish creates an annotation whose `annotationTopics` rows match (verify via `convex run` or the resulting `/topics/[slug]` room containing the new card).

Use the same selectors/utilities as the existing YouTube publish E2E; the only new assertions are the disabled→enabled gate and one topic chip click before publish.

- [ ] **Step 2: Run it — expect PASS**

Run: `cd apps/extension && node e2e/topics-publish.e2e.mjs`
Expected: PASS (gate enforced, publish writes join rows).

- [ ] **Step 3: Commit**
```bash
git add apps/extension/e2e/topics-publish.e2e.mjs
git commit -m "test(extension): publish gated on topic selection"
```

---

## Task 16: Rollout (live, gated on Tarik's go-ahead)

**Files:** none (deploy + seed only).

- [ ] **Step 1: Confirm full offline green**

Run from repo root: `pnpm -r typecheck && pnpm -r test`
Expected: shared + backend + worker suites all PASS; all packages typecheck.

- [ ] **Step 2: ASK before the schema push**

The schema change + seed run hit the **shared** Convex `strong-eel-665` (local + prod). **Stop and ask Tarik** before proceeding. Only on his go-ahead:

- [ ] **Step 3: Push schema + functions**

Run (from `packages/backend`): `npx convex dev --once`
Expected: schema + functions deploy clean (new `topics` / `annotationTopics` tables; new functions registered).

- [ ] **Step 4: Seed canonical topics**

Run: `npx convex run topics:seedTopics`
Expected: returns the count created (15 on first run, 0 on re-run).

- [ ] **Step 5: Place a few existing clips into rooms (avoid empty launch)**

For 3–5 existing annotation ids, run `assignTopicsDev` with a relevant topic id (look topic ids up with `npx convex run topics:list`). Example:
```bash
npx convex run testing:assignTopicsDev '{"annotationId":"<id>","topicIds":["<topicId>"],"workerToken":"<WORKER_AUTH_TOKEN>"}'
```

- [ ] **Step 6: Run the E2E from Tasks 14–15 against the seeded deployment**

Expected: web + extension E2E PASS.

- [ ] **Step 7: Deploy web + reload the extension**

Web → Vercel (project `annotated`): the standard deploy. Reload the unpacked extension locally. **Worker is untouched — no Fly deploy.**

- [ ] **Step 8: Live verification (per the project's "never assert without verification" rule)**

In a browser: `/topics` lists rooms; a room renders ranked cards and the Hot/Top/New tabs switch; a card's topic chip links to its room; the global feed shows the topic rail; publishing a fresh clip in the extension requires a topic and the clip appears in the chosen room. Screenshot the room + a card with chips.

---

## Self-Review notes

- **Spec coverage:** Design §1 → Task 2/3; §2 (publish threading, listByTopic, projection, backfill) → Tasks 4/5/6; §3 (ranker) → Task 1; §4 (room, directory, chips, rail) → Tasks 7/8/9/10; §5 (composers, tests, rollout) → Tasks 11/12/13/14/15/16. ✓
- **Route deviation:** topic rooms at `/topics/[slug]` (not `/t/[slug]`) — `/t/[id]` is threads. Documented in the header.
- **Hot formula unit fix:** the design doc prose said "~12.5h per order of magnitude" but its inline formula divided ms by 45000 (off by 1000×). Task 1 divides **seconds** by 45000 to match the intended 12.5h tradeoff.
- **Breakage caught:** required `topicIds` breaks 5 existing publish-path test files — Task 4 Step 7 updates all five.
- **Type consistency:** `topicIds: string[]` (extension) → `v.array(v.id("topics"))` (Convex args) → `Id<"topics">[]` (`assertTopics`, `insertAnnotation`); card `topics?: {slug,name}[]` matches the `toFeedItem` projection.
