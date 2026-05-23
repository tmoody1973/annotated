import { describe, expect, it } from "vitest";
import { transcribeBodySchema } from "./transcribe-schema.js";

describe("transcribeBodySchema", () => {
  it("accepts a valid sourceId and mp3Url", () => {
    const result = transcribeBodySchema.safeParse({
      sourceId: "k1234abcd",
      mp3Url: "https://example.com/episode.mp3",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing sourceId", () => {
    const result = transcribeBodySchema.safeParse({
      mp3Url: "https://example.com/episode.mp3",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty sourceId", () => {
    const result = transcribeBodySchema.safeParse({
      sourceId: "",
      mp3Url: "https://example.com/episode.mp3",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing mp3Url", () => {
    const result = transcribeBodySchema.safeParse({ sourceId: "k1234abcd" });
    expect(result.success).toBe(false);
  });

  it("rejects an mp3Url that is not a URL", () => {
    const result = transcribeBodySchema.safeParse({
      sourceId: "k1234abcd",
      mp3Url: "not-a-url",
    });
    expect(result.success).toBe(false);
  });
});
