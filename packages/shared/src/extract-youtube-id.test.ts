import { describe, expect, it } from "vitest";
import { extractYoutubeVideoId } from "./extract-youtube-id.js";

describe("extractYoutubeVideoId", () => {
  it("extracts the id from a standard watch URL", () => {
    expect(extractYoutubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ"
    );
  });

  it("extracts the id from a youtu.be short URL", () => {
    expect(extractYoutubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts the id from a shorts URL", () => {
    expect(extractYoutubeVideoId("https://www.youtube.com/shorts/abcdEFGH123")).toBe(
      "abcdEFGH123"
    );
  });

  it("ignores extra query params and returns only v", () => {
    expect(
      extractYoutubeVideoId(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s&list=PLxyz"
      )
    ).toBe("dQw4w9WgXcQ");
  });

  it("works on the mobile host", () => {
    expect(extractYoutubeVideoId("https://m.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ"
    );
  });

  it("returns null for a non-YouTube URL", () => {
    expect(extractYoutubeVideoId("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
  });

  it("returns null for the YouTube home page (no video)", () => {
    expect(extractYoutubeVideoId("https://www.youtube.com/")).toBeNull();
  });

  it("returns null for a watch URL missing the v param", () => {
    expect(extractYoutubeVideoId("https://www.youtube.com/watch")).toBeNull();
  });

  it("returns null for a malformed id of the wrong length", () => {
    expect(extractYoutubeVideoId("https://youtu.be/tooshort")).toBeNull();
  });

  it("returns null for an empty or invalid URL without throwing", () => {
    expect(extractYoutubeVideoId("")).toBeNull();
    expect(extractYoutubeVideoId("not a url")).toBeNull();
  });
});
