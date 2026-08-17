import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { upsertArticleSource, upsertPodcastSource } from "./sources";

const modules = import.meta.glob("./**/*.*s");

test("article re-annotation backfills blank title/siteName/author/image, same row", async () => {
  const t = convexTest(schema, modules);

  const first = await t.run((ctx) =>
    upsertArticleSource(ctx, { canonicalUrl: "https://example.com/post", title: "" })
  );
  const second = await t.run((ctx) =>
    upsertArticleSource(ctx, {
      canonicalUrl: "https://example.com/post",
      title: "Real Headline",
      siteName: "Example News",
      author: "Jane Reporter",
      imageUrl: "https://example.com/img.jpg",
    })
  );

  expect(second).toBe(first);
  const row = await t.run((ctx) => ctx.db.get(first));
  expect(row?.title).toBe("Real Headline");
  expect(row?.siteName).toBe("Example News");
  expect(row?.author).toBe("Jane Reporter");
  expect(row?.imageUrl).toBe("https://example.com/img.jpg");
});

test("article backfill never overwrites good metadata", async () => {
  const t = convexTest(schema, modules);

  const first = await t.run((ctx) =>
    upsertArticleSource(ctx, {
      canonicalUrl: "https://example.com/good",
      title: "Real Headline",
      siteName: "Real Site",
      author: "Real Author",
    })
  );
  await t.run((ctx) =>
    upsertArticleSource(ctx, {
      canonicalUrl: "https://example.com/good",
      title: "Different",
      siteName: "Different Site",
      author: "Different Author",
    })
  );

  const row = await t.run((ctx) => ctx.db.get(first));
  expect(row?.title).toBe("Real Headline");
  expect(row?.siteName).toBe("Real Site");
  expect(row?.author).toBe("Real Author");
});

test("podcast re-resolve backfills blank title/podcastName/mp3Url (dedup by guid)", async () => {
  const t = convexTest(schema, modules);

  const first = await t.run((ctx) =>
    upsertPodcastSource(ctx, {
      canonicalUrl: "https://pod.example/ep1",
      title: "",
      podcastName: "",
      episodeGuid: "guid-1",
      mp3Url: "",
    })
  );
  const second = await t.run((ctx) =>
    upsertPodcastSource(ctx, {
      canonicalUrl: "https://pod.example/ep1",
      title: "Episode One",
      podcastName: "My Show",
      episodeGuid: "guid-1",
      mp3Url: "https://cdn.example/ep1.mp3",
    })
  );

  expect(second).toBe(first);
  const row = await t.run((ctx) => ctx.db.get(first));
  expect(row?.title).toBe("Episode One");
  expect(row?.podcastName).toBe("My Show");
  expect(row?.mp3Url).toBe("https://cdn.example/ep1.mp3");
});

test("podcast backfill never overwrites a good mp3Url", async () => {
  const t = convexTest(schema, modules);

  const first = await t.run((ctx) =>
    upsertPodcastSource(ctx, {
      canonicalUrl: "https://pod.example/ep2",
      title: "Real",
      podcastName: "Show",
      episodeGuid: "guid-2",
      mp3Url: "https://cdn.example/real.mp3",
    })
  );
  await t.run((ctx) =>
    upsertPodcastSource(ctx, {
      canonicalUrl: "https://pod.example/ep2",
      title: "Other",
      podcastName: "Other Show",
      episodeGuid: "guid-2",
      mp3Url: "https://cdn.example/other.mp3",
    })
  );

  const row = await t.run((ctx) => ctx.db.get(first));
  expect(row?.mp3Url).toBe("https://cdn.example/real.mp3");
  expect(row?.podcastName).toBe("Show");
});

test("a podcast title stored with HTML entities is repaired on the next resolve", async () => {
  const t = convexTest(schema, modules);
  const sourceId = await t.run((ctx) =>
    ctx.db.insert("sources", {
      type: "podcast",
      canonicalUrl: "https://example.com/show",
      title: "How Crowley won Wisconsin&#8217;s Democratic primary",
      podcastName: "Inside Wisconsin Politics",
      podcastEpisodeGuid: "guid-1",
      mp3Url: "https://example.com/a.mp3",
    })
  );

  await t.run((ctx) =>
    upsertPodcastSource(ctx, {
      canonicalUrl: "https://example.com/show",
      title: "How Crowley won Wisconsin’s Democratic primary",
      podcastName: "Inside Wisconsin Politics",
      episodeGuid: "guid-1",
      mp3Url: "https://example.com/a.mp3",
    })
  );

  expect((await t.run((ctx) => ctx.db.get(sourceId)))?.title).toBe(
    "How Crowley won Wisconsin’s Democratic primary"
  );

  // A real later title still does not overwrite a good one — first writer wins.
  await t.run((ctx) =>
    upsertPodcastSource(ctx, {
      canonicalUrl: "https://example.com/show",
      title: "Some other title",
      podcastName: "Inside Wisconsin Politics",
      episodeGuid: "guid-1",
      mp3Url: "https://example.com/a.mp3",
    })
  );
  expect((await t.run((ctx) => ctx.db.get(sourceId)))?.title).toBe(
    "How Crowley won Wisconsin’s Democratic primary"
  );
});
