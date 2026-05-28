import { convexTest } from "convex-test";
import { beforeAll, expect, test } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.*s");
const WORKER_TOKEN = "test-worker-token";

beforeAll(() => {
  process.env.WORKER_AUTH_TOKEN = WORKER_TOKEN;
});

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

/** Publishes a standalone article clip as the seed dev user, returning its id. */
async function publishStandalone(
  t: ReturnType<typeof convexTest>,
  quote: string,
  threadId?: Id<"threads">
): Promise<Id<"annotations">> {
  return await t.mutation(api.testing.publishArticleClipDev, {
    canonicalUrl: "https://example.com/thread-source",
    title: "Threaded Source",
    selectedText: quote,
    textStart: 0,
    textEnd: quote.length,
    commentaryText: `take on ${quote}`,
    ...(threadId ? { threadId } : {}),
    topicIds: await oneTopic(t),
    workerToken: WORKER_TOKEN,
  });
}

test("§1 Phase B: first clip is standalone, then follow-ons thread in order", async () => {
  const t = convexTest(schema, modules);

  // Clip A — published standalone (no thread).
  const clipA = await publishStandalone(t, "first clip");
  const rowA0 = await t.run((ctx) => ctx.db.get(clipA));
  expect(rowA0?.threadId).toBeUndefined();

  // "Add another clip to this thread" — lazily threads A as order 0.
  const threadId = await t.mutation(api.testing.startThreadDev, {
    annotationId: clipA,
    workerToken: WORKER_TOKEN,
  });
  const rowA1 = await t.run((ctx) => ctx.db.get(clipA));
  expect(rowA1?.threadId).toBe(threadId);
  expect(rowA1?.threadOrder).toBe(0);

  // Clips B and C published with the threadId append in order 1, 2.
  const clipB = await publishStandalone(t, "second clip", threadId);
  const clipC = await publishStandalone(t, "third clip", threadId);
  const orders = await t.run(async (ctx) => ({
    b: (await ctx.db.get(clipB))?.threadOrder,
    c: (await ctx.db.get(clipC))?.threadOrder,
  }));
  expect(orders).toEqual({ b: 1, c: 2 });

  // The thread page renders A, B, C in order under one URL.
  const thread = await t.query(api.threads.getWithClips, { threadId });
  expect(thread?.clips.map((c) => c.selectedText)).toEqual([
    "first clip",
    "second clip",
    "third clip",
  ]);
});

test("startThreadDev is idempotent — a second call returns the same thread", async () => {
  const t = convexTest(schema, modules);
  const clipA = await publishStandalone(t, "only clip");

  const first = await t.mutation(api.testing.startThreadDev, {
    annotationId: clipA,
    workerToken: WORKER_TOKEN,
  });
  const second = await t.mutation(api.testing.startThreadDev, {
    annotationId: clipA,
    workerToken: WORKER_TOKEN,
  });
  expect(second).toBe(first);

  // Exactly one thread exists.
  const threadCount = await t.run(
    async (ctx) => (await ctx.db.query("threads").collect()).length
  );
  expect(threadCount).toBe(1);
});

test("startThreadDev rejects a bad token", async () => {
  const t = convexTest(schema, modules);
  const clipA = await publishStandalone(t, "guarded clip");
  await expect(
    t.mutation(api.testing.startThreadDev, {
      annotationId: clipA,
      workerToken: "wrong",
    })
  ).rejects.toThrow(/Unauthorized/);
});
