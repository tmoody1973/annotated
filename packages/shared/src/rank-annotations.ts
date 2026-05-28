// Pure, immutable ranking for topic feeds. Three sort modes mirror the
// familiar Reddit triad: "new" (recency), "top" (net votes), and "hot"
// (a logarithmic time-decay blend so fresh-but-modest posts can outrank
// old-but-popular ones). No mutation of the input; no I/O.

export interface Rankable {
  publishedAt?: number;
  likeCount: number;
  downCount?: number;
}

export type RankSort = "hot" | "top" | "new";

// Reddit's hot algorithm normalizes the post age against this many seconds,
// so the score decays meaningfully over roughly a half-day window.
const GRAVITY_SECONDS = 45_000;

// Anchor epoch (2005-12-08, Reddit's launch) keeps the time term a small,
// stable number regardless of how far in the future the post timestamp is.
const EPOCH_SECONDS = 1_134_028_003;

export function netScore(likeCount: number, downCount?: number): number {
  return likeCount - (downCount ?? 0);
}

// Higher hotRank = hotter. Magnitude comes from log10(votes) so the first
// votes matter most; sign follows the net score; the time term lifts newer
// posts. publishedAt is in milliseconds; convert to seconds for the formula.
function hotRank(score: number, publishedAtMs: number): number {
  const order = Math.log10(Math.max(Math.abs(score), 1));
  const sign = score > 0 ? 1 : score < 0 ? -1 : 0;
  const ageSeconds = publishedAtMs / 1000 - EPOCH_SECONDS;
  return sign * order + ageSeconds / GRAVITY_SECONDS;
}

function byNewest(a: Rankable, b: Rankable): number {
  return (b.publishedAt ?? 0) - (a.publishedAt ?? 0);
}

function byTop(a: Rankable, b: Rankable): number {
  const scoreDelta =
    netScore(b.likeCount, b.downCount) - netScore(a.likeCount, a.downCount);
  return scoreDelta !== 0 ? scoreDelta : byNewest(a, b);
}

function byHot(a: Rankable, b: Rankable): number {
  const hotDelta =
    hotRank(netScore(b.likeCount, b.downCount), b.publishedAt ?? 0) -
    hotRank(netScore(a.likeCount, a.downCount), a.publishedAt ?? 0);
  return hotDelta !== 0 ? hotDelta : byNewest(a, b);
}

const COMPARATORS: Record<RankSort, (a: Rankable, b: Rankable) => number> = {
  new: byNewest,
  top: byTop,
  hot: byHot,
};

export function rankAnnotations<T extends Rankable>(
  items: readonly T[],
  sortMode: RankSort,
): T[] {
  return [...items].sort(COMPARATORS[sortMode]);
}
