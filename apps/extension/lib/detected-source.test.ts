import { describe, expect, it } from "vitest";
import type { GetArticlePageResponse, GetPodcastPageResponse } from "./messages";
import { detectionKey, resolveDetection } from "./use-detected-source";

const ARTICLE_PAGE: GetArticlePageResponse = {
  url: "https://www.npr.org/2026/01/01/a-story",
  title: "A story",
  html: "<article>body</article>",
};

/** The content script always answers every field; only the values vary. */
function feed(fields: Partial<GetPodcastPageResponse>): GetPodcastPageResponse {
  return { rssUrl: null, pageTitle: null, enclosureUrl: null, showName: null, ...fields };
}

describe("resolveDetection", () => {
  it("reads a YouTube watch URL without asking the page anything", () => {
    const result = resolveDetection("https://www.youtube.com/watch?v=dQw4w9WgXcQ", null, null);
    expect(result).toEqual({
      kind: "youtube",
      videoId: "dQw4w9WgXcQ",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
  });

  it("treats an Apple Podcasts URL as a podcast", () => {
    const result = resolveDetection(
      "https://podcasts.apple.com/us/podcast/this-american-life/id201671138?i=1000600000000",
      null,
      null,
    );
    expect(result.kind).toBe("podcast");
    if (result.kind === "podcast") expect(result.podcast.kind).toBe("apple");
  });

  it("keeps Spotify as a podcast so the panel can explain why it cannot be clipped", () => {
    const result = resolveDetection("https://open.spotify.com/episode/abc123", null, null);
    expect(result.kind).toBe("podcast");
    if (result.kind === "podcast") expect(result.podcast.kind).toBe("spotify");
  });

  it("prefers an in-page enclosure over the article body — NPR tags episodes as articles", () => {
    const result = resolveDetection(
      "https://www.npr.org/2026/01/01/up-first",
      feed({ enclosureUrl: "https://cdn/ep.mp3" }),
      ARTICLE_PAGE,
    );
    expect(result.kind).toBe("podcast");
    if (result.kind === "podcast") expect(result.podcast.kind).toBe("enclosure");
  });

  it("prefers the article body over a site-wide RSS link — this is the flicker", () => {
    const result = resolveDetection(
      ARTICLE_PAGE.url,
      feed({ rssUrl: "https://www.npr.org/rss.xml" }),
      ARTICLE_PAGE,
    );
    expect(result.kind).toBe("article");
  });

  it("treats an RSS link with no article body as a podcast show page", () => {
    const result = resolveDetection(
      "https://snapjudgment.org/",
      feed({ rssUrl: "https://feeds/snap.xml", pageTitle: "Snap" }),
      null,
    );
    expect(result.kind).toBe("podcast");
    if (result.kind === "podcast") expect(result.podcast.kind).toBe("generic");
  });

  it("reports a plain page as unsupported, not as nothing-yet", () => {
    expect(resolveDetection("https://example.com/", null, null)).toEqual({ kind: "unsupported" });
  });

  it("reports a tab with no readable URL as unsupported", () => {
    expect(resolveDetection(null, null, null)).toEqual({ kind: "unsupported" });
  });

  it("ignores an article response that carries no html", () => {
    const result = resolveDetection(
      "https://example.com/thin",
      null,
      { url: "https://example.com/thin", title: "Thin", html: null },
    );
    expect(result.kind).toBe("unsupported");
  });
});

describe("detectionKey", () => {
  it("changes when the video changes", () => {
    const a = detectionKey({ kind: "youtube", videoId: "aaa", url: "u" });
    const b = detectionKey({ kind: "youtube", videoId: "bbb", url: "u" });
    expect(a).not.toBe(b);
  });

  it("is null while detecting, so a reset is never fired mid-detection", () => {
    expect(detectionKey({ kind: "detecting" })).toBeNull();
  });

  it("distinguishes an article from a podcast at the same URL", () => {
    const article = detectionKey({
      kind: "article",
      article: { url: "https://x/1", title: "t", html: "<p/>" },
    });
    const podcast = detectionKey({
      kind: "podcast",
      podcast: { kind: "generic", canonicalUrl: "https://x/1", rssUrl: "r", pageTitle: "t" },
    });
    expect(article).not.toBe(podcast);
  });
});
