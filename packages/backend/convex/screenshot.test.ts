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
  commentaryText: "my take",
  workerToken: WORKER_TOKEN,
};

test("article publish persists a source screenshot and getById projects its URL", async () => {
  const t = convexTest(schema, modules);
  const screenshotStorageId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["fake-jpeg-bytes"], { type: "image/jpeg" }))
  );

  const annId = await t.mutation(api.testing.publishArticleClipDev, {
    ...articleBase,
    screenshotStorageId,
    topicIds: await oneTopic(t),
  });

  const row = await t.run((ctx) => ctx.db.get(annId));
  expect(row?.screenshotStorageId).toBe(screenshotStorageId);

  const view = await t.query(api.annotations.getById, { annotationId: annId });
  expect(view?.screenshotUrl).toBeTruthy();
});

test("article publish without a screenshot leaves screenshotUrl null (graceful absence)", async () => {
  const t = convexTest(schema, modules);

  const annId = await t.mutation(api.testing.publishArticleClipDev, {
    ...articleBase,
    topicIds: await oneTopic(t),
  });

  const view = await t.query(api.annotations.getById, { annotationId: annId });
  expect(view?.screenshotUrl).toBeNull();
});
