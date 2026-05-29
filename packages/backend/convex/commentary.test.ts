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

const quote = "a quoted passage";
const articleBase = {
  canonicalUrl: "https://example.com/post",
  title: "Test Article",
  selectedText: quote,
  textStart: 0,
  textEnd: quote.length,
  workerToken: WORKER_TOKEN,
};

test("article publish: text-only lands, audio-only lands, neither is rejected", async () => {
  const t = convexTest(schema, modules);
  const topics = await oneTopic(t);

  // text-only — unchanged behavior
  const textId = await t.mutation(api.testing.publishArticleClipDev, {
    ...articleBase,
    commentaryText: "my take",
    topicIds: topics,
  });
  expect(textId).toBeTruthy();

  // audio-only — store a fake mp3 blob, publish with no text
  const audioStorageId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["fake-mp3-bytes"], { type: "audio/mpeg" }))
  );
  const audioAnnId = await t.mutation(api.testing.publishArticleClipDev, {
    ...articleBase,
    commentaryAudioStorageId: audioStorageId,
    topicIds: topics,
  });
  const row = await t.run((ctx) => ctx.db.get(audioAnnId));
  expect(row?.commentaryAudioStorageId).toBe(audioStorageId);
  expect(row?.commentaryText).toBeUndefined();

  // getById projects a playable commentary audio URL
  const view = await t.query(api.annotations.getById, { annotationId: audioAnnId });
  expect(view?.commentaryAudioUrl).toBeTruthy();

  // neither text nor audio — rejected (commentary check runs before topic check)
  await expect(
    t.mutation(api.testing.publishArticleClipDev, { ...articleBase, topicIds: topics })
  ).rejects.toThrow();
});

test("article publish: a quote over the 100-word fair-use ceiling is rejected", async () => {
  const t = convexTest(schema, modules);
  const topics = await oneTopic(t);
  const overLimit = Array.from({ length: 101 }, (_, i) => `w${i}`).join(" ");
  await expect(
    t.mutation(api.testing.publishArticleClipDev, {
      ...articleBase,
      selectedText: overLimit,
      textStart: 0,
      textEnd: overLimit.length,
      commentaryText: "too long",
      topicIds: topics,
    })
  ).rejects.toThrow(/fair-use/);

  // Exactly at the ceiling is allowed.
  const atLimit = Array.from({ length: 100 }, (_, i) => `w${i}`).join(" ");
  const id = await t.mutation(api.testing.publishArticleClipDev, {
    ...articleBase,
    selectedText: atLimit,
    textStart: 0,
    textEnd: atLimit.length,
    commentaryText: "ok",
    topicIds: topics,
  });
  expect(id).toBeTruthy();
});

test("youtube publish: audio-only lands via assertPublishable, neither is rejected", async () => {
  const t = convexTest(schema, modules);
  const topics = await oneTopic(t);
  const clipStorageId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["video"], { type: "video/mp4" }))
  );
  const audioStorageId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["audio"], { type: "audio/mpeg" }))
  );

  const annId = await t.mutation(api.testing.publishYoutubeClipDev, {
    videoId: "vid-audio-only",
    title: "Clip",
    clipStorageId,
    clipStartMs: 0,
    clipEndMs: 10_000,
    commentaryAudioStorageId: audioStorageId,
    topicIds: topics,
    workerToken: WORKER_TOKEN,
  });
  expect(annId).toBeTruthy();

  await expect(
    t.mutation(api.testing.publishYoutubeClipDev, {
      videoId: "vid-empty",
      title: "Clip",
      clipStorageId,
      clipStartMs: 0,
      clipEndMs: 10_000,
      topicIds: topics,
      workerToken: WORKER_TOKEN,
    })
  ).rejects.toThrow();
});
