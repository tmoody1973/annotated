import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.*s");

async function seed(
  t: ReturnType<typeof convexTest>,
  authorId: Id<"users">,
  overrides: Record<string, unknown> = {},
) {
  return await t.run(async (ctx) => {
    const sourceId = await ctx.db.insert("sources", {
      type: "youtube",
      canonicalUrl: "https://www.youtube.com/watch?v=abc",
      title: "A video",
      youtubeVideoId: "abc",
    });
    return await ctx.db.insert("annotations", {
      authorId,
      sourceId,
      clipStartMs: 0,
      clipEndMs: 60_000,
      takeText: "I'm not sure I like like",
      isPublic: true,
      publishedAt: Date.now(),
      commentCount: 0,
      likeCount: 0,
      ...overrides,
    });
  });
}

const page = { paginationOpts: { numItems: 50, cursor: null } };

describe("annotations.remove", () => {
  test("hides the clip from the feed but keeps its page resolvable", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "clerk_owner", name: "Owner" });
    const ownerId = await owner.mutation(api.users.ensureCurrentUser, {});
    const annotationId = await seed(t, ownerId);

    expect((await t.query(api.annotations.listFeed, page)).page).toHaveLength(1);

    await owner.mutation(api.annotations.remove, { annotationId });

    // Gone from the feed...
    expect((await t.query(api.annotations.listFeed, page)).page).toHaveLength(0);
    // ...but the row survives, so a pasted link resolves to a tombstone
    // instead of a 404.
    const row = await t.run(async (ctx) => ctx.db.get(annotationId));
    expect(row).not.toBeNull();
    expect(row?.removedAt).toBeTypeOf("number");
  });

  test("disappears from the author's profile too", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "clerk_owner", name: "Owner" });
    const ownerId = await owner.mutation(api.users.ensureCurrentUser, {});
    const annotationId = await seed(t, ownerId);

    expect(await t.query(api.annotations.listByAuthor, { authorId: ownerId })).toHaveLength(1);
    await owner.mutation(api.annotations.remove, { annotationId });
    expect(await t.query(api.annotations.listByAuthor, { authorId: ownerId })).toHaveLength(0);
  });

  test("stops being counted in a thread's clip badge", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "clerk_owner", name: "Owner" });
    const ownerId = await owner.mutation(api.users.ensureCurrentUser, {});

    const threadId = await t.run(async (ctx) => {
      const sourceId = await ctx.db.insert("sources", {
        type: "youtube",
        canonicalUrl: "https://www.youtube.com/watch?v=abc",
        title: "A video",
        youtubeVideoId: "abc",
      });
      return await ctx.db.insert("threads", {
        sourceId,
        authorId: ownerId,
        createdAt: Date.now(),
      });
    });
    const head = await seed(t, ownerId, { threadId, threadOrder: 0 });
    const follow = await seed(t, ownerId, { threadId, threadOrder: 1 });

    const before = (await t.query(api.annotations.listFeed, page)).page[0];
    expect(before?.clipCount).toBe(2);

    await owner.mutation(api.annotations.remove, { annotationId: follow });

    const after = (await t.query(api.annotations.listFeed, page)).page[0];
    expect(after?.clipCount).toBe(1);
    expect(after?._id).toBe(head);
  });

  test("refuses someone else's clip", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "clerk_owner", name: "Owner" });
    const stranger = t.withIdentity({ subject: "clerk_other", name: "Other" });
    const ownerId = await owner.mutation(api.users.ensureCurrentUser, {});
    await stranger.mutation(api.users.ensureCurrentUser, {});
    const annotationId = await seed(t, ownerId);

    await expect(
      stranger.mutation(api.annotations.remove, { annotationId }),
    ).rejects.toThrow(/only the person who published/i);
    expect((await t.query(api.annotations.listFeed, page)).page).toHaveLength(1);
  });

  test("is idempotent — removing twice is not an error", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "clerk_owner", name: "Owner" });
    const ownerId = await owner.mutation(api.users.ensureCurrentUser, {});
    const annotationId = await seed(t, ownerId);
    await owner.mutation(api.annotations.remove, { annotationId });
    await expect(
      owner.mutation(api.annotations.remove, { annotationId }),
    ).resolves.toBeNull();
  });
});

describe("annotations.updateTake", () => {
  test("fixes a typo before anyone has engaged", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "clerk_owner", name: "Owner" });
    const ownerId = await owner.mutation(api.users.ensureCurrentUser, {});
    const annotationId = await seed(t, ownerId);

    expect(
      await owner.mutation(api.annotations.updateTake, {
        annotationId,
        takeText: "I'm not sure I like it",
      }),
    ).toEqual({ updated: true });

    const row = await t.run(async (ctx) => ctx.db.get(annotationId));
    expect(row?.takeText).toBe("I'm not sure I like it");
  });

  test("closes the moment someone comments — that is what they replied to", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "clerk_owner", name: "Owner" });
    const ownerId = await owner.mutation(api.users.ensureCurrentUser, {});
    const annotationId = await seed(t, ownerId, { commentCount: 1 });

    const result = await owner.mutation(api.annotations.updateTake, {
      annotationId,
      takeText: "a completely different claim",
    });
    expect(result.updated).toBe(false);
    expect(result.reason).toMatch(/replied or voted/i);
  });

  test("closes the moment someone votes — that is what they endorsed", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "clerk_owner", name: "Owner" });
    const ownerId = await owner.mutation(api.users.ensureCurrentUser, {});
    const annotationId = await seed(t, ownerId, { likeCount: 1 });

    expect(
      (await owner.mutation(api.annotations.updateTake, {
        annotationId,
        takeText: "something else",
      })).updated,
    ).toBe(false);
  });

  test("refuses an empty take and leaves the original alone", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "clerk_owner", name: "Owner" });
    const ownerId = await owner.mutation(api.users.ensureCurrentUser, {});
    const annotationId = await seed(t, ownerId);

    expect(
      (await owner.mutation(api.annotations.updateTake, { annotationId, takeText: "   " }))
        .updated,
    ).toBe(false);
    const row = await t.run(async (ctx) => ctx.db.get(annotationId));
    expect(row?.takeText).toBe("I'm not sure I like like");
  });

  test("refuses someone else's take", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "clerk_owner", name: "Owner" });
    const stranger = t.withIdentity({ subject: "clerk_other", name: "Other" });
    const ownerId = await owner.mutation(api.users.ensureCurrentUser, {});
    await stranger.mutation(api.users.ensureCurrentUser, {});
    const annotationId = await seed(t, ownerId);

    await expect(
      stranger.mutation(api.annotations.updateTake, { annotationId, takeText: "mine now" }),
    ).rejects.toThrow(/only the person who published/i);
  });
});

describe("comments.remove", () => {
  test("removes the note and keeps the visible count honest", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "clerk_owner", name: "Owner" });
    const reader = t.withIdentity({ subject: "clerk_reader", name: "Reader" });
    const ownerId = await owner.mutation(api.users.ensureCurrentUser, {});
    await reader.mutation(api.users.ensureCurrentUser, {});
    const annotationId = await seed(t, ownerId);

    const commentId = await reader.mutation(api.comments.add, {
      annotationId,
      text: "said the quiet part",
    });
    expect((await t.run(async (ctx) => ctx.db.get(annotationId)))?.commentCount).toBe(1);

    await reader.mutation(api.comments.remove, { commentId });
    expect((await t.run(async (ctx) => ctx.db.get(annotationId)))?.commentCount).toBe(0);
  });

  test("refuses someone else's note", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "clerk_owner", name: "Owner" });
    const reader = t.withIdentity({ subject: "clerk_reader", name: "Reader" });
    const ownerId = await owner.mutation(api.users.ensureCurrentUser, {});
    await reader.mutation(api.users.ensureCurrentUser, {});
    const annotationId = await seed(t, ownerId);
    const commentId = await reader.mutation(api.comments.add, {
      annotationId,
      text: "mine",
    });

    await expect(owner.mutation(api.comments.remove, { commentId })).rejects.toThrow(
      /only the person who wrote/i,
    );
  });

  test("never drives the count below zero", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "clerk_owner", name: "Owner" });
    const reader = t.withIdentity({ subject: "clerk_reader", name: "Reader" });
    const ownerId = await owner.mutation(api.users.ensureCurrentUser, {});
    await reader.mutation(api.users.ensureCurrentUser, {});
    const annotationId = await seed(t, ownerId);
    const commentId = await reader.mutation(api.comments.add, {
      annotationId,
      text: "one",
    });

    await reader.mutation(api.comments.remove, { commentId });
    await reader.mutation(api.comments.remove, { commentId });
    expect((await t.run(async (ctx) => ctx.db.get(annotationId)))?.commentCount).toBe(0);
  });
});

describe("annotations.getById after removal", () => {
  test("resolves to a tombstone: the page answers, the take does not", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "clerk_owner", name: "Owner" });
    const ownerId = await owner.mutation(api.users.ensureCurrentUser, {});
    const annotationId = await seed(t, ownerId, { selectedText: "a quote" });

    await owner.mutation(api.annotations.remove, { annotationId });

    const view = await t.query(api.annotations.getById, { annotationId });
    expect(view?.removed).toBe(true);
    // The source survives — it is the one thing a tombstone can still offer.
    expect(view?.source?.canonicalUrl).toBe("https://www.youtube.com/watch?v=abc");
    // Everything the author took down is gone from the payload, not merely
    // hidden by the page: the same query feeds the OG unfurl and share card.
    expect(view?.takeText).toBeUndefined();
    expect(view?.selectedText).toBeUndefined();
    expect(view?.clipUrl).toBeNull();
  });
});

describe("annotations.ownerActions", () => {
  test("tells the author they can edit and remove", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "clerk_owner", name: "Owner" });
    const ownerId = await owner.mutation(api.users.ensureCurrentUser, {});
    const annotationId = await seed(t, ownerId);
    expect(await owner.query(api.annotations.ownerActions, { annotationId })).toEqual({
      isOwner: true,
      canEditTake: true,
    });
  });

  test("tells a stranger nothing, so no controls render for them", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "clerk_owner", name: "Owner" });
    const stranger = t.withIdentity({ subject: "clerk_other", name: "Other" });
    const ownerId = await owner.mutation(api.users.ensureCurrentUser, {});
    await stranger.mutation(api.users.ensureCurrentUser, {});
    const annotationId = await seed(t, ownerId);
    expect(await stranger.query(api.annotations.ownerActions, { annotationId })).toEqual({
      isOwner: false,
      canEditTake: false,
    });
  });

  test("still owns an anonymous clip — anonymity hides the name, not control", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "clerk_owner", name: "Owner" });
    const ownerId = await owner.mutation(api.users.ensureCurrentUser, {});
    const annotationId = await seed(t, ownerId, { isAnonymous: true });
    expect(
      (await owner.query(api.annotations.ownerActions, { annotationId })).isOwner,
    ).toBe(true);
  });

  test("drops edit once engagement lands, keeps remove", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "clerk_owner", name: "Owner" });
    const ownerId = await owner.mutation(api.users.ensureCurrentUser, {});
    const annotationId = await seed(t, ownerId, { likeCount: 2 });
    expect(await owner.query(api.annotations.ownerActions, { annotationId })).toEqual({
      isOwner: true,
      canEditTake: false,
    });
  });
});
