"use client";

import { usePaginatedQuery } from "convex/react";
import { api } from "@annotated/backend/convex/_generated/api";
import { AnnotationCard, type FeedItem } from "./annotation-card";

/** The public feed: real-time, paginated clip cards in a brutalist masonry. */
export function Feed() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.annotations.listFeed,
    {},
    { initialNumItems: 10 }
  );

  if (status === "LoadingFirstPage") {
    return <p className="font-mono text-sm text-[color:var(--b-dim)]">Loading feed…</p>;
  }
  if (results.length === 0) {
    return (
      <p className="font-mono text-sm text-[color:var(--b-dim)]">
        No clips yet — grab one with the extension.
      </p>
    );
  }

  return (
    <div>
      <div className="gap-6 md:columns-2 [&>*]:break-inside-avoid">
        {results.map((item) => (
          <AnnotationCard key={item._id} item={item as FeedItem} />
        ))}
      </div>
      {status === "CanLoadMore" && (
        <button
          onClick={() => loadMore(10)}
          className="mt-2 w-full border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] px-4 py-3 font-mono text-[13px] font-bold uppercase tracking-[0.12em] text-[color:var(--b-ink)] shadow-[5px_5px_0_0_var(--b-shadow)] hover:bg-[color:var(--b-acid)]"
        >
          Load more ↓
        </button>
      )}
    </div>
  );
}
