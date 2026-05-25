import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { insertAnnotation } from "./annotations";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.*s");

async function seedSource(t: ReturnType<typeof convexTest>): Promise<Id<"sources">> {
  return await t.run(async (ctx) =>
    ctx.db.insert("sources", {
      type: "podcast",
      canonicalUrl: "https://example.com/ep1",
      title: "Test Episode",
    })
  );
}

test("threads: create, append clips in order, getWithClips joins source + author", async () => {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({ subject: "clerk_alice", name: "Alice" });
  const aliceId = await alice.mutation(api.users.ensureCurrentUser, {});
  const sourceId = await seedSource(t);

  const threadId = await alice.mutation(api.threads.create, { sourceId });

  // Append three clips; each gets the next 0-based order.
  const clipIds: Id<"annotations">[] = [];
  for (const label of ["first", "second", "third"]) {
    const id = await t.run((ctx) =>
      insertAnnotation(ctx, {
        authorId: aliceId,
        sourceId,
        selectedText: label,
        commentaryText: `take on ${label}`,
        threadId,
      })
    );
    clipIds.push(id);
  }

  const orders = await t.run(async (ctx) =>
    Promise.all(clipIds.map(async (id) => (await ctx.db.get(id))?.threadOrder))
  );
  expect(orders).toEqual([0, 1, 2]);

  const thread = await alice.query(api.threads.getWithClips, { threadId });
  expect(thread).not.toBeNull();
  expect(thread?.source?.title).toBe("Test Episode");
  expect(thread?.author?.username).toBeTruthy();
  expect(thread?.clips.map((c) => c.selectedText)).toEqual([
    "first",
    "second",
    "third",
  ]);
  expect(thread?.clips.map((c) => c.threadOrder)).toEqual([0, 1, 2]);
});

test("listFeed collapses a thread to one head card with a clip count", async () => {
  const t = convexTest(schema, modules);
  const aliceId = await t
    .withIdentity({ subject: "clerk_alice", name: "Alice" })
    .mutation(api.users.ensureCurrentUser, {});
  const sourceId = await seedSource(t);
  const threadId = await t
    .withIdentity({ subject: "clerk_alice", name: "Alice" })
    .mutation(api.threads.create, { sourceId });

  // Three clips in the thread.
  for (const label of ["a", "b", "c"]) {
    await t.run((ctx) =>
      insertAnnotation(ctx, {
        authorId: aliceId,
        sourceId,
        selectedText: label,
        commentaryText: "take",
        threadId,
      })
    );
  }
  // One standalone clip on a different source.
  const otherSource = await seedSource(t);
  await t.run((ctx) =>
    insertAnnotation(ctx, {
      authorId: aliceId,
      sourceId: otherSource,
      selectedText: "lone",
      commentaryText: "take",
    })
  );

  const feed = await t.query(api.annotations.listFeed, {
    paginationOpts: { numItems: 50, cursor: null },
  });
  // Two cards: the thread head + the standalone (follow-on clips collapsed).
  expect(feed.page).toHaveLength(2);
  const head = feed.page.find((c) => c.threadId !== null);
  expect(head?.clipCount).toBe(3);
  expect(head?.selectedText).toBe("a"); // order 0
  const standalone = feed.page.find((c) => c.threadId === null);
  expect(standalone?.clipCount).toBe(1);
});

test("a standalone clip has no thread fields", async () => {
  const t = convexTest(schema, modules);
  const aliceId = await t
    .withIdentity({ subject: "clerk_alice", name: "Alice" })
    .mutation(api.users.ensureCurrentUser, {});
  const sourceId = await seedSource(t);

  const id = await t.run((ctx) =>
    insertAnnotation(ctx, {
      authorId: aliceId,
      sourceId,
      selectedText: "lone",
      commentaryText: "take",
    })
  );
  const row = await t.run((ctx) => ctx.db.get(id));
  expect(row?.threadId).toBeUndefined();
  expect(row?.threadOrder).toBeUndefined();
});

test("threads.create requires auth; getWithClips returns null for a missing thread", async () => {
  const t = convexTest(schema, modules);
  await t
    .withIdentity({ subject: "clerk_alice", name: "Alice" })
    .mutation(api.users.ensureCurrentUser, {});
  const sourceId = await seedSource(t);

  await expect(
    t.mutation(api.threads.create, { sourceId })
  ).rejects.toThrow(/Not authenticated/);

  // A real id for a thread that was never created (use a created-then-valid id
  // shape by creating + reading a different table id is awkward; instead assert
  // the create guard and a null on a bogus lookup via a fresh thread id).
  const realThreadId = await t
    .withIdentity({ subject: "clerk_alice", name: "Alice" })
    .mutation(api.threads.create, { sourceId });
  await t.run((ctx) => ctx.db.delete(realThreadId));
  expect(
    await t.query(api.threads.getWithClips, { threadId: realThreadId })
  ).toBeNull();
});
