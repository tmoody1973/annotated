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
      takeText: "This is exactly backwards.",
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
    ).rejects.toThrow(/A take is required/);
  });

  test("still rejects a span over 90 seconds", async () => {
    const { asUser, topicId } = await setup();
    await expect(
      asUser.mutation(api.annotations.createYoutube, {
        videoId: "abc123",
        title: "Too long",
        clipStartMs: 0,
        clipEndMs: 120_000,
        takeText: "Nope",
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
      takeText: "Take",
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
      takeText: "Take",
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
      takeText: "Take",
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

  test("markFailed does not clobber a row that already attached its clip", async () => {
    const { t, asUser, topicId } = await setup();
    const annotationId = await asUser.mutation(api.annotations.createYoutube, {
      videoId: "abc123",
      title: "Already ready",
      clipStartMs: 0,
      clipEndMs: 30_000,
      takeText: "Take",
      topicIds: [topicId],
    });
    const storageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob(["fake-mp4"], { type: "video/mp4" }))
    );
    await t.mutation(internal.clips.attachClip, { annotationId, clipStorageId: storageId });

    // A late/duplicate failure callback arrives after attachClip already won.
    await t.mutation(internal.clips.markFailed, { annotationId, reason: "late timeout" });

    const row = await t.run(async (ctx) => ctx.db.get(annotationId));
    expect(row?.mediaState).toBe("ready");
    expect(row?.clipStorageId).toBe(storageId);
  });

  test("attachClip deletes the blob it replaces on a re-slice", async () => {
    const { t, asUser, topicId } = await setup();
    const annotationId = await asUser.mutation(api.annotations.createYoutube, {
      videoId: "abc123",
      title: "Re-slice",
      clipStartMs: 0,
      clipEndMs: 30_000,
      takeText: "Take",
      topicIds: [topicId],
    });
    const firstStorageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob(["first"], { type: "video/mp4" }))
    );
    await t.mutation(internal.clips.attachClip, {
      annotationId,
      clipStorageId: firstStorageId,
    });

    const secondStorageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob(["second"], { type: "video/mp4" }))
    );
    await t.mutation(internal.clips.attachClip, {
      annotationId,
      clipStorageId: secondStorageId,
    });

    const row = await t.run(async (ctx) => ctx.db.get(annotationId));
    expect(row?.clipStorageId).toBe(secondStorageId);
    const oldBlob = await t.run(async (ctx) => ctx.db.system.get(firstStorageId));
    expect(oldBlob).toBeNull();
  });
});

/** Inserts a podcast `sources` row and returns its id. */
async function seedPodcastSource(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) =>
    ctx.db.insert("sources", {
      type: "podcast",
      canonicalUrl: "https://example.com/episode",
      title: "Episode 1",
      podcastName: "The Show",
      mp3Url: "https://cdn.example.com/live-enclosure.mp3",
    })
  );
}

describe("podcast slice scheduling", () => {
  test("schedules slicePodcast with the frozen episodeStorageId, not mp3Url", async () => {
    const { t, asUser, topicId } = await setup();
    const sourceId = await seedPodcastSource(t);
    const episodeStorageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob(["frozen-episode"], { type: "audio/mpeg" }))
    );
    await t.run(async (ctx) =>
      ctx.db.insert("transcripts", {
        sourceId,
        provider: "deepgram",
        status: "ready",
        episodeStorageId,
      })
    );

    await asUser.mutation(api.annotations.createPodcast, {
      sourceId,
      clipStartMs: 0,
      clipEndMs: 30_000,
      selectedText: "quote",
      takeText: "take",
      topicIds: [topicId],
    });

    const scheduled = await t.run(async (ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    );
    const call = scheduled.find((row) => row.name === "clips:slicePodcast");
    expect(call?.args[0]).toMatchObject({ episodeStorageId, startMs: 0, endMs: 30_000 });
    // The frozen copy, never the live enclosure — the whole point of the fix.
    expect(call?.args[0]).not.toHaveProperty("mp3Url");
  });

  test("throws a transient message when the transcript isn't ready yet", async () => {
    const { t, asUser, topicId } = await setup();
    const sourceId = await seedPodcastSource(t);
    await t.run(async (ctx) =>
      ctx.db.insert("transcripts", { sourceId, provider: "deepgram", status: "processing" })
    );

    await expect(
      asUser.mutation(api.annotations.createPodcast, {
        sourceId,
        clipStartMs: 0,
        clipEndMs: 30_000,
        selectedText: "quote",
        takeText: "take",
        topicIds: [topicId],
      })
    ).rejects.toThrow(/still being prepared/);
  });

  test("throws a permanent message when the transcript is ready but has no frozen episode (mp3Url-only)", async () => {
    const { t, asUser, topicId } = await setup();
    const sourceId = await seedPodcastSource(t);
    // The frozen-download fallback case (transcribe.ts): transcription
    // succeeded against the live mp3Url, but no episodeStorageId exists.
    await t.run(async (ctx) =>
      ctx.db.insert("transcripts", { sourceId, provider: "deepgram", status: "ready" })
    );

    await expect(
      asUser.mutation(api.annotations.createPodcast, {
        sourceId,
        clipStartMs: 0,
        clipEndMs: 30_000,
        selectedText: "quote",
        takeText: "take",
        topicIds: [topicId],
      })
    ).rejects.toThrow(/couldn't be prepared/);
  });

  test("throws a permanent message when transcription itself failed", async () => {
    const { t, asUser, topicId } = await setup();
    const sourceId = await seedPodcastSource(t);
    await t.run(async (ctx) =>
      ctx.db.insert("transcripts", { sourceId, provider: "deepgram", status: "failed" })
    );

    await expect(
      asUser.mutation(api.annotations.createPodcast, {
        sourceId,
        clipStartMs: 0,
        clipEndMs: 30_000,
        selectedText: "quote",
        takeText: "take",
        topicIds: [topicId],
      })
    ).rejects.toThrow(/couldn't be prepared/);
  });
});
