"use client";

import { AnnotationCard, type FeedItem } from "./annotation-card";

/** Presentational masonry of clip cards + a load-more control. Shared by the
 *  Latest feed and the Curated feed so both render identically. */
export function FeedGrid({
  results,
  canLoadMore,
  onLoadMore,
}: {
  results: FeedItem[];
  canLoadMore: boolean;
  onLoadMore: () => void;
}) {
  return (
    <div>
      <div className="gap-6 md:columns-2 [&>*]:break-inside-avoid">
        {results.map((item) => (
          <AnnotationCard key={item._id} item={item} />
        ))}
      </div>
      {canLoadMore && (
        <button
          onClick={onLoadMore}
          className="mt-2 w-full border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] px-4 py-3 font-mono text-[13px] font-bold uppercase tracking-[0.12em] text-[color:var(--b-ink)] shadow-[5px_5px_0_0_var(--b-shadow)] hover:bg-[color:var(--b-acid)]"
        >
          Load more ↓
        </button>
      )}
    </div>
  );
}
