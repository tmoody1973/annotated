import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.*s");

/** Two topics, so a match is a choice rather than the only option. */
async function seedTopics(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => ({
    tech: await ctx.db.insert("topics", { slug: "tech", name: "Tech", sortOrder: 0 }),
    climate: await ctx.db.insert("topics", { slug: "climate", name: "Climate", sortOrder: 1 }),
  }));
}

async function seedSource(t: ReturnType<typeof convexTest>, title: string) {
  return await t.run(async (ctx) =>
    ctx.db.insert("sources", {
      type: "article",
      canonicalUrl: `https://example.com/${encodeURIComponent(title)}`,
      title,
    }),
  );
}

/** A published annotation on `sourceId`, tagged with `topicId`. */
async function seedTagged(
  t: ReturnType<typeof convexTest>,
  authorId: Id<"users">,
  sourceId: Id<"sources">,
  topicId: Id<"topics">,
  publishedAt: number,
) {
  await t.run(async (ctx) => {
    const annotationId = await ctx.db.insert("annotations", {
      authorId,
      sourceId,
      takeText: "a take",
      isPublic: true,
      publishedAt,
      commentCount: 0,
      likeCount: 0,
    });
    await ctx.db.insert("annotationTopics", { annotationId, topicId, publishedAt });
  });
}

describe("topicsSuggest.forSource", () => {
  test("returns the topic this source was last tagged with", async () => {
    const t = convexTest(schema, modules);
    const user = t.withIdentity({ subject: "clerk_a", name: "A" });
    const userId = await user.mutation(api.users.ensureCurrentUser, {});
    const topics = await seedTopics(t);
    const sourceId = await seedSource(t, "An untitled piece");

    await seedTagged(t, userId, sourceId, topics.climate, 1_000);
    await seedTagged(t, userId, sourceId, topics.tech, 2_000);

    expect(await user.query(api.topicsSuggest.forSource, { sourceId, title: "" })).toEqual([
      topics.tech,
    ]);
  });

  test("falls back to a keyword match on the title when the source is new", async () => {
    const t = convexTest(schema, modules);
    const user = t.withIdentity({ subject: "clerk_b", name: "B" });
    await user.mutation(api.users.ensureCurrentUser, {});
    const topics = await seedTopics(t);

    expect(
      await user.query(api.topicsSuggest.forSource, {
        title: "What the climate models keep getting wrong",
      }),
    ).toEqual([topics.climate]);
  });

  test("falls back to the caller's most-used topic when nothing else matches", async () => {
    const t = convexTest(schema, modules);
    const user = t.withIdentity({ subject: "clerk_c", name: "C" });
    const userId = await user.mutation(api.users.ensureCurrentUser, {});
    const topics = await seedTopics(t);

    const older = await seedSource(t, "Older piece");
    const other = await seedSource(t, "Other piece");
    await seedTagged(t, userId, older, topics.tech, 1_000);
    await seedTagged(t, userId, other, topics.tech, 2_000);
    await seedTagged(t, userId, other, topics.climate, 3_000);

    const fresh = await seedSource(t, "Something with no matching words at all");
    expect(
      await user.query(api.topicsSuggest.forSource, {
        sourceId: fresh,
        title: "Something with no matching words at all",
      }),
    ).toEqual([topics.tech]);
  });

  test("returns nothing rather than guessing when there is no signal", async () => {
    const t = convexTest(schema, modules);
    const user = t.withIdentity({ subject: "clerk_d", name: "D" });
    await user.mutation(api.users.ensureCurrentUser, {});
    await seedTopics(t);

    expect(
      await user.query(api.topicsSuggest.forSource, { title: "Zzz qqq unmatched" }),
    ).toEqual([]);
  });

  test("returns [] unauthenticated instead of throwing — pre-fill may never break publish", async () => {
    const t = convexTest(schema, modules);
    await seedTopics(t);

    expect(await t.query(api.topicsSuggest.forSource, { title: "climate" })).toEqual([]);
  });

  test("suggests at most one topic", async () => {
    const t = convexTest(schema, modules);
    const user = t.withIdentity({ subject: "clerk_e", name: "E" });
    await user.mutation(api.users.ensureCurrentUser, {});
    await seedTopics(t);

    const suggested = await user.query(api.topicsSuggest.forSource, {
      title: "Tech and climate, together at last",
    });
    expect(suggested.length).toBeLessThanOrEqual(1);
  });

  test("does not match a topic on a fragment of a longer word", async () => {
    const t = convexTest(schema, modules);
    const user = t.withIdentity({ subject: "clerk_f", name: "F" });
    await user.mutation(api.users.ensureCurrentUser, {});
    await seedTopics(t);

    // "technicality" contains "tech" but is not about it.
    expect(
      await user.query(api.topicsSuggest.forSource, { title: "A legal technicality" }),
    ).toEqual([]);
  });

  test("tolerates a source that has never been annotated", async () => {
    const t = convexTest(schema, modules);
    const user = t.withIdentity({ subject: "clerk_g", name: "G" });
    await user.mutation(api.users.ensureCurrentUser, {});
    await seedTopics(t);
    const sourceId = await seedSource(t, "Never annotated");

    expect(
      await user.query(api.topicsSuggest.forSource, { sourceId, title: "Never annotated" }),
    ).toEqual([]);
  });
});
