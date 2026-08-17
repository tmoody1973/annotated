import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const IDENTITY = { subject: "user_media", name: "Media Tester", email: "media@example.com" };

/** Inserts a `sources` row and returns its id. */
async function seedSource(
  t: ReturnType<typeof convexTest>,
  overrides: Partial<{ type: "youtube" | "podcast" | "article"; mp3Url: string }> = {}
) {
  return await t.run(async (ctx) =>
    ctx.db.insert("sources", {
      type: overrides.type ?? "podcast",
      canonicalUrl: "https://example.com/episode",
      title: "Episode 1",
      mp3Url: overrides.mp3Url,
    })
  );
}

describe("transcribePodcast guards", () => {
  test("rejects a signed-out caller", async () => {
    const t = convexTest(schema, modules);
    const sourceId = await seedSource(t, { mp3Url: "https://cdn.example.com/e.mp3" });
    await expect(t.action(api.media.transcribePodcast, { sourceId })).rejects.toThrow(
      /Sign in/
    );
  });

  test("rejects a source that no longer exists", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity(IDENTITY);
    const sourceId = await seedSource(t, { mp3Url: "https://cdn.example.com/e.mp3" });
    await t.run(async (ctx) => ctx.db.delete(sourceId));
    await expect(asUser.action(api.media.transcribePodcast, { sourceId })).rejects.toThrow(
      /not found/
    );
  });

  test("rejects a non-podcast source", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity(IDENTITY);
    const sourceId = await seedSource(t, { type: "youtube" });
    await expect(asUser.action(api.media.transcribePodcast, { sourceId })).rejects.toThrow(
      /not a podcast/
    );
  });

  test("rejects a podcast source with no mp3Url", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity(IDENTITY);
    const sourceId = await seedSource(t);
    await expect(asUser.action(api.media.transcribePodcast, { sourceId })).rejects.toThrow(
      /no audio/
    );
  });
});

test("chapters are readable without signing in", async () => {
  const t = convexTest(schema, modules);
  // Clipping does not require an account, and chapters are how you choose what
  // to clip — so this one action must not raise "Sign in to continue". The
  // worker is unreachable in the test, and the enhancement degrades to [].
  await expect(
    t.action(api.media.youtubeChapters, { videoId: "dQw4w9WgXcQ" })
  ).resolves.toEqual([]);
});
