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

test("threaded comments: one-level nesting, deeper replies flatten to top-level", async () => {
  const t = convexTest(schema, modules);
  const aliceId = await t
    .withIdentity({ subject: "clerk_alice", name: "Alice" })
    .mutation(api.users.ensureCurrentUser, {});
  const bob = t.withIdentity({ subject: "clerk_bob", name: "Bob" });
  const carol = t.withIdentity({ subject: "clerk_carol", name: "Carol" });
  await bob.mutation(api.users.ensureCurrentUser, {});
  await carol.mutation(api.users.ensureCurrentUser, {});
  const annotationId = await seedAnnotation(t, aliceId);

  // Top-level comment.
  const topId = await bob.mutation(api.comments.add, {
    annotationId,
    text: "top-level take",
  });

  // Reply to the top-level comment.
  const replyId = await carol.mutation(api.comments.add, {
    annotationId,
    text: "a reply",
    parentId: topId,
  });

  // Reply to the reply — must flatten to the same top-level parent (no depth > 1).
  const nestedId = await bob.mutation(api.comments.add, {
    annotationId,
    text: "reply to the reply",
    parentId: replyId,
  });

  // commentCount counts top + every reply.
  const ann = await t.run((ctx) => ctx.db.get(annotationId));
  expect(ann?.commentCount).toBe(3);

  // listByAnnotation returns top-level comments, each with an ordered replies[].
  const thread = await bob.query(api.comments.listByAnnotation, { annotationId });
  expect(thread).toHaveLength(1);
  const top = thread[0];
  expect(top?._id).toBe(topId);
  expect(top?.text).toBe("top-level take");
  expect(top?.author?.username).toBeTruthy();
  expect(top?.replies.map((r) => r._id)).toEqual([replyId, nestedId]);
  expect(top?.replies[0]?.text).toBe("a reply");
  expect(top?.replies[0]?.author?.username).toBeTruthy();
  expect(top?.replies[1]?.text).toBe("reply to the reply");
});

test("comment add: empty text rejected, missing/foreign parent rejected", async () => {
  const t = convexTest(schema, modules);
  const aliceId = await t
    .withIdentity({ subject: "clerk_alice", name: "Alice" })
    .mutation(api.users.ensureCurrentUser, {});
  const bob = t.withIdentity({ subject: "clerk_bob", name: "Bob" });
  await bob.mutation(api.users.ensureCurrentUser, {});
  const annotationId = await seedAnnotation(t, aliceId);
  const otherAnnotationId = await seedAnnotation(t, aliceId);

  await expect(
    bob.mutation(api.comments.add, { annotationId, text: "   " })
  ).rejects.toThrow();

  // A reply whose parent lives on a different annotation is rejected.
  const foreignParent = await bob.mutation(api.comments.add, {
    annotationId: otherAnnotationId,
    text: "elsewhere",
  });
  await expect(
    bob.mutation(api.comments.add, {
      annotationId,
      text: "mismatched reply",
      parentId: foreignParent,
    })
  ).rejects.toThrow();
});

test("commenting requires authentication", async () => {
  const t = convexTest(schema, modules);
  const aliceId = await t
    .withIdentity({ subject: "clerk_alice", name: "Alice" })
    .mutation(api.users.ensureCurrentUser, {});
  const annotationId = await seedAnnotation(t, aliceId);

  await expect(
    t.mutation(api.comments.add, { annotationId, text: "anon" })
  ).rejects.toThrow(/Not authenticated/);
});
