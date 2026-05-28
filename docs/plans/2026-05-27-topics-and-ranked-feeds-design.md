# Topics & Ranked Feeds — Design (#15, first cut)

**Date:** 2026-05-27
**Status:** Validated, ready for planning
**Scope decision:** Topic *homes* + per-topic *ranked feeds*. No membership/subscribe. Search deferred to a fast-follow phase.

## Why

The discovery interviews (`docs/discovery-interviews.md`) name topics/communities the single biggest lever from tool → platform — "a home beyond the follow-graph" (build-next #1), paired with voting-as-ranking as the discovery engine (build-next #2). Every persona asked for a room they could drop into ("podcast nerds," "media accountability," "tech/investing with the best clips ranked"). This phase delivers that room and ranks it with the votes already collected on annotations. It is post-bounty growth, not a bounty requirement.

## Decisions (locked during brainstorming)

1. **Scope:** topic homes + ranked feed; no join/subscribe mechanics.
2. **Topic model:** canonical `topics` table, joined to **annotations** (not sources), 1–3 per clip. Ranking is per-clip because votes live on annotations and a clip's angle can differ from its source's general subject.
3. **Assignment:** manual, **require ≥1** topic at publish (server-enforced). Guarantees every clip has a home. Auto-suggest is a later layer that pre-fills the same join — no schema change.
4. **Ranking:** Hot (default) + Top + New, computed in-memory at query time over a bounded candidate set. No denormalized score field yet.
5. **Search:** deferred to its own phase. Browse-by-topic + ranking delivers most "find clips" value now.

## Section 1 — Data model

Two new tables. The clip↔topic relationship is a **join table**, not an array on the annotation, because the topic-home feed must read "all clips in topic X, recency-bounded" efficiently — Convex can index a join but cannot index "array contains X".

```ts
topics: defineTable({
  slug: v.string(),            // stable url key: "media-accountability"
  name: v.string(),            // display: "Media & Accountability"
  description: v.optional(v.string()),
  sortOrder: v.optional(v.number()),   // directory ordering
}).index("by_slug", ["slug"]),

annotationTopics: defineTable({
  annotationId: v.id("annotations"),
  topicId: v.id("topics"),
  publishedAt: v.number(),     // denormalized from the annotation — immutable, so no drift
}).index("by_topic", ["topicId", "publishedAt"])  // recency-bounded topic feed
  .index("by_annotation", ["annotationId"]),       // a card's chips
```

`publishedAt` is copied into the join row so a topic feed pulls the most-recent N candidates by index, then ranks those in-memory. It is set once and never changes — no sync hazard.

**Seed topics** (one-shot internal mutation, ~15 to start, refine the wording later):

> News & Politics · Media & Accountability · Tech · Business & Investing · Science · Health · Education · Culture & Arts · History · Sports · Comedy · True Crime · Society · Climate · Ideas & Philosophy

No existing tables change — topics live entirely in the two new tables plus the publish path.

## Section 2 — Backend functions (`packages/backend/convex/`)

**Reads (public queries):**
- `topics.list` → all topics, `sortOrder` then name. Powers the directory page and the composer selector.
- `topics.getBySlug(slug)` → one topic for the `/t/[slug]` header (404 if missing).
- `annotations.listByTopic({ slug, sort })` → the ranked topic home. Resolves the topic, pulls candidate join rows via `by_topic` (desc, capped at ~1000 most-recent to bound cost), hydrates each annotation, ranks **in-memory** by `sort` (`hot` | `top` | `new`) using the shared ranker. `new` skips ranking and pages directly off the index.

**Writes — threading `topicIds` through the publish path:**
- `insertAnnotation` (shared insert, `annotations.ts:140`) gains a `topicIds: Id<"topics">[]` input. After inserting the annotation, it writes one `annotationTopics` row per topic, copying the annotation's `publishedAt`.
- All four publish entry points — `createYoutube` (real-auth) plus the three `publish*Dev` — add `topicIds: v.array(v.id("topics"))` and validate **1–3 ids, each existing** before insert. Server-side, so the "require ≥1" rule holds regardless of client.

**Card chips:** `toFeedItem` (shared projection) gains a small `by_annotation` read returning each clip's `{slug, name}[]` so feed/landing/topic cards render chips and link to rooms.

**Backfill:** existing annotations have no topics and simply won't appear in rooms — acceptable. Add a token-guarded `testing.assignTopicsDev(annotationId, topicIds)` to place a few existing clips into rooms and avoid empty-room cold-start at launch. No bulk migration.

## Section 3 — Ranking math (`@annotated/shared`, pure + TDD'd)

`rankAnnotations(candidates, sort, now)` returns the candidates ordered. Net score is free from existing fields:

```
net(a) = a.likeCount - (a.downCount ?? 0)
```

- **New** — `publishedAt` desc, no scoring.
- **Top** — `net` desc, tie-break `publishedAt` desc. The window ("this week" vs "all-time") is just which candidates the query passes in; the ranker is window-agnostic.
- **Hot** — the standard Reddit hot algorithm (handles downvotes gracefully):

```
order = log10(max(|net|, 1))
sign  = net > 0 ? 1 : net < 0 ? -1 : 0
hot(a) = sign * order + (a.publishedAt / 45000)   // ms epoch; newer ⇒ larger
```

Sort `hot` desc. Newer beats older at equal vote weight; each order of magnitude of net votes is worth ~12.5 hours of freshness.

Pure function in shared because ranking is easy to get subtly wrong and painful to debug live — same rationale as the clip-span and VTT-parser helpers.

**Test cases (RED first):** zero-vote clips order by recency only; higher net outranks lower; recent outranks old at equal net; negative net sinks below zero; ties break by `publishedAt`; empty set returns empty; absent `downCount` (legacy rows) reads as 0.

The Convex `listByTopic` query calls this after hydration — no ranking logic in the backend.

## Section 4 — Web surfaces (Next.js App Router, reusing the `--b-*` brutalist system + the feed card)

- **`/t/[slug]` — topic home.** Header (name + description), three sort tabs **Hot · Top · New** (client component flipping the `sort` arg), then the ranked card list using *the same card component as the global feed*, fed by `listByTopic`. Unknown slug → 404 (mirrors `/u/[username]`). `New` paginates; `Hot`/`Top` return the ranked bounded set (no infinite scroll for ranked sorts in v1 — known ceiling).
- **`/topics` — directory.** Brutalist grid of all topics (name + description), each linking to its room. Added to `SiteHeader` as a **Topics** nav link.
- **Topic chips on every card.** Feed, landing (`/a/[id]`), and profile cards render their clip's topic chips (from the `toFeedItem` projection), each linking to `/t/[slug]`. Every clip becomes a doorway into its rooms.
- **Global feed "filtering."** A horizontal **topic rail** at the top of `/` — chips that route to rooms — plus the per-card chips. Delivers the discovery value of filtering via navigation. True in-place multi-topic filtering is deferred.

## Section 5 — Extension composer + testing/rollout

**Extension (Plasmo sidepanel).** A shared `TopicPicker` component sits alongside the existing `CommentaryComposer` in all three flows (`clip-composer`, `podcast-clipper`, `article-panel`). It queries `topics.list` via the extension's Convex client and renders canonical topics as multi-select chips, **min 1 / max 3**. Publish stays disabled until ≥1 is selected; chosen `topicIds` pass into the publish mutation. Styling stays hand-rolled brutalist to match the current composers — the full `--b-*` migration is a *separate* tracked task and is not entangled here.

**Testing (TDD):**
- **Shared:** ranker unit tests (Section 3), RED first.
- **Convex (`convex-test`):** `listByTopic` Hot/Top/New ordering; publish validation accepts 1–3 ids and **rejects 0, >3, and non-existent topic ids**.
- **E2E:** loaded-extension — publish blocked with no topic, succeeds with topics and writes join rows; web Playwright — `/t/[slug]` renders ranked + tabs switch, `/topics` lists, card chips link to rooms.

**Rollout (careful).** Real schema change + seed mutation on the **shared** Convex `strong-eel-665` (local *and* prod) — **ask before `convex dev --once`** per standing rule. Sequence: deploy schema+functions → run seed-topics once → `assignTopicsDev` a handful of existing clips so launch rooms aren't empty → deploy web to Vercel → reload the local extension. **Worker is untouched.**

## Known ceilings / deferred (documented, not bugs)

- Ranked sorts (`Hot`/`Top`) bound to ~1000 candidates per topic; revisit with a denormalized `hotScore` + index only if a single topic exceeds that.
- No infinite scroll on ranked sorts in v1 (`New` paginates).
- No in-place multi-topic filtering of the global feed (rail + chips route to rooms instead).
- Auto-suggest topics at publish — later friction-reducer, pre-fills the same join, no schema change.
- Search (clips/people/topics) — its own fast-follow phase.
- Membership/subscribe + a personalized "my topics" feed — a later phase if topics prove out.
