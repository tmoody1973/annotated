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
});
