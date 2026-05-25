import { convexTest } from "convex-test";
import { beforeAll, expect, test } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");
const WORKER_TOKEN = "test-worker-token";

beforeAll(() => {
  process.env.WORKER_AUTH_TOKEN = WORKER_TOKEN;
});

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

  // text-only — unchanged behavior
  const textId = await t.mutation(api.testing.publishArticleClipDev, {
    ...articleBase,
    commentaryText: "my take",
  });
  expect(textId).toBeTruthy();

  // audio-only — store a fake mp3 blob, publish with no text
  const audioStorageId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["fake-mp3-bytes"], { type: "audio/mpeg" }))
  );
  const audioAnnId = await t.mutation(api.testing.publishArticleClipDev, {
    ...articleBase,
    commentaryAudioStorageId: audioStorageId,
  });
  const row = await t.run((ctx) => ctx.db.get(audioAnnId));
  expect(row?.commentaryAudioStorageId).toBe(audioStorageId);
  expect(row?.commentaryText).toBeUndefined();

  // getById projects a playable commentary audio URL
  const view = await t.query(api.annotations.getById, { annotationId: audioAnnId });
  expect(view?.commentaryAudioUrl).toBeTruthy();

  // neither text nor audio — rejected
  await expect(
    t.mutation(api.testing.publishArticleClipDev, { ...articleBase })
  ).rejects.toThrow();
});

test("youtube publish: audio-only lands via assertPublishable, neither is rejected", async () => {
  const t = convexTest(schema, modules);
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
      workerToken: WORKER_TOKEN,
    })
  ).rejects.toThrow();
});
