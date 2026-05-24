import { describe, expect, it } from "vitest";
import { formatClipTimestamp } from "./format-clip-timestamp.js";

describe("formatClipTimestamp", () => {
  it("formats whole minutes and seconds", () => {
    expect(formatClipTimestamp(90_000)).toBe("1:30");
  });

  it("zero-pads the seconds", () => {
    expect(formatClipTimestamp(5_000)).toBe("0:05");
  });

  it("formats zero", () => {
    expect(formatClipTimestamp(0)).toBe("0:00");
  });

  it("handles multi-digit minutes", () => {
    expect(formatClipTimestamp(600_000)).toBe("10:00");
  });

  it("floors sub-second milliseconds", () => {
    expect(formatClipTimestamp(10_750)).toBe("0:10");
  });

  it("uses h:mm:ss past one hour so clockToMs can round-trip it", () => {
    expect(formatClipTimestamp(3_723_000)).toBe("1:02:03");
  });

  it("zero-pads minutes only in the hour form", () => {
    expect(formatClipTimestamp(3_600_000 + 5_000)).toBe("1:00:05");
  });
});
