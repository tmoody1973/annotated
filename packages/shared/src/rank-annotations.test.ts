import { describe, expect, it } from "vitest";

import { netScore, rankAnnotations, type Rankable } from "./rank-annotations";

const HOUR_MS = 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

function mk(overrides: Partial<Rankable & { id: string }> = {}): Rankable & {
  id: string;
} {
  return {
    id: overrides.id ?? "x",
    publishedAt: overrides.publishedAt ?? NOW,
    likeCount: overrides.likeCount ?? 0,
    downCount: overrides.downCount,
  };
}

describe("netScore", () => {
  it("sums upvotes and subtracts downvotes", () => {
    expect(netScore(10, 3)).toBe(7);
  });

  it("treats a missing downCount as zero (legacy rows)", () => {
    expect(netScore(5)).toBe(5);
    expect(netScore(5, undefined)).toBe(5);
  });
});

describe("rankAnnotations", () => {
  it("'new' mode sorts by publishedAt descending", () => {
    const older = mk({ id: "older", publishedAt: NOW - 5 * HOUR_MS });
    const newer = mk({ id: "newer", publishedAt: NOW });
    const middle = mk({ id: "middle", publishedAt: NOW - 2 * HOUR_MS });

    const ranked = rankAnnotations([older, newer, middle], "new") as Array<
      Rankable & { id: string }
    >;

    expect(ranked.map((r) => r.id)).toEqual(["newer", "middle", "older"]);
  });

  it("'top' mode sorts by netScore descending with publishedAt tiebreak", () => {
    const lowScore = mk({ id: "low", likeCount: 2, downCount: 0 });
    const highScore = mk({ id: "high", likeCount: 50, downCount: 5 });
    const tieOld = mk({
      id: "tieOld",
      likeCount: 10,
      publishedAt: NOW - 3 * HOUR_MS,
    });
    const tieNew = mk({ id: "tieNew", likeCount: 10, publishedAt: NOW });

    const ranked = rankAnnotations(
      [lowScore, tieOld, highScore, tieNew],
      "top",
    ) as Array<Rankable & { id: string }>;

    expect(ranked.map((r) => r.id)).toEqual([
      "high",
      "tieNew",
      "tieOld",
      "low",
    ]);
  });

  it("handles negative net scores in 'top' mode", () => {
    const negative = mk({ id: "neg", likeCount: 1, downCount: 9 });
    const positive = mk({ id: "pos", likeCount: 4, downCount: 1 });
    const zero = mk({ id: "zero", likeCount: 2, downCount: 2 });

    const ranked = rankAnnotations(
      [negative, positive, zero],
      "top",
    ) as Array<Rankable & { id: string }>;

    expect(ranked.map((r) => r.id)).toEqual(["pos", "zero", "neg"]);
  });

  it("'hot' mode lets a fresh modest post outrank an old high-scoring post", () => {
    const oldHot = mk({
      id: "oldHot",
      likeCount: 100,
      publishedAt: NOW - 72 * HOUR_MS,
    });
    const freshModest = mk({
      id: "freshModest",
      likeCount: 30,
      publishedAt: NOW,
    });

    const ranked = rankAnnotations([oldHot, freshModest], "hot") as Array<
      Rankable & { id: string }
    >;

    expect(ranked[0]?.id).toBe("freshModest");
  });

  it("does not mutate the input array", () => {
    const input = [
      mk({ id: "a", publishedAt: NOW - HOUR_MS }),
      mk({ id: "b", publishedAt: NOW }),
    ];
    const snapshot = input.map((r) => r.id);

    rankAnnotations(input, "new");

    expect(input.map((r) => r.id)).toEqual(snapshot);
  });

  it("returns an empty array for empty input", () => {
    expect(rankAnnotations([], "hot")).toEqual([]);
    expect(rankAnnotations([], "top")).toEqual([]);
    expect(rankAnnotations([], "new")).toEqual([]);
  });
});
