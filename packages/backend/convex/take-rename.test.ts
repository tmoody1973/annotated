import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("a row written with the legacy commentaryText still projects as takeText", async () => {
  const t = convexTest(schema, modules);
  const asUser = t.withIdentity({ subject: "user_rename", name: "R", email: "r@example.com" });
  await asUser.mutation(api.users.ensureCurrentUser, {});

  const { annotationId } = await t.run(async (ctx) => {
    const authorId = await ctx.db.insert("users", {
      clerkId: "legacy", username: "legacy", displayName: "Legacy",
    });
    const sourceId = await ctx.db.insert("sources", {
      type: "youtube", canonicalUrl: "https://youtu.be/x", title: "Legacy",
    });
    const annotationId = await ctx.db.insert("annotations", {
      authorId, sourceId,
      commentaryText: "written before the rename",
      isPublic: true, publishedAt: Date.now(), commentCount: 0, likeCount: 0,
    });
    return { annotationId };
  });

  const projected = await t.query(api.annotations.getById, { annotationId });
  expect(projected?.takeText).toBe("written before the rename");
  // The still-deployed old web app reads the pre-rename key — it must keep working.
  expect(projected?.commentaryText).toBe("written before the rename");
});

test("a newly published annotation stores takeText", async () => {
  const t = convexTest(schema, modules);
  const asUser = t.withIdentity({ subject: "user_new", name: "N", email: "n@example.com" });
  await asUser.mutation(api.users.ensureCurrentUser, {});
  const topicId = await t.run(async (ctx) =>
    ctx.db.insert("topics", { slug: "ai", name: "AI" })
  );

  const annotationId = await asUser.mutation(api.annotations.createYoutube, {
    videoId: "abc123", title: "New", clipStartMs: 0, clipEndMs: 30_000,
    takeText: "written after the rename", topicIds: [topicId],
  });

  const row = await t.run(async (ctx) => ctx.db.get(annotationId));
  expect(row?.takeText).toBe("written after the rename");
  expect(row?.commentaryText).toBeUndefined();

  // The stored row has no commentaryText (write side is fully cut over), but the
  // projection still fills in the legacy key for the still-deployed old web app.
  const projected = await t.query(api.annotations.getById, { annotationId });
  expect(projected?.commentaryText).toBe("written after the rename");
});
