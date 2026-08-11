import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const IDENTITY = { subject: "user_clips", name: "Clip Tester", email: "clips@example.com" };

/** Signs in, ensures the users row, and creates one topic to publish against. */
async function setup() {
  const t = convexTest(schema, modules);
  const asUser = t.withIdentity(IDENTITY);
  await asUser.mutation(api.users.ensureCurrentUser, {});
  const topicId = await t.run(async (ctx) =>
    ctx.db.insert("topics", { slug: "ai", name: "AI" })
  );
  return { t, asUser, topicId };
}

describe("optimistic publish", () => {
  test("creates a YouTube annotation with no clip yet, marked processing", async () => {
    const { t, asUser, topicId } = await setup();

    const annotationId = await asUser.mutation(api.annotations.createYoutube, {
      videoId: "abc123",
      title: "The AI capex bubble",
      clipStartMs: 60_000,
      clipEndMs: 120_000,
      commentaryText: "This is exactly backwards.",
      topicIds: [topicId],
    });

    const row = await t.run(async (ctx) => ctx.db.get(annotationId));
    expect(row?.mediaState).toBe("processing");
    expect(row?.clipStorageId).toBeUndefined();
    expect(row?.isPublic).toBe(true);
  });

  test("still rejects a publish with no commentary", async () => {
    const { asUser, topicId } = await setup();
    await expect(
      asUser.mutation(api.annotations.createYoutube, {
        videoId: "abc123",
        title: "No take",
        clipStartMs: 0,
        clipEndMs: 30_000,
        topicIds: [topicId],
      })
    ).rejects.toThrow(/Commentary is required/);
  });

  test("still rejects a span over 90 seconds", async () => {
    const { asUser, topicId } = await setup();
    await expect(
      asUser.mutation(api.annotations.createYoutube, {
        videoId: "abc123",
        title: "Too long",
        clipStartMs: 0,
        clipEndMs: 120_000,
        commentaryText: "Nope",
        topicIds: [topicId],
      })
    ).rejects.toThrow(/Invalid clip span/);
  });
});

describe("slice lifecycle", () => {
  test("attachClip moves a processing row to ready", async () => {
    const { t, asUser, topicId } = await setup();
    const annotationId = await asUser.mutation(api.annotations.createYoutube, {
      videoId: "abc123",
      title: "Ready flow",
      clipStartMs: 0,
      clipEndMs: 30_000,
      commentaryText: "Take",
      topicIds: [topicId],
    });

    const storageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob(["fake-mp4"], { type: "video/mp4" }))
    );
    await t.mutation(internal.clips.attachClip, { annotationId, clipStorageId: storageId });

    const row = await t.run(async (ctx) => ctx.db.get(annotationId));
    expect(row?.mediaState).toBe("ready");
    expect(row?.clipStorageId).toBe(storageId);
  });

  test("markFailed records the reason and does not unpublish the row", async () => {
    const { t, asUser, topicId } = await setup();
    const annotationId = await asUser.mutation(api.annotations.createYoutube, {
      videoId: "abc123",
      title: "Failed flow",
      clipStartMs: 0,
      clipEndMs: 30_000,
      commentaryText: "Take",
      topicIds: [topicId],
    });

    await t.mutation(internal.clips.markFailed, {
      annotationId,
      reason: "Clip generation failed",
    });

    const row = await t.run(async (ctx) => ctx.db.get(annotationId));
    expect(row?.mediaState).toBe("failed");
    expect(row?.isPublic).toBe(true);
  });

  test("attachClip on an already-failed row still succeeds (late worker reply)", async () => {
    const { t, asUser, topicId } = await setup();
    const annotationId = await asUser.mutation(api.annotations.createYoutube, {
      videoId: "abc123",
      title: "Late reply",
      clipStartMs: 0,
      clipEndMs: 30_000,
      commentaryText: "Take",
      topicIds: [topicId],
    });
    await t.mutation(internal.clips.markFailed, { annotationId, reason: "timeout" });

    const storageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob(["fake-mp4"], { type: "video/mp4" }))
    );
    await t.mutation(internal.clips.attachClip, { annotationId, clipStorageId: storageId });

    const row = await t.run(async (ctx) => ctx.db.get(annotationId));
    expect(row?.mediaState).toBe("ready");
  });
});
