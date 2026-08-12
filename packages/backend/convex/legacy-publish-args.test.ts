import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

/**
 * A sideloaded Chrome extension never auto-updates. Any build installed before
 * the commentary→take rename keeps sending the old field names forever, and
 * Convex arg validators reject unknown fields outright — so dropping them broke
 * publishing in production with "Object contains extra field `commentaryText`".
 *
 * These tests pin the compatibility shim. Deleting `legacyTakeArgs` or
 * `resolveTake` must fail here, not in someone's browser.
 */

async function setup() {
  const t = convexTest(schema, modules);
  const asUser = t.withIdentity({
    subject: "user_legacy",
    name: "Legacy Client",
    email: "legacy@example.com",
  });
  await asUser.mutation(api.users.ensureCurrentUser, {});
  const topicId = await t.run(async (ctx) =>
    ctx.db.insert("topics", { slug: "news", name: "News & Politics" })
  );
  return { t, asUser, topicId };
}

describe("pre-rename publish arguments", () => {
  test("a YouTube publish sending commentaryText still succeeds", async () => {
    const { t, asUser, topicId } = await setup();

    const annotationId = await asUser.mutation(api.annotations.createYoutube, {
      videoId: "Ys4O3mCeK3s",
      title: "MAJOR UPSET: David Crowley WINS Democratic nomination",
      author: "MS NOW",
      clipStartMs: 58_000,
      clipEndMs: 82_000,
      commentaryText: "David Crowley wins. Interesting",
      topicIds: [topicId],
    });

    const row = await t.run(async (ctx) => ctx.db.get(annotationId));
    // Stored under the NEW name — the shim maps forward, it doesn't write legacy.
    expect(row?.takeText).toBe("David Crowley wins. Interesting");
    expect(row?.commentaryText).toBeUndefined();
  });

  test("the legacy take satisfies the take-required guard", async () => {
    const { asUser, topicId } = await setup();
    // Without resolveTake feeding assertPublishable, this throws
    // "A take is required" even though a take was supplied.
    await expect(
      asUser.mutation(api.annotations.createYoutube, {
        videoId: "abc123",
        title: "Guard check",
        clipStartMs: 0,
        clipEndMs: 30_000,
        commentaryText: "a real take, under the old name",
        topicIds: [topicId],
      })
    ).resolves.toBeDefined();
  });

  test("a publish with neither name is still rejected", async () => {
    const { asUser, topicId } = await setup();
    await expect(
      asUser.mutation(api.annotations.createYoutube, {
        videoId: "abc123",
        title: "No take at all",
        clipStartMs: 0,
        clipEndMs: 30_000,
        topicIds: [topicId],
      })
    ).rejects.toThrow(/take is required/);
  });

  test("the new name wins when a client sends both", async () => {
    const { t, asUser, topicId } = await setup();
    const annotationId = await asUser.mutation(api.annotations.createYoutube, {
      videoId: "abc123",
      title: "Both names",
      clipStartMs: 0,
      clipEndMs: 30_000,
      takeText: "new",
      commentaryText: "old",
      topicIds: [topicId],
    });
    const row = await t.run(async (ctx) => ctx.db.get(annotationId));
    expect(row?.takeText).toBe("new");
  });

  test("an article publish sending commentaryText still succeeds", async () => {
    const { t, asUser, topicId } = await setup();
    const annotationId = await asUser.mutation(api.annotations.createArticle, {
      canonicalUrl: "https://example.com/a-story",
      title: "A story",
      selectedText: "The claim being annotated.",
      textStart: 0,
      textEnd: 26,
      commentaryText: "why it matters",
      topicIds: [topicId],
    });
    const row = await t.run(async (ctx) => ctx.db.get(annotationId));
    expect(row?.takeText).toBe("why it matters");
  });
});
