import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.*s");

type TestCtx = ReturnType<typeof convexTest>;

async function seedSource(t: TestCtx, url: string, title: string) {
  return await t.run((ctx) =>
    ctx.db.insert("sources", { type: "article", canonicalUrl: url, title })
  );
}

const draftFields = {
  campaign: "2026",
  jurisdiction: "Racine County",
  body: "Mount Pleasant Village Board",
  question: "Should the village approve site plans for 15 more data centres?",
  status: "decided" as const,
  retrievedAt: 1_770_000_000_000,
  selectionNote:
    "On the record because the same company's proposal twelve miles away was withdrawn. Limitation: the contract retains a provision regulators struck down.",
};

test("the publish gate: a drafted entry is invisible until a person publishes it", async () => {
  const t = convexTest(schema, modules);
  const sourceId = await seedSource(t, "https://example.com/mp-board", "Board packet");

  const entryId = await t.mutation(internal.recordEntries.draft, {
    ...draftFields,
    sourceId,
    curatedBy: "agent",
  });

  // Drafted by a machine → not on the public feed, at all.
  expect(await t.query(api.recordEntries.listPublished, { campaign: "2026" })).toEqual([]);
  // ...but visible to the operator's review queue.
  const drafts = await t.query(internal.recordEntries.listDrafts, { campaign: "2026" });
  expect(drafts.map((d) => d._id)).toEqual([entryId]);

  // A person publishes it. Only then does it reach the feed.
  await t.mutation(internal.recordEntries.publish, { entryId });
  const published = await t.query(api.recordEntries.listPublished, { campaign: "2026" });
  expect(published).toHaveLength(1);
  expect(published[0].body).toBe("Mount Pleasant Village Board");
  expect(published[0].source.title).toBe("Board packet");
  expect(await t.query(internal.recordEntries.listDrafts, { campaign: "2026" })).toEqual([]);

  // Unpublishing puts it back behind the gate rather than deleting it.
  await t.mutation(internal.recordEntries.unpublish, { entryId });
  expect(await t.query(api.recordEntries.listPublished, { campaign: "2026" })).toEqual([]);
});

test("a published entry reports its takes, and zero takes is a state not an absence", async () => {
  const t = convexTest(schema, modules);
  const withTake = await seedSource(t, "https://example.com/a", "Canvass report");
  const withoutTake = await seedSource(t, "https://example.com/b", "Withdrawal letter");

  const authorId = await t.run((ctx) =>
    ctx.db.insert("users", {
      clerkId: "clerk_1",
      username: "curious",
      displayName: "Curious Person",
    })
  );

  for (const sourceId of [withTake, withoutTake]) {
    const entryId = await t.mutation(internal.recordEntries.draft, {
      ...draftFields,
      sourceId,
      curatedBy: "editor",
    });
    await t.mutation(internal.recordEntries.publish, { entryId });
  }

  // Two annotations on the first source: one live, one removed.
  await t.run(async (ctx) => {
    await ctx.db.insert("annotations", {
      authorId,
      sourceId: withTake,
      takeText: "The canvass moved 400 votes and nobody covered it.",
      isPublic: true,
      publishedAt: Date.now(),
      commentCount: 0,
      likeCount: 0,
    });
    await ctx.db.insert("annotations", {
      authorId,
      sourceId: withTake,
      takeText: "Removed take.",
      isPublic: true,
      publishedAt: Date.now(),
      removedAt: Date.now(),
      commentCount: 0,
      likeCount: 0,
    });
    // A private draft on the second source must not count as a take either.
    await ctx.db.insert("annotations", {
      authorId,
      sourceId: withoutTake,
      takeText: "Unpublished.",
      isPublic: false,
      commentCount: 0,
      likeCount: 0,
    });
  });

  const rows = await t.query(api.recordEntries.listPublished, { campaign: "2026" });
  const annotated = rows.find((r) => r.source.title === "Canvass report")!;
  const bare = rows.find((r) => r.source.title === "Withdrawal letter")!;

  // The removed take is not counted and not projected.
  expect(annotated.takeCount).toBe(1);
  expect(annotated.takes).toHaveLength(1);
  expect(annotated.takes[0].takeText).toBe(
    "The canvass moved 400 votes and nobody covered it."
  );
  expect(annotated.takes[0].authorUsername).toBe("curious");

  // Zero takes is a first-class state — the page renders "Needs a take" from it.
  expect(bare.takeCount).toBe(0);
  expect(bare.takes).toEqual([]);
});

test("drafting rejects empty required text and an unknown source", async () => {
  const t = convexTest(schema, modules);
  const sourceId = await seedSource(t, "https://example.com/c", "Doc");

  await expect(
    t.mutation(internal.recordEntries.draft, {
      ...draftFields,
      sourceId,
      curatedBy: "editor",
      selectionNote: "   ",
    })
  ).rejects.toThrow();

  await expect(
    t.mutation(internal.recordEntries.draft, {
      ...draftFields,
      sourceId,
      curatedBy: "editor",
      body: "",
    })
  ).rejects.toThrow();

  const dangling = await t.run(async (ctx) => {
    const id = await ctx.db.insert("sources", {
      type: "article",
      canonicalUrl: "https://example.com/gone",
      title: "Gone",
    });
    await ctx.db.delete(id);
    return id as Id<"sources">;
  });
  await expect(
    t.mutation(internal.recordEntries.draft, {
      ...draftFields,
      sourceId: dangling,
      curatedBy: "agent",
    })
  ).rejects.toThrow();
});
