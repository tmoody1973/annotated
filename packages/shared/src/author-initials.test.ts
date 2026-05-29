import { describe, expect, it } from "vitest";
import { authorInitials } from "./author-initials.js";

describe("authorInitials", () => {
  it("takes the first letter of the first two words, uppercased", () => {
    expect(authorInitials("Tarik Moody")).toBe("TM");
  });
  it("handles a single name", () => {
    expect(authorInitials("Madonna")).toBe("M");
  });
  it("ignores extra whitespace", () => {
    expect(authorInitials("  Renée   Del  Rio ")).toBe("RD");
  });
  it("returns empty string for empty input", () => {
    expect(authorInitials("")).toBe("");
  });
});
