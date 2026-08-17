import { describe, expect, it } from "vitest";
import { seedTakeFromChapter } from "./chapter-seed";

describe("seedTakeFromChapter", () => {
  it("titles an empty take", () => {
    expect(seedTakeFromChapter("", "The Foxconn years")).toBe(
      "Chapter: The Foxconn years — "
    );
    expect(seedTakeFromChapter("   \n ", "The Foxconn years")).toBe(
      "Chapter: The Foxconn years — "
    );
  });

  it("replaces a stub when the user picks a different chapter", () => {
    expect(
      seedTakeFromChapter("Chapter: The Foxconn years — ", "What came after")
    ).toBe("Chapter: What came after — ");
  });

  it("never overwrites what the user wrote", () => {
    expect(seedTakeFromChapter("This is the part that matters", "Anything")).toBeNull();
    // A stub the user has started typing into is their text now, not a stub.
    expect(
      seedTakeFromChapter("Chapter: The Foxconn years — he dodges it", "Anything")
    ).toBeNull();
  });
});
