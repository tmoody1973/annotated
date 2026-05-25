import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.*s");

async function seedAnnotation(
  t: ReturnType<typeof convexTest>,
  authorId: Id<"users">
): Promise<Id<"annotations">> {
  return await t.run(async (ctx) => {
    const sourceId = await ctx.db.insert("sources", {
      type: "article",
      canonicalUrl: "https://example.com/post",
      title: "Test Article",
    });
    return await ctx.db.insert("annotations", {
      authorId,
      sourceId,
      selectedText: "quote",
      commentaryText: "take",
      isPublic: true,
      publishedAt: Date.now(),
      commentCount: 0,
      likeCount: 0,
    });
  });
}

test("up/down voting: cast, toggle-off, flip, drift-proof counts", async () => {
  const t = convexTest(schema, modules);
  const bob = t.withIdentity({ subject: "clerk_bob", name: "Bob" });
  const aliceId = await t
    .withIdentity({ subject: "clerk_alice", name: "Alice" })
    .mutation(api.users.ensureCurrentUser, {});
  await bob.mutation(api.users.ensureCurrentUser, {});
  const annotationId = await seedAnnotation(t, aliceId);

  // Upvote ("brilliant").
  expect(await bob.mutation(api.votes.toggleVote, { annotationId, value: 1 })).toEqual({
    myVote: 1,
    upCount: 1,
    downCount: 0,
  });
  expect(await bob.query(api.votes.getMyVote, { annotationId })).toBe(1);
  let ann = await t.run((ctx) => ctx.db.get(annotationId));
  expect(ann?.likeCount).toBe(1);
  expect(ann?.downCount).toBe(0);

  // Same arrow again clears the vote.
  expect(await bob.mutation(api.votes.toggleVote, { annotationId, value: 1 })).toEqual({
    myVote: null,
    upCount: 0,
    downCount: 0,
  });
  expect(await bob.query(api.votes.getMyVote, { annotationId })).toBe(null);

  // Downvote ("BS").
  expect(await bob.mutation(api.votes.toggleVote, { annotationId, value: -1 })).toEqual({
    myVote: -1,
    upCount: 0,
    downCount: 1,
  });

  // Opposite arrow flips (never two rows).
  expect(await bob.mutation(api.votes.toggleVote, { annotationId, value: 1 })).toEqual({
    myVote: 1,
    upCount: 1,
    downCount: 0,
  });
  const rowCount = await t.run(async (ctx) =>
    (
      await ctx.db
        .query("likes")
        .withIndex("by_annotation", (q) => q.eq("annotationId", annotationId))
        .collect()
    ).length
  );
  expect(rowCount).toBe(1);

  // Second voter downvotes → counts stay drift-proof.
  const carol = t.withIdentity({ subject: "clerk_carol", name: "Carol" });
  await carol.mutation(api.users.ensureCurrentUser, {});
  expect(await carol.mutation(api.votes.toggleVote, { annotationId, value: -1 })).toEqual({
    myVote: -1,
    upCount: 1,
    downCount: 1,
  });
  ann = await t.run((ctx) => ctx.db.get(annotationId));
  expect(ann?.likeCount).toBe(1);
  expect(ann?.downCount).toBe(1);
});

test("a pre-existing like row (no value) reads as an upvote", async () => {
  const t = convexTest(schema, modules);
  const aliceId = await t
    .withIdentity({ subject: "clerk_alice", name: "Alice" })
    .mutation(api.users.ensureCurrentUser, {});
  const dave = t.withIdentity({ subject: "clerk_dave", name: "Dave" });
  const daveId = await dave.mutation(api.users.ensureCurrentUser, {});
  const annotationId = await seedAnnotation(t, aliceId);

  // Simulate a legacy "like" with no `value` field.
  await t.run(async (ctx) => {
    await ctx.db.insert("likes", { annotationId, userId: daveId });
  });
  expect(await dave.query(api.votes.getMyVote, { annotationId })).toBe(1);

  // Flipping it to a downvote moves the counts correctly.
  expect(await dave.mutation(api.votes.toggleVote, { annotationId, value: -1 })).toEqual({
    myVote: -1,
    upCount: 0,
    downCount: 1,
  });
});

test("voting requires authentication", async () => {
  const t = convexTest(schema, modules);
  const aliceId = await t
    .withIdentity({ subject: "clerk_alice", name: "Alice" })
    .mutation(api.users.ensureCurrentUser, {});
  const annotationId = await seedAnnotation(t, aliceId);

  expect(await t.query(api.votes.getMyVote, { annotationId })).toBe(null);
  await expect(
    t.mutation(api.votes.toggleVote, { annotationId, value: 1 })
  ).rejects.toThrow(/Not authenticated/);
});
