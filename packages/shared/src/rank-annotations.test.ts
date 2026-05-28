import { describe, expect, it } from "vitest";
import { netScore, rankAnnotations, type Rankable } from "./rank-annotations.js";

const mk = (p: Partial<Rankable>): Rankable => ({
  publishedAt: 0,
  likeCount: 0,
  downCount: 0,
  ...p,
});

describe("netScore", () => {
  it("subtracts downvotes from upvotes", () => {
    expect(netScore({ likeCount: 5, downCount: 2 })).toBe(3);
  });
  it("treats an absent downCount as zero (legacy rows)", () => {
    expect(netScore({ likeCount: 4 })).toBe(4);
  });
});

describe("rankAnnotations", () => {
  it("new: orders by publishedAt desc regardless of votes", () => {
    const a = mk({ publishedAt: 1, likeCount: 100 });
    const b = mk({ publishedAt: 2, likeCount: 0 });
    expect(rankAnnotations([a, b], "new").map((x) => x.publishedAt)).toEqual([2, 1]);
  });

  it("top: higher net first, ties broken by newer publishedAt", () => {
    const a = mk({ publishedAt: 1, likeCount: 3 });
    const b = mk({ publishedAt: 9, likeCount: 3 });
    const c = mk({ publishedAt: 5, likeCount: 10 });
    expect(rankAnnotations([a, b, c], "top")).toEqual([c, b, a]);
  });

  it("top: negative net sinks below zero net", () => {
    const bad = mk({ publishedAt: 9, likeCount: 0, downCount: 5 });
    const neutral = mk({ publishedAt: 1, likeCount: 0 });
    expect(rankAnnotations([bad, neutral], "top")).toEqual([neutral, bad]);
  });

  it("hot: at equal net, newer ranks first", () => {
    const older = mk({ publishedAt: 1_000_000, likeCount: 5 });
    const newer = mk({ publishedAt: 9_000_000, likeCount: 5 });
    expect(rankAnnotations([older, newer], "hot")).toEqual([newer, older]);
  });

  it("hot: at equal publishedAt, higher net ranks first", () => {
    const lo = mk({ publishedAt: 5_000_000, likeCount: 1 });
    const hi = mk({ publishedAt: 5_000_000, likeCount: 100 });
    expect(rankAnnotations([lo, hi], "hot")).toEqual([hi, lo]);
  });

  it("does not mutate the input array", () => {
    const items = [mk({ publishedAt: 1 }), mk({ publishedAt: 2 })];
    const snapshot = [...items];
    rankAnnotations(items, "new");
    expect(items).toEqual(snapshot);
  });

  it("returns empty for an empty input", () => {
    expect(rankAnnotations([], "hot")).toEqual([]);
  });
});
