import { convexTest, type TestConvex } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.*s");

/** Seeds the canonical topic set and returns an array of one topic id. */
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

/** A throwaway storage blob so clip-bearing mutations have a real storageId. */
async function seedClipStorage(
  t: TestConvex<typeof schema>
): Promise<Id<"_storage">> {
  return await t.run(async (ctx) => ctx.storage.store(new Blob(["clip"])));
}

/** Inserts a minimal podcast source row and returns its id. */
async function seedPodcastSource(
  t: TestConvex<typeof schema>
): Promise<Id<"sources">> {
  return await t.run(async (ctx) =>
    ctx.db.insert("sources", {
      type: "podcast",
      canonicalUrl: "https://example.com/podcast/ep1",
      title: "Test Episode",
      podcastName: "Test Show",
      mp3Url: "https://cdn.example.com/ep1.mp3",
    })
  );
}

/** Inserts a non-podcast (youtube) source row so we can test type rejection. */
async function seedYoutubeSource(
  t: TestConvex<typeof schema>
): Promise<Id<"sources">> {
  return await t.run(async (ctx) =>
    ctx.db.insert("sources", {
      type: "youtube",
      canonicalUrl: "https://www.youtube.com/watch?v=abc123",
      title: "Test Video",
      youtubeVideoId: "abc123",
    })
  );
}

// ---------------------------------------------------------------------------
// createPodcast
// ---------------------------------------------------------------------------

test("createPodcast attributes the clip to the signed-in user", async () => {
  const t = convexTest(schema, modules);
  const tarik = t.withIdentity({ subject: "clerk_tarik", name: "Tarik" });
  const tarikId = await tarik.mutation(api.users.ensureCurrentUser, {});
  const clipStorageId = await seedClipStorage(t);
  const sourceId = await seedPodcastSource(t);

  const annotationId = await tarik.mutation(api.annotations.createPodcast, {
    sourceId,
    clipStorageId,
    clipStartMs: 0,
    clipEndMs: 10_000,
    selectedText: "This is the transcript quote",
    commentaryText: "my take on this",
    topicIds: await oneTopic(t),
  });

  const stored = await t.run((ctx) => ctx.db.get(annotationId));
  expect(stored?.authorId).toBe(tarikId);
  expect(stored?.isPublic).toBe(true);
  expect(stored?.selectedText).toBe("This is the transcript quote");
});

test("createPodcast writes annotationTopics join rows", async () => {
  const t = convexTest(schema, modules);
  const tarik = t.withIdentity({ subject: "clerk_tarik", name: "Tarik" });
  await tarik.mutation(api.users.ensureCurrentUser, {});
  const clipStorageId = await seedClipStorage(t);
  const sourceId = await seedPodcastSource(t);
  const topics = await oneTopic(t);

  const annotationId = await tarik.mutation(api.annotations.createPodcast, {
    sourceId,
    clipStorageId,
    clipStartMs: 0,
    clipEndMs: 10_000,
    selectedText: "A quote from the transcript",
    commentaryText: "take",
    topicIds: topics,
  });

  const joins = await t.run(async (ctx) =>
    ctx.db
      .query("annotationTopics")
      .withIndex("by_annotation", (q) => q.eq("annotationId", annotationId))
      .collect()
  );
  expect(joins.map((j) => j.topicId)).toEqual(topics);
});

test("createPodcast rejects a non-podcast source", async () => {
  const t = convexTest(schema, modules);
  const tarik = t.withIdentity({ subject: "clerk_tarik", name: "Tarik" });
  await tarik.mutation(api.users.ensureCurrentUser, {});
  const clipStorageId = await seedClipStorage(t);
  const youtubeSourceId = await seedYoutubeSource(t);

  await expect(
    tarik.mutation(api.annotations.createPodcast, {
      sourceId: youtubeSourceId,
      clipStorageId,
      clipStartMs: 0,
      clipEndMs: 10_000,
      selectedText: "some quote",
      commentaryText: "take",
      topicIds: await oneTopic(t),
    })
  ).rejects.toThrow("Source is not a podcast");
});

test("createPodcast rejects an unauthenticated caller", async () => {
  const t = convexTest(schema, modules);
  const clipStorageId = await seedClipStorage(t);
  const sourceId = await seedPodcastSource(t);

  await expect(
    t.mutation(api.annotations.createPodcast, {
      sourceId,
      clipStorageId,
      clipStartMs: 0,
      clipEndMs: 10_000,
      selectedText: "some quote",
      commentaryText: "take",
      topicIds: await oneTopic(t),
    })
  ).rejects.toThrow("Not authenticated");
});

test("createPodcast rejects zero topics", async () => {
  const t = convexTest(schema, modules);
  const tarik = t.withIdentity({ subject: "clerk_tarik", name: "Tarik" });
  await tarik.mutation(api.users.ensureCurrentUser, {});
  const clipStorageId = await seedClipStorage(t);
  const sourceId = await seedPodcastSource(t);

  await expect(
    tarik.mutation(api.annotations.createPodcast, {
      sourceId,
      clipStorageId,
      clipStartMs: 0,
      clipEndMs: 10_000,
      selectedText: "some quote",
      commentaryText: "take",
      topicIds: [],
    })
  ).rejects.toThrow(/1.?3 topics/);
});

test("createPodcast rejects more than 3 topics", async () => {
  const t = convexTest(schema, modules);
  const tarik = t.withIdentity({ subject: "clerk_tarik", name: "Tarik" });
  await tarik.mutation(api.users.ensureCurrentUser, {});
  const clipStorageId = await seedClipStorage(t);
  const sourceId = await seedPodcastSource(t);
  await t.mutation(internal.topics.seedTopics, {});
  const fourTopics = await t.run(async (ctx) => {
    const rows = await ctx.db.query("topics").take(4);
    return rows.map((r) => r._id);
  });

  await expect(
    tarik.mutation(api.annotations.createPodcast, {
      sourceId,
      clipStorageId,
      clipStartMs: 0,
      clipEndMs: 10_000,
      selectedText: "some quote",
      commentaryText: "take",
      topicIds: fourTopics,
    })
  ).rejects.toThrow(/1.?3 topics/);
});

// ---------------------------------------------------------------------------
// createArticle
// ---------------------------------------------------------------------------

test("createArticle attributes the clip to the signed-in user", async () => {
  const t = convexTest(schema, modules);
  const tarik = t.withIdentity({ subject: "clerk_tarik", name: "Tarik" });
  const tarikId = await tarik.mutation(api.users.ensureCurrentUser, {});
  const quote = "Hello world";

  const annotationId = await tarik.mutation(api.annotations.createArticle, {
    canonicalUrl: "https://example.com/article",
    title: "An Article",
    selectedText: quote,
    textStart: 0,
    textEnd: quote.length,
    commentaryText: "my take",
    topicIds: await oneTopic(t),
  });

  const stored = await t.run((ctx) => ctx.db.get(annotationId));
  expect(stored?.authorId).toBe(tarikId);
  expect(stored?.isPublic).toBe(true);
  expect(stored?.selectedText).toBe(quote);
  expect(stored?.textStart).toBe(0);
  expect(stored?.textEnd).toBe(quote.length);
});

test("createArticle writes annotationTopics join rows", async () => {
  const t = convexTest(schema, modules);
  const tarik = t.withIdentity({ subject: "clerk_tarik", name: "Tarik" });
  await tarik.mutation(api.users.ensureCurrentUser, {});
  const quote = "Some highlighted text";
  const topics = await oneTopic(t);

  const annotationId = await tarik.mutation(api.annotations.createArticle, {
    canonicalUrl: "https://example.com/story",
    title: "A Story",
    selectedText: quote,
    textStart: 5,
    textEnd: 5 + quote.length,
    commentaryText: "interesting",
    topicIds: topics,
  });

  const joins = await t.run(async (ctx) =>
    ctx.db
      .query("annotationTopics")
      .withIndex("by_annotation", (q) => q.eq("annotationId", annotationId))
      .collect()
  );
  expect(joins.map((j) => j.topicId)).toEqual(topics);
});

test("createArticle rejects an unauthenticated caller", async () => {
  const t = convexTest(schema, modules);
  const quote = "Some text";

  await expect(
    t.mutation(api.annotations.createArticle, {
      canonicalUrl: "https://example.com/article",
      title: "An Article",
      selectedText: quote,
      textStart: 0,
      textEnd: quote.length,
      commentaryText: "take",
      topicIds: await oneTopic(t),
    })
  ).rejects.toThrow("Not authenticated");
});

test("createArticle rejects an empty quote", async () => {
  const t = convexTest(schema, modules);
  const tarik = t.withIdentity({ subject: "clerk_tarik", name: "Tarik" });
  await tarik.mutation(api.users.ensureCurrentUser, {});

  await expect(
    tarik.mutation(api.annotations.createArticle, {
      canonicalUrl: "https://example.com/article",
      title: "An Article",
      selectedText: "   ",
      textStart: 0,
      textEnd: 3,
      commentaryText: "take",
      topicIds: await oneTopic(t),
    })
  ).rejects.toThrow("A highlighted quote is required");
});

test("createArticle rejects bad offsets (length mismatch)", async () => {
  const t = convexTest(schema, modules);
  const tarik = t.withIdentity({ subject: "clerk_tarik", name: "Tarik" });
  await tarik.mutation(api.users.ensureCurrentUser, {});

  await expect(
    tarik.mutation(api.annotations.createArticle, {
      canonicalUrl: "https://example.com/article",
      title: "An Article",
      selectedText: "Hello",
      textStart: 0,
      textEnd: 99, // length mismatch: "Hello".length === 5, not 99
      commentaryText: "take",
      topicIds: await oneTopic(t),
    })
  ).rejects.toThrow("Highlight offsets are invalid");
});

test("createArticle rejects negative textStart", async () => {
  const t = convexTest(schema, modules);
  const tarik = t.withIdentity({ subject: "clerk_tarik", name: "Tarik" });
  await tarik.mutation(api.users.ensureCurrentUser, {});
  const quote = "Hello";

  await expect(
    tarik.mutation(api.annotations.createArticle, {
      canonicalUrl: "https://example.com/article",
      title: "An Article",
      selectedText: quote,
      textStart: -1,
      textEnd: -1 + quote.length,
      commentaryText: "take",
      topicIds: await oneTopic(t),
    })
  ).rejects.toThrow("Highlight offsets are invalid");
});

test("createArticle rejects zero topics", async () => {
  const t = convexTest(schema, modules);
  const tarik = t.withIdentity({ subject: "clerk_tarik", name: "Tarik" });
  await tarik.mutation(api.users.ensureCurrentUser, {});
  const quote = "A valid quote";

  await expect(
    tarik.mutation(api.annotations.createArticle, {
      canonicalUrl: "https://example.com/article",
      title: "An Article",
      selectedText: quote,
      textStart: 0,
      textEnd: quote.length,
      commentaryText: "take",
      topicIds: [],
    })
  ).rejects.toThrow(/1.?3 topics/);
});

test("createArticle rejects more than 3 topics", async () => {
  const t = convexTest(schema, modules);
  const tarik = t.withIdentity({ subject: "clerk_tarik", name: "Tarik" });
  await tarik.mutation(api.users.ensureCurrentUser, {});
  const quote = "A valid quote";
  await t.mutation(internal.topics.seedTopics, {});
  const fourTopics = await t.run(async (ctx) => {
    const rows = await ctx.db.query("topics").take(4);
    return rows.map((r) => r._id);
  });

  await expect(
    tarik.mutation(api.annotations.createArticle, {
      canonicalUrl: "https://example.com/article",
      title: "An Article",
      selectedText: quote,
      textStart: 0,
      textEnd: quote.length,
      commentaryText: "take",
      topicIds: fourTopics,
    })
  ).rejects.toThrow(/1.?3 topics/);
});
