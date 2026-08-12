import { describe, expect, it } from "vitest";
import { DEAD_ENDS, primaryAction, sourceHeading } from "./source-states";
import type { DetectedSource } from "./use-detected-source";

const youtube: DetectedSource = { kind: "youtube", videoId: "abc", url: "https://yt/abc" };
const article: DetectedSource = {
  kind: "article",
  article: { url: "https://x/1", title: "A story", html: "<p/>" },
};
const podcast: DetectedSource = {
  kind: "podcast",
  podcast: { kind: "generic", canonicalUrl: "https://x/1", rssUrl: "r", pageTitle: "Ep 1" },
};

describe("primaryAction", () => {
  it("offers the last 60 seconds up to the playhead", () => {
    expect(primaryAction(youtube, 300_000)).toEqual({
      label: "Clip last 60s",
      spanMs: { startMs: 240_000, endMs: 300_000 },
    });
  });

  it("never seeds a negative start early in a video", () => {
    const action = primaryAction(youtube, 20_000);
    expect(action.spanMs?.startMs).toBe(0);
    expect(action.spanMs?.endMs).toBe(20_000);
  });

  it("falls back to the opening minute when the playhead cannot be read", () => {
    expect(primaryAction(youtube, null)).toEqual({
      label: "Clip from the start",
      spanMs: { startMs: 0, endMs: 60_000 },
    });
  });

  it("still offers an action when the playhead reads zero", () => {
    expect(primaryAction(youtube, 0).label).toBe("Clip from the start");
  });

  it("always produces a label — the primary action is never disabled", () => {
    for (const detected of [youtube, article, podcast]) {
      for (const playhead of [null, 0, 90_000]) {
        expect(primaryAction(detected, playhead).label).not.toBe("");
      }
    }
  });

  it("sends the podcast and article paths in with no span — they select later", () => {
    expect(primaryAction(podcast, null).spanMs).toBeNull();
    expect(primaryAction(article, null).spanMs).toBeNull();
  });

  it("names the act, not the mechanism, on each path", () => {
    expect(primaryAction(article, null).label).toBe("Highlight on the page");
    expect(primaryAction(podcast, null).label).toBe("Clip from the transcript");
  });
});

describe("dead-end copy", () => {
  it("explains Spotify by naming the cause, not the failure", () => {
    expect(DEAD_ENDS.spotify.body).toBe(
      "Spotify-exclusive shows don't publish an audio feed, so there's no file to clip from.",
    );
  });

  it("describes the user's world while detecting, never ours", () => {
    expect(DEAD_ENDS.detecting.body).toBe("Works on YouTube, podcast pages and articles.");
    for (const state of Object.values(DEAD_ENDS)) {
      expect(state.body).not.toMatch(/convex|storage id|sourceId/i);
    }
  });

  it("gives every dead end a way out", () => {
    expect(DEAD_ENDS.unsupported.link?.label).toBe("See what others clipped ⟶");
    expect(DEAD_ENDS.spotify.link?.label).toBe("Find it on Apple Podcasts ⟶");
  });

  it("keeps first run to one screen with the fair-use promise on it", () => {
    expect(DEAD_ENDS.firstRun.body).toContain("90 seconds");
    expect(DEAD_ENDS.firstRun.bullets).toContain("Fair use, always linked back");
  });
});

describe("sourceHeading", () => {
  it("never says Checking Convex — the panel describes the user's world", () => {
    const all = [
      sourceHeading({ kind: "detecting" }, "loading"),
      sourceHeading({ kind: "unsupported" }, "signed-in"),
      sourceHeading({ kind: "unsupported" }, "signed-out"),
      sourceHeading(youtube, "signed-in"),
    ];
    for (const heading of all) expect(heading).not.toMatch(/convex/i);
  });

  it("welcomes a signed-out newcomer instead of reporting a dead end", () => {
    expect(sourceHeading({ kind: "unsupported" }, "signed-out")).toBe(
      "Clip it. Say why. Share the link.",
    );
    expect(sourceHeading({ kind: "unsupported" }, "signed-in")).toBe(
      "Nothing to clip on this page",
    );
  });

  it("names the cause for a Spotify episode", () => {
    const spotify = {
      kind: "podcast",
      podcast: { kind: "spotify", canonicalUrl: "https://open.spotify.com/episode/x" },
    } as const;
    expect(sourceHeading(spotify, "signed-in")).toBe("This episode can't be clipped");
  });

  it("agrees with the body: a clippable source is never a dead end", () => {
    for (const detected of [youtube, article, podcast]) {
      expect(sourceHeading(detected, "signed-out")).toBe("Choose the evidence");
    }
  });
});
