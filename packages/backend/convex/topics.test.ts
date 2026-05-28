import { convexTest, type TestConvex } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.*s");

async function seedClipStorage(t: TestConvex<typeof schema>): Promise<Id<"_storage">> {
  return await t.run(async (ctx) => ctx.storage.store(new Blob(["clip"])));
}

async function topicIds(t: TestConvex<typeof schema>, slugs: string[]): Promise<Id<"topics">[]> {
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

  await expect(
    tarik.mutation(api.annotations.createYoutube, { ...base, topicIds: [] })
  ).rejects.toThrow(/1.?3 topics/);

  await expect(
    tarik.mutation(api.annotations.createYoutube, {
      ...base,
      topicIds: [tech!, news!, science!, health!],
    })
  ).rejects.toThrow(/1.?3 topics/);

  const fakeTopicId = await t.run(async (ctx) => {
    const id = await ctx.db.insert("topics", { slug: "tmp", name: "Tmp" });
    await ctx.db.delete(id);
    return id;
  });
  await expect(
    tarik.mutation(api.annotations.createYoutube, { ...base, topicIds: [fakeTopicId] })
  ).rejects.toThrow(/Unknown topic/);

  // Duplicate topic ids rejected.
  await expect(
    tarik.mutation(api.annotations.createYoutube, { ...base, topicIds: [tech!, tech!] })
  ).rejects.toThrow(/Duplicate topic/);

  const annotationId = await tarik.mutation(api.annotations.createYoutube, {
    ...base,
    topicIds: [tech!, news!],
  });
  const joins = await t.run(async (ctx) =>
    ctx.db
      .query("annotationTopics")
      .withIndex("by_annotation", (q) => q.eq("annotationId", annotationId))
      .collect()
  );
  const annotation = await t.run((ctx) => ctx.db.get(annotationId));
  expect(joins.map((j) => j.topicId).sort()).toEqual([tech!, news!].sort());
  expect(joins.every((j) => j.publishedAt === annotation?.publishedAt)).toBe(true);
});

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
      await ctx.db.insert("annotationTopics", { annotationId: id, topicId: tech!, publishedAt });
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
  // oldHigh (50 upvotes, old) scores higher in the Reddit-style hot formula than
  // newZero (0 votes, newer): log10(50)+recency_old ≈ 1.72 > 0+recency_new ≈ 0.2.
  // A 0-vote item would need ~885 days of recency advantage to beat 50 votes.
  expect(hot?.items[0]?._id).toBe(oldHigh);
  expect(hot?.topic.slug).toBe("tech");

  expect(await t.query(api.annotations.listByTopic, { slug: "nope", sort: "hot" })).toBeNull();
});
