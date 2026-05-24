import { describe, expect, it } from "vitest";
import { cleanYoutubeTitle } from "./clean-youtube-title.js";

describe("cleanYoutubeTitle", () => {
  it("strips the trailing ' - YouTube' suffix", () => {
    expect(cleanYoutubeTitle("Plain Title - YouTube")).toBe("Plain Title");
  });

  it("strips YouTube's leading (N) notification badge", () => {
    expect(cleanYoutubeTitle("(68) The Golden Age - YouTube")).toBe(
      "The Golden Age"
    );
  });

  it("strips a badge even without the suffix", () => {
    expect(cleanYoutubeTitle("(1) Foo")).toBe("Foo");
  });

  it("leaves a real parenthetical that is not a number", () => {
    expect(cleanYoutubeTitle("(Official Video) Song - YouTube")).toBe(
      "(Official Video) Song"
    );
  });

  it("returns a plain title unchanged", () => {
    expect(cleanYoutubeTitle("YouTube video")).toBe("YouTube video");
  });
});
