export interface Rankable {
  publishedAt?: number;
  likeCount: number;
  downCount?: number;
}

export type RankSort = "hot" | "top" | "new";

/** Net vote score: upvotes minus downvotes. An absent downCount (legacy rows) reads as 0. */
export function netScore(item: Pick<Rankable, "likeCount" | "downCount">): number {
  return item.likeCount - (item.downCount ?? 0);
}

// Reddit's "hot" gravity divisor, expressed in seconds. Each order of magnitude of
// net votes is worth ~12.5 hours of freshness.
const HOT_SECONDS_DIVISOR = 45_000;

function hotRank(item: Rankable): number {
  const net = netScore(item);
  const order = Math.log10(Math.max(Math.abs(net), 1));
  const sign = net > 0 ? 1 : net < 0 ? -1 : 0;
  const seconds = (item.publishedAt ?? 0) / 1000; // publishedAt is ms; the divisor is seconds
  return sign * order + seconds / HOT_SECONDS_DIVISOR;
}

/** Orders candidates by the chosen sort. Pure — returns a new array, never mutates. */
export function rankAnnotations<T extends Rankable>(items: readonly T[], sort: RankSort): T[] {
  const copy = [...items];
  if (sort === "new") {
    return copy.sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
  }
  if (sort === "top") {
    return copy.sort(
      (a, b) => netScore(b) - netScore(a) || (b.publishedAt ?? 0) - (a.publishedAt ?? 0)
    );
  }
  return copy.sort((a, b) => hotRank(b) - hotRank(a));
}
