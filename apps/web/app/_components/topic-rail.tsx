"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";

interface TopicSummary {
  _id: string;
  slug: string;
  name: string;
  description?: string;
}

const listTopics = makeFunctionReference<"query", Record<string, never>, TopicSummary[]>(
  "topics:list"
);

/** A horizontal rail of topic chips above the feed — navigation into rooms. */
export function TopicRail() {
  const topics = useQuery(listTopics, {});
  if (!topics || topics.length === 0) return null;
  return (
    <div className="mb-5 flex flex-wrap gap-2">
      {topics.map((t) => (
        <Link
          key={t.slug}
          href={`/topics/${t.slug}`}
          className="border-2 border-[color:var(--b-line)] bg-[color:var(--b-card)] px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--b-ink)] hover:bg-[color:var(--b-acid)]"
        >
          #{t.name}
        </Link>
      ))}
    </div>
  );
}
