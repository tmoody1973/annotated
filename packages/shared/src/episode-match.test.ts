import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseRssFeed } from "./rss-feed.js";
import { matchEpisode } from "./episode-match.js";

const { episodes } = parseRssFeed(
  readFileSync(new URL("./__fixtures__/npr-upfirst.xml", import.meta.url), "utf-8")
);

describe("matchEpisode", () => {
  it("matches by exact GUID when a guid is given", () => {
    const hit = matchEpisode(episodes, {
      guid: "a4be0e3a-d7f3-43f9-b37f-1081fa159285",
    });
    expect(hit?.title).toBe("Cuba Pressure, Abrego Garcia Charges, Cooling Costs");
  });

  it("falls back to title match when no guid is given", () => {
    const hit = matchEpisode(episodes, {
      title: "Cuba Pressure, Abrego Garcia Charges, Cooling Costs",
    });
    expect(hit?.guid).toBe("a4be0e3a-d7f3-43f9-b37f-1081fa159285");
  });

  it("normalizes whitespace and case when matching by title", () => {
    const hit = matchEpisode(episodes, {
      title: "  cuba PRESSURE,  abrego garcia charges, cooling costs  ",
    });
    expect(hit?.guid).toBe("a4be0e3a-d7f3-43f9-b37f-1081fa159285");
  });

  it("returns null when the guid matches nothing", () => {
    expect(matchEpisode(episodes, { guid: "does-not-exist" })).toBeNull();
  });

  it("returns null when the title matches nothing", () => {
    expect(matchEpisode(episodes, { title: "no such episode" })).toBeNull();
  });

  it("disambiguates same-titled episodes by pubDate", () => {
    const dupes = [
      { guid: "x", title: "Daily", pubDate: "Mon, 01 Jan 2026 00:00:00 +0000", enclosureUrl: "a" },
      { guid: "y", title: "Daily", pubDate: "Tue, 02 Jan 2026 00:00:00 +0000", enclosureUrl: "b" },
    ];
    const hit = matchEpisode(dupes, {
      title: "Daily",
      pubDate: "Tue, 02 Jan 2026 00:00:00 +0000",
    });
    expect(hit?.guid).toBe("y");
  });

  it("returns null (does not guess) when same-titled episodes can't be disambiguated", () => {
    const dupes = [
      { guid: "x", title: "Daily", pubDate: "Mon, 01 Jan 2026 00:00:00 +0000", enclosureUrl: "a" },
      { guid: "y", title: "Daily", pubDate: "Tue, 02 Jan 2026 00:00:00 +0000", enclosureUrl: "b" },
    ];
    expect(matchEpisode(dupes, { title: "Daily" })).toBeNull();
  });
});
