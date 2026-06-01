import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

test("re-clipping backfills missing author + placeholder title, same source row", async () => {
  const t = convexTest(schema, modules);

  // First clip read the page too early: placeholder title, no channel name,
  // only the rendered @handle URL — exactly the stale row this fixes.
  const first = await t.mutation(api.sources.upsertYoutube, {
    videoId: "5nvsDmwZWdM",
    title: "YouTube",
    channelUrl: "https://www.youtube.com/@ABCNewsIndepth",
  });

  // A later clip captured real metadata from videoDetails.
  const second = await t.mutation(api.sources.upsertYoutube, {
    videoId: "5nvsDmwZWdM",
    title: "Why global bond yields are surging",
    author: "ABC News In-depth",
    channelUrl: "https://www.youtube.com/channel/UCabc",
  });

  expect(second).toBe(first); // dedup preserved — still one row per video

  const row = await t.run((ctx) => ctx.db.get(first));
  expect(row?.author).toBe("ABC News In-depth"); // backfilled (was missing)
  expect(row?.title).toBe("Why global bond yields are surging"); // placeholder replaced
  // A scraped @handle is upgraded to the authoritative channel/<id> from
  // videoDetails (the old @handle could even be the wrong channel).
  expect(row?.youtubeChannelUrl).toBe("https://www.youtube.com/channel/UCabc");
});

test("does not downgrade a canonical /channel URL to an incoming @handle", async () => {
  const t = convexTest(schema, modules);
  const first = await t.mutation(api.sources.upsertYoutube, {
    videoId: "canon",
    title: "T",
    author: "C",
    channelUrl: "https://www.youtube.com/channel/UCkeep",
  });
  await t.mutation(api.sources.upsertYoutube, {
    videoId: "canon",
    title: "T",
    author: "C",
    channelUrl: "https://www.youtube.com/@somehandle",
  });
  const row = await t.run((ctx) => ctx.db.get(first));
  expect(row?.youtubeChannelUrl).toBe("https://www.youtube.com/channel/UCkeep");
});

test("never overwrites good existing metadata (first real writer wins)", async () => {
  const t = convexTest(schema, modules);

  const first = await t.mutation(api.sources.upsertYoutube, {
    videoId: "goodvid",
    title: "Real Title",
    author: "Real Channel",
    channelUrl: "https://www.youtube.com/channel/UCgood",
  });
  const second = await t.mutation(api.sources.upsertYoutube, {
    videoId: "goodvid",
    title: "Different Title",
    author: "Different Channel",
    channelUrl: "https://www.youtube.com/channel/UCother",
  });

  expect(second).toBe(first);
  const row = await t.run((ctx) => ctx.db.get(first));
  expect(row?.author).toBe("Real Channel");
  expect(row?.title).toBe("Real Title");
  expect(row?.youtubeChannelUrl).toBe("https://www.youtube.com/channel/UCgood");
});

test("backfills a blank thumbnail and duration on re-clip", async () => {
  const t = convexTest(schema, modules);

  const first = await t.mutation(api.sources.upsertYoutube, {
    videoId: "thumbvid",
    title: "Title",
    author: "Channel",
  });
  await t.mutation(api.sources.upsertYoutube, {
    videoId: "thumbvid",
    title: "Title",
    author: "Channel",
    thumbnailUrl: "https://i.ytimg.com/vi/thumbvid/hqdefault.jpg",
    durationMs: 600_000,
  });

  const row = await t.run((ctx) => ctx.db.get(first));
  expect(row?.youtubeThumbnailUrl).toBe("https://i.ytimg.com/vi/thumbvid/hqdefault.jpg");
  expect(row?.youtubeDurationMs).toBe(600_000);
});
