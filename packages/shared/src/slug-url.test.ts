import { describe, expect, test } from "vitest";
import { slugify, splitSlugId, slugId } from "./slug-url";

describe("slugify", () => {
  test("lowercases, hyphenates, and strips punctuation", () => {
    expect(slugify("DR Congo Ebola Cases Rise!")).toBe(
      "dr-congo-ebola-cases-rise"
    );
  });

  test("strips diacritics", () => {
    expect(slugify("Beyoncé café São Paulo")).toBe("beyonce-cafe-sao-paulo");
  });

  test("collapses whitespace/punctuation runs and trims hyphens", () => {
    expect(slugify("  --Hello,,,  World--  ")).toBe("hello-world");
  });

  test("caps to ~8 words at a word boundary", () => {
    const long = "one two three four five six seven eight nine ten";
    expect(slugify(long)).toBe("one-two-three-four-five-six-seven-eight");
  });

  test("returns empty string for all-symbol or empty input", () => {
    expect(slugify("!!! ??? ...")).toBe("");
    expect(slugify("")).toBe("");
  });
});

describe("splitSlugId", () => {
  test("splits a slug-id param on the last hyphen", () => {
    expect(splitSlugId("dr-congo-ebola-kd76jfmj98wmba8kyvtz8gw2rx87dny9")).toEqual({
      slug: "dr-congo-ebola",
      id: "kd76jfmj98wmba8kyvtz8gw2rx87dny9",
    });
  });

  test("treats a bare id (no slug) as id-only", () => {
    expect(splitSlugId("kd76jfmj98wmba8kyvtz8gw2rx87dny9")).toEqual({
      slug: "",
      id: "kd76jfmj98wmba8kyvtz8gw2rx87dny9",
    });
  });
});

describe("slugId", () => {
  test("joins a slug and id; falls back to bare id when title has no slug", () => {
    expect(slugId("DR Congo Ebola", "abc123")).toBe("dr-congo-ebola-abc123");
    expect(slugId("!!!", "abc123")).toBe("abc123");
  });

  test("round-trips: splitSlugId(slugId(title, id)).id === id", () => {
    const id = "kd76jfmj98wmba8kyvtz8gw2rx87dny9";
    expect(splitSlugId(slugId("A Long Episode Title", id)).id).toBe(id);
    expect(splitSlugId(slugId("###", id)).id).toBe(id);
  });
});
