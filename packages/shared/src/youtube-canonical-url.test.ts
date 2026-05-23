import { describe, expect, it } from "vitest";
import { youtubeCanonicalUrl } from "./youtube-canonical-url.js";

describe("youtubeCanonicalUrl", () => {
  it("builds the canonical watch URL for a video id", () => {
    expect(youtubeCanonicalUrl("dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    );
  });
});
