"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@annotated/backend/convex/_generated/api";
import { AnnotationCard, type FeedItem } from "./annotation-card";

const SORTS = [
  ["hot", "Hot"],
  ["top", "Top"],
  ["new", "New"],
] as const;
type Sort = (typeof SORTS)[number][0];

/** A topic room's ranked feed with Hot/Top/New tabs. Real-time via useQuery. */
export function TopicFeed({ slug }: { slug: string }) {
  const [sort, setSort] = useState<Sort>("hot");
  const data = useQuery(api.annotations.listByTopic, { slug, sort });
  const items = (data?.items ?? []) as FeedItem[];

  return (
    <div>
      <div className="mb-5 flex gap-2">
        {SORTS.map(([value, label]) => (
          <button
            key={value}
            onClick={() => setSort(value)}
            className={`border-[3px] border-[color:var(--b-line)] px-3 py-1.5 font-mono text-[12px] font-bold uppercase tracking-[0.12em] shadow-[4px_4px_0_0_var(--b-shadow)] ${
              sort === value
                ? "bg-[color:var(--b-chrome)] text-[color:var(--b-acid)]"
                : "bg-[color:var(--b-card)] text-[color:var(--b-ink)] hover:bg-[color:var(--b-acid)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {data === undefined ? (
        <p className="font-mono text-sm text-[color:var(--b-dim)]">Loading…</p>
      ) : items.length === 0 ? (
        <p className="font-mono text-sm text-[color:var(--b-dim)]">
          No clips in this topic yet.
        </p>
      ) : (
        <div className="gap-6 md:columns-2 [&>*]:break-inside-avoid">
          {items.map((item) => (
            <AnnotationCard key={item._id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
