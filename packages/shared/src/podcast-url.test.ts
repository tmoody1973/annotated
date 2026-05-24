import { describe, expect, it } from "vitest";
import { parsePodcastUrl } from "./podcast-url.js";

describe("parsePodcastUrl — Apple Podcasts", () => {
  it("extracts podcast id and episode id from an episode URL", () => {
    expect(
      parsePodcastUrl(
        "https://podcasts.apple.com/us/podcast/the-show/id1535809341?i=1000654321098"
      )
    ).toEqual({
      platform: "apple",
      podcastId: "1535809341",
      episodeId: "1000654321098",
    });
  });

  it("returns a null episodeId for a show (non-episode) page", () => {
    expect(
      parsePodcastUrl("https://podcasts.apple.com/us/podcast/the-show/id1535809341")
    ).toEqual({ platform: "apple", podcastId: "1535809341", episodeId: null });
  });
});

describe("parsePodcastUrl — Spotify", () => {
  it("extracts the episode id from a Spotify episode URL", () => {
    expect(
      parsePodcastUrl("https://open.spotify.com/episode/512ojhOuo1ktJprKbVcKyQ")
    ).toEqual({ platform: "spotify", episodeId: "512ojhOuo1ktJprKbVcKyQ" });
  });

  it("ignores query params on a Spotify episode URL", () => {
    expect(
      parsePodcastUrl(
        "https://open.spotify.com/episode/512ojhOuo1ktJprKbVcKyQ?si=abc123"
      )
    ).toEqual({ platform: "spotify", episodeId: "512ojhOuo1ktJprKbVcKyQ" });
  });

  it("returns null for a Spotify show page (only episodes are clippable)", () => {
    expect(
      parsePodcastUrl("https://open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk")
    ).toBeNull();
  });
});

describe("parsePodcastUrl — non-podcast", () => {
  it("returns null for an unrelated URL", () => {
    expect(parsePodcastUrl("https://example.com/article")).toBeNull();
  });

  it("returns null for a YouTube URL", () => {
    expect(parsePodcastUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
  });
});
