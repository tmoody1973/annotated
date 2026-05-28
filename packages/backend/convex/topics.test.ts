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

  await expect(
    tarik.mutation(api.annotations.createYoutube, { ...base, topicIds: [] })
  ).rejects.toThrow(/1.?3 topics/);

  await expect(
    tarik.mutation(api.annotations.createYoutube, {
      ...base,
      topicIds: [tech, news, science, health],
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
