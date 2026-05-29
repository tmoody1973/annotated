"use client";

import { usePaginatedQuery } from "convex/react";
import { api } from "@annotated/backend/convex/_generated/api";
import { FeedGrid } from "./feed-grid";
import type { FeedItem } from "./annotation-card";

/** The public Latest feed: real-time, paginated clip cards, newest first. */
export function Feed() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.annotations.listFeed,
    {},
    { initialNumItems: 10 }
  );

  if (status === "LoadingFirstPage") {
    return <p className="font-mono text-sm text-[color:var(--b-dim-onbg)]">Loading feed…</p>;
  }
  if (results.length === 0) {
    return (
      <p className="font-mono text-sm text-[color:var(--b-dim-onbg)]">
        No clips yet — grab one with the extension.
      </p>
    );
  }

  return (
    <FeedGrid
      results={results as FeedItem[]}
      canLoadMore={status === "CanLoadMore"}
      onLoadMore={() => loadMore(10)}
    />
  );
}
