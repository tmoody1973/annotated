import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.*s");

async function seedPublishedAnnotation(
  t: ReturnType<typeof convexTest>,
  authorId: Id<"users">
) {
  await t.run(async (ctx) => {
    const sourceId = await ctx.db.insert("sources", {
      type: "article",
      canonicalUrl: `https://example.com/${crypto.randomUUID()}`,
      title: "Test Article",
    });
    await ctx.db.insert("annotations", {
      authorId,
      sourceId,
      selectedText: "quote",
      takeText: "take",
      isPublic: true,
      publishedAt: Date.now(),
      commentCount: 0,
      likeCount: 0,
    });
  });
}

test("suggestions excludes the viewer, already-followed users, and posters with no annotations", async () => {
  const t = convexTest(schema, modules);
  const viewer = t.withIdentity({ subject: "clerk_viewer", name: "Viewer" });
  const active = t.withIdentity({ subject: "clerk_active", name: "Active" });
  const empty = t.withIdentity({ subject: "clerk_empty", name: "Empty" });
  const followed = t.withIdentity({ subject: "clerk_followed", name: "Followed" });

  const viewerId = await viewer.mutation(api.users.ensureCurrentUser, {});
  const activeId = await active.mutation(api.users.ensureCurrentUser, {});
  await empty.mutation(api.users.ensureCurrentUser, {});
  const followedId = await followed.mutation(api.users.ensureCurrentUser, {});

  await seedPublishedAnnotation(t, activeId);
  await seedPublishedAnnotation(t, followedId);
  await viewer.mutation(api.follows.toggleFollow, { targetUserId: followedId });

  const suggestions = await viewer.query(api.users.suggestions, { limit: 12 });
  const ids = suggestions.map((s) => s._id);

  expect(ids).toContain(activeId);
  expect(ids).not.toContain(viewerId);
  expect(ids).not.toContain(followedId); // already followed
  // "empty" never posted, so it's excluded too.
  const emptyId = (await t.run((ctx) =>
    ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", "clerk_empty"))
      .first()
  ))!._id;
  expect(ids).not.toContain(emptyId);
});

test("suggestions dedupes accounts sharing a username, keeping the most active one", async () => {
  const t = convexTest(schema, modules);
  const viewer = t.withIdentity({ subject: "clerk_viewer2", name: "Viewer" });
  await viewer.mutation(api.users.ensureCurrentUser, {});

  // Two rows sharing a username, as could exist from before usernames were
  // enforced unique on write.
  const [quietId, activeId] = await t.run(async (ctx) => {
    const quiet = await ctx.db.insert("users", {
      clerkId: "clerk_dup_quiet",
      username: "shared-name",
      displayName: "Shared Name",
    });
    const active = await ctx.db.insert("users", {
      clerkId: "clerk_dup_active",
      username: "shared-name",
      displayName: "Shared Name",
    });
    return [quiet, active];
  });
  await seedPublishedAnnotation(t, quietId);
  await seedPublishedAnnotation(t, activeId);
  await seedPublishedAnnotation(t, activeId);

  const suggestions = await viewer.query(api.users.suggestions, { limit: 12 });
  const matches = suggestions.filter((s) => s.username === "shared-name");
  expect(matches).toHaveLength(1);
  expect(matches[0]?._id).toBe(activeId);
});
