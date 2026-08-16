"use client";

import { useEffect, useRef } from "react";
import { makeFunctionReference } from "convex/server";
import { useQuery } from "convex/react";

const MAX_TOPICS = 3;

type TopicListItem = {
  _id: string;
  slug: string;
  name: string;
  description?: string | null;
};

const listTopics = makeFunctionReference<"query", Record<string, never>, TopicListItem[]>(
  "topics:list"
);

/** Multi-select topic chips (1–3) for the web composer. Lifts selected topic ids. */
export function TopicPicker({
  selected,
  onChange,
  pinnedSlug,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
  /** Pre-selects this topic once, when the list first loads — a take written
   *  from a campaign surface belongs to that campaign's room by default. Applied
   *  a single time, so the writer can still deselect it. */
  pinnedSlug?: string;
}) {
  const topics = useQuery(listTopics);

  const didPin = useRef(false);
  useEffect(() => {
    if (didPin.current || !pinnedSlug || !topics) return;
    const pinned = topics.find((t) => t.slug === pinnedSlug);
    if (!pinned) return;
    didPin.current = true;
    if (!selected.includes(pinned._id)) onChange([...selected, pinned._id]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics, pinnedSlug]);

  function toggle(id: string) {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else if (selected.length < MAX_TOPICS) onChange([...selected, id]);
  }

  if (topics === undefined) {
    return <p className="font-mono text-[12px] text-[color:var(--b-dim)]">Loading topics…</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--b-dim)]">
        Topics (pick 1–3)
      </label>
      <div className="flex flex-wrap gap-1.5">
        {topics.map((t) => {
          const active = selected.includes(t._id);
          const atCap = !active && selected.length >= MAX_TOPICS;
          return (
            <button
              key={t._id}
              type="button"
              onClick={() => toggle(t._id)}
              disabled={atCap}
              className={`border-2 border-[color:var(--b-line)] px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-wide ${
                active
                  ? "bg-[color:var(--b-acid)] text-[color:var(--b-acid-ink)]"
                  : "bg-[color:var(--b-card)] text-[color:var(--b-ink)]"
              } ${atCap ? "cursor-not-allowed opacity-40" : "hover:bg-[color:var(--b-acid)]"}`}
            >
              #{t.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
