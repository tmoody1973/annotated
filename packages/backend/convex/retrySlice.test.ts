import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.*s");

/** A published YouTube annotation in the given media state. */
async function seedYoutube(
  t: ReturnType<typeof convexTest>,
  authorId: Id<"users">,
  mediaState: "processing" | "ready" | "failed" | undefined,
) {
  return await t.run(async (ctx) => {
    const sourceId = await ctx.db.insert("sources", {
      type: "youtube",
      canonicalUrl: "https://www.youtube.com/watch?v=kX1Sd17KbLY",
      title: "WTF is happening to Reddit",
      youtubeVideoId: "kX1Sd17KbLY",
    });
    return await ctx.db.insert("annotations", {
      authorId,
      sourceId,
      clipStartMs: 120_000,
      clipEndMs: 180_000,
      takeText: "the advertising model is interesting",
      isPublic: true,
      publishedAt: Date.now(),
      commentCount: 0,
      likeCount: 0,
      ...(mediaState ? { mediaState } : {}),
    });
  });
}

describe("clips.retrySlice", () => {
  test("re-runs a failed slice in place, keeping the same annotation", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "clerk_owner", name: "Owner" });
    const ownerId = await owner.mutation(api.users.ensureCurrentUser, {});
    const annotationId = await seedYoutube(t, ownerId, "failed");

    expect(await owner.mutation(api.clips.retrySlice, { annotationId })).toEqual({
      retried: true,
    });

    // Same row, flipped back to processing — not a new annotation at a new URL.
    const after = await t.run(async (ctx) => ctx.db.get(annotationId));
    expect(after?.mediaState).toBe("processing");
    expect(after?.takeText).toBe("the advertising model is interesting");
  });

  test("refuses someone else's clip", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "clerk_owner", name: "Owner" });
    const stranger = t.withIdentity({ subject: "clerk_other", name: "Other" });
    const ownerId = await owner.mutation(api.users.ensureCurrentUser, {});
    await stranger.mutation(api.users.ensureCurrentUser, {});
    const annotationId = await seedYoutube(t, ownerId, "failed");

    await expect(
      stranger.mutation(api.clips.retrySlice, { annotationId }),
    ).rejects.toThrow(/only the person who published/i);

    // And the row is untouched by the attempt.
    const after = await t.run(async (ctx) => ctx.db.get(annotationId));
    expect(after?.mediaState).toBe("failed");
  });

  test("refuses an unauthenticated caller", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "clerk_owner", name: "Owner" });
    const ownerId = await owner.mutation(api.users.ensureCurrentUser, {});
    const annotationId = await seedYoutube(t, ownerId, "failed");

    await expect(t.mutation(api.clips.retrySlice, { annotationId })).rejects.toThrow(
      /not authenticated/i,
    );
  });

  test("will not rebuild a clip that already worked", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "clerk_owner", name: "Owner" });
    const ownerId = await owner.mutation(api.users.ensureCurrentUser, {});
    const annotationId = await seedYoutube(t, ownerId, "ready");

    const result = await owner.mutation(api.clips.retrySlice, { annotationId });
    expect(result.retried).toBe(false);
    expect(result.reason).toMatch(/failed state/i);
  });

  test("will not pile a second slice onto one already processing", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "clerk_owner", name: "Owner" });
    const ownerId = await owner.mutation(api.users.ensureCurrentUser, {});
    const annotationId = await seedYoutube(t, ownerId, "processing");

    expect((await owner.mutation(api.clips.retrySlice, { annotationId })).retried).toBe(
      false,
    );
  });

  test("says so plainly when the source has nothing to rebuild from", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "clerk_owner", name: "Owner" });
    const ownerId = await owner.mutation(api.users.ensureCurrentUser, {});
    const annotationId = await t.run(async (ctx) => {
      const sourceId = await ctx.db.insert("sources", {
        type: "article",
        canonicalUrl: "https://example.com/piece",
        title: "A piece",
      });
      return await ctx.db.insert("annotations", {
        authorId: ownerId,
        sourceId,
        clipStartMs: 0,
        clipEndMs: 1_000,
        takeText: "take",
        isPublic: true,
        publishedAt: Date.now(),
        commentCount: 0,
        likeCount: 0,
        mediaState: "failed",
      });
    });

    const result = await owner.mutation(api.clips.retrySlice, { annotationId });
    expect(result.retried).toBe(false);
    expect(result.reason).toMatch(/no clip to rebuild/i);
  });

  test("refuses a podcast retry when the frozen episode is gone", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "clerk_owner", name: "Owner" });
    const ownerId = await owner.mutation(api.users.ensureCurrentUser, {});
    const annotationId = await t.run(async (ctx) => {
      const sourceId = await ctx.db.insert("sources", {
        type: "podcast",
        canonicalUrl: "https://example.com/ep",
        title: "An episode",
      });
      // A transcript with no episodeStorageId: clipping the live enclosure
      // instead would drift against ad insertion.
      await ctx.db.insert("transcripts", {
        sourceId,
        provider: "deepgram",
        status: "ready",
        wordsJson: "[]",
      });
      return await ctx.db.insert("annotations", {
        authorId: ownerId,
        sourceId,
        clipStartMs: 10_000,
        clipEndMs: 70_000,
        takeText: "take",
        isPublic: true,
        publishedAt: Date.now(),
        commentCount: 0,
        likeCount: 0,
        mediaState: "failed",
      });
    });

    const result = await owner.mutation(api.clips.retrySlice, { annotationId });
    expect(result.retried).toBe(false);
    expect(result.reason).toMatch(/no longer stored/i);
  });
});

describe("clips.canRetry", () => {
  test("true for the author of a failed clip", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "clerk_owner", name: "Owner" });
    const ownerId = await owner.mutation(api.users.ensureCurrentUser, {});
    const annotationId = await seedYoutube(t, ownerId, "failed");
    expect(await owner.query(api.clips.canRetry, { annotationId })).toBe(true);
  });

  test("false for a stranger, so the button never shows them a dead end", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "clerk_owner", name: "Owner" });
    const stranger = t.withIdentity({ subject: "clerk_other", name: "Other" });
    const ownerId = await owner.mutation(api.users.ensureCurrentUser, {});
    await stranger.mutation(api.users.ensureCurrentUser, {});
    const annotationId = await seedYoutube(t, ownerId, "failed");
    expect(await stranger.query(api.clips.canRetry, { annotationId })).toBe(false);
  });

  test("false when signed out", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "clerk_owner", name: "Owner" });
    const ownerId = await owner.mutation(api.users.ensureCurrentUser, {});
    const annotationId = await seedYoutube(t, ownerId, "failed");
    expect(await t.query(api.clips.canRetry, { annotationId })).toBe(false);
  });

  test("true for the author of an anonymous clip — anonymity hides the name, not ownership", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "clerk_owner", name: "Owner" });
    const ownerId = await owner.mutation(api.users.ensureCurrentUser, {});
    const annotationId = await t.run(async (ctx) => {
      const sourceId = await ctx.db.insert("sources", {
        type: "youtube",
        canonicalUrl: "https://www.youtube.com/watch?v=abc",
        title: "A video",
        youtubeVideoId: "abc",
      });
      return await ctx.db.insert("annotations", {
        authorId: ownerId,
        sourceId,
        clipStartMs: 0,
        clipEndMs: 60_000,
        takeText: "take",
        isAnonymous: true,
        isPublic: true,
        publishedAt: Date.now(),
        commentCount: 0,
        likeCount: 0,
        mediaState: "failed",
      });
    });
    expect(await owner.query(api.clips.canRetry, { annotationId })).toBe(true);
  });

  test("false once the clip is ready — nothing to retry", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "clerk_owner", name: "Owner" });
    const ownerId = await owner.mutation(api.users.ensureCurrentUser, {});
    const annotationId = await seedYoutube(t, ownerId, "ready");
    expect(await owner.query(api.clips.canRetry, { annotationId })).toBe(false);
  });
});
