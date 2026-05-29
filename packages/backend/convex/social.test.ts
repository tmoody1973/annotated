import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

test("auth-gated social flow with mocked Clerk identities", async () => {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({ subject: "clerk_alice", name: "Alice" });
  const bob = t.withIdentity({ subject: "clerk_bob", name: "Bob" });

  const aliceId = await alice.mutation(api.users.ensureCurrentUser, {});
  const bobId = await bob.mutation(api.users.ensureCurrentUser, {});

  // Seed a public annotation authored by Alice.
  const annotationId = await t.run(async (ctx) => {
    const sourceId = await ctx.db.insert("sources", {
      type: "article",
      canonicalUrl: "https://example.com/post",
      title: "Test Article",
    });
    return await ctx.db.insert("annotations", {
      authorId: aliceId,
      sourceId,
      selectedText: "quote",
      commentaryText: "take",
      isPublic: true,
      publishedAt: Date.now(),
      commentCount: 0,
      likeCount: 0,
    });
  });

  // Like: toggle on, then off — idempotent, count recomputed (never drifts/negative).
  expect(await bob.mutation(api.likes.toggleLike, { annotationId })).toEqual({
    liked: true,
    likeCount: 1,
  });
  expect(await bob.query(api.likes.isLiked, { annotationId })).toBe(true);
  expect(await bob.mutation(api.likes.toggleLike, { annotationId })).toEqual({
    liked: false,
    likeCount: 0,
  });

  // Comment: add increments commentCount; listByAnnotation joins the author.
  await bob.mutation(api.comments.add, { annotationId, text: "great clip" });
  const after = await t.run((ctx) => ctx.db.get(annotationId));
  expect(after?.commentCount).toBe(1);
  const comments = await bob.query(api.comments.listByAnnotation, { annotationId });
  expect(comments).toHaveLength(1);
  expect(comments[0]?.text).toBe("great clip");
  expect(comments[0]?.author?.username).toBeTruthy();

  // Empty comment is rejected.
  await expect(
    bob.mutation(api.comments.add, { annotationId, text: "   " })
  ).rejects.toThrow();

  // Follow: toggle on/off + counts; self-follow rejected.
  expect(await bob.mutation(api.follows.toggleFollow, { targetUserId: aliceId })).toEqual({
    following: true,
  });
  expect(await bob.query(api.follows.isFollowing, { targetUserId: aliceId })).toBe(true);
  expect(await t.query(api.follows.getCounts, { userId: aliceId })).toEqual({
    followers: 1,
    following: 0,
  });
  expect(await bob.mutation(api.follows.toggleFollow, { targetUserId: aliceId })).toEqual({
    following: false,
  });
  await expect(
    bob.mutation(api.follows.toggleFollow, { targetUserId: bobId })
  ).rejects.toThrow(/yourself/);

  // Unauthenticated calls are rejected.
  await expect(t.mutation(api.likes.toggleLike, { annotationId })).rejects.toThrow(
    /Not authenticated/
  );
});

test("feed projects an author's verified flag", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const uid = await ctx.db.insert("users", {
      clerkId: "clerk_verified",
      username: "verified_user",
      displayName: "Verified User",
      isVerified: true,
    });
    const sourceId = await ctx.db.insert("sources", {
      type: "article",
      canonicalUrl: "https://example.com/v",
      title: "V",
    });
    await ctx.db.insert("annotations", {
      authorId: uid,
      sourceId,
      selectedText: "q",
      commentaryText: "c",
      isPublic: true,
      publishedAt: Date.now(),
      commentCount: 0,
      likeCount: 0,
    });
  });
  const feed = await t.query(api.annotations.listFeed, { paginationOpts: { numItems: 10, cursor: null } });
  const card = feed.page.find((c) => c.author?.username === "verified_user");
  expect(card?.author?.isVerified).toBe(true);
});
