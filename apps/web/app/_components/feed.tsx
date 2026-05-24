"use client";

import { usePaginatedQuery } from "convex/react";
import { Button } from "@heroui/react";
import { api } from "@annotated/backend/convex/_generated/api";
import { AnnotationCard, type FeedItem } from "./annotation-card";

/** The public feed: real-time, paginated annotation cards (newest first). */
export function Feed() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.annotations.listFeed,
    {},
    { initialNumItems: 10 }
  );

  if (status === "LoadingFirstPage") {
    return <p className="text-muted">Loading feed…</p>;
  }
  if (results.length === 0) {
    return <p className="text-muted">No annotations yet — clip something with the extension.</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      {results.map((item) => (
        <AnnotationCard key={item._id} item={item as FeedItem} />
      ))}
      {status === "CanLoadMore" && (
        <Button variant="outline" onPress={() => loadMore(10)}>
          Load more
        </Button>
      )}
    </div>
  );
}
