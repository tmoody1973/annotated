import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseRssFeed } from "./rss-feed.js";

const realFeed = readFileSync(
  new URL("./__fixtures__/npr-upfirst.xml", import.meta.url),
  "utf-8"
);

describe("parseRssFeed — real NPR feed", () => {
  it("returns one episode object per <item>", () => {
    const { episodes } = parseRssFeed(realFeed);
    expect(episodes).toHaveLength(2);
  });

  it("reads each episode's <guid>", () => {
    const { episodes } = parseRssFeed(realFeed);
    expect(episodes[0].guid).toBe("e75ae580-2c8a-4744-b76d-12a57b290516");
  });

  it("reads each episode's <title>", () => {
    const { episodes } = parseRssFeed(realFeed);
    expect(episodes[0].title).toBe(
      "Trump is rolling back climate solutions. What can cities and states do?"
    );
  });

  it("reads each episode's <pubDate>", () => {
    const { episodes } = parseRssFeed(realFeed);
    expect(episodes[0].pubDate).toBe("Sun, 24 May 2026 07:00:00 +0000");
  });

  it("reads the <enclosure url> verbatim, redirect prefix intact", () => {
    const { episodes } = parseRssFeed(realFeed);
    expect(episodes[0].enclosureUrl).toMatch(
      /^https:\/\/prfx\.byspotify\.com\/e\/play\.podtrac\.com\/npr-510318\//
    );
  });

  it("extracts the channel <title> as podcastName", () => {
    const { podcastName } = parseRssFeed(realFeed);
    expect(podcastName).toBe("Up First from NPR");
  });
});

describe("parseRssFeed — edge cases", () => {
  it("excludes items that have no <enclosure>", () => {
    const xml = `<rss><channel><title>Show</title>
      <item><title>No audio</title><guid>g1</guid></item>
      <item><title>Has audio</title><guid>g2</guid>
        <enclosure url="https://x/a.mp3"/></item>
    </channel></rss>`;
    const { episodes } = parseRssFeed(xml);
    expect(episodes).toHaveLength(1);
    expect(episodes[0].guid).toBe("g2");
  });

  it("returns an empty result for malformed / non-RSS input", () => {
    expect(parseRssFeed("not xml at all <<<")).toEqual({
      podcastName: "",
      episodes: [],
    });
  });
});
