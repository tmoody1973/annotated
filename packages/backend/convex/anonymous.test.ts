import { convexTest, type TestConvex } from "convex-test";
import { beforeAll, expect, test } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.*s");
const WORKER_TOKEN = "test-worker-token";

beforeAll(() => {
  process.env.WORKER_AUTH_TOKEN = WORKER_TOKEN;
});

async function oneTopic(t: TestConvex<typeof schema>): Promise<Id<"topics">[]> {
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

const quote = "an anonymous quote";
const articleBase = {
  canonicalUrl: "https://example.com/anon",
  title: "Anon Article",
  selectedText: quote,
  textStart: 0,
  textEnd: quote.length,
  commentaryText: "my anonymous take",
  workerToken: WORKER_TOKEN,
};

test("anonymous annotation masks the author everywhere and never projects authorId", async () => {
  const t = convexTest(schema, modules);

  const annId = await t.mutation(api.testing.publishArticleClipDev, {
    ...articleBase,
    isAnonymous: true,
    topicIds: await oneTopic(t),
  });

  // The row keeps authorId server-side (for claims/moderation).
  const row = await t.run((ctx) => ctx.db.get(annId));
  expect(row?.isAnonymous).toBe(true);
  expect(row?.authorId).toBeTruthy();

  // The landing projection masks identity and does NOT include authorId.
  const view = await t.query(api.annotations.getById, { annotationId: annId });
  expect(view?.isAnonymous).toBe(true);
  expect(view?.author).toBeNull();
  expect(
    (view as unknown as { authorId?: unknown }).authorId
  ).toBeUndefined();

  // The feed projection masks identity too.
  const feed = await t.query(api.annotations.listFeed, {
    paginationOpts: { numItems: 50, cursor: null },
  });
  const feedItem = feed.page.find((p) => p._id === annId);
  expect(feedItem?.isAnonymous).toBe(true);
  expect(feedItem?.author).toBeNull();

  // It does not surface on the author's public profile.
  const authorId = row!.authorId;
  const profile = await t.query(api.annotations.listByAuthor, { authorId });
  expect(profile.some((p) => p._id === annId)).toBe(false);
});

test("a non-anonymous annotation still projects the author (default-off unchanged)", async () => {
  const t = convexTest(schema, modules);

  const annId = await t.mutation(api.testing.publishArticleClipDev, {
    ...articleBase,
    topicIds: await oneTopic(t),
  });

  const view = await t.query(api.annotations.getById, { annotationId: annId });
  expect(view?.isAnonymous).toBe(false);
  expect(view?.author).not.toBeNull();
  expect(view?.author?.displayName).toBeTruthy();

  const profile = await t.query(api.annotations.listByAuthor, {
    authorId: view!.author!.id,
  });
  expect(profile.some((p) => p._id === annId)).toBe(true);
});
