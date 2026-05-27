"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@annotated/backend/convex/_generated/api";
import { FollowButton } from "./follow-button";

function initials(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

/** Brutalist right dashboard rail: real "people worth following" suggestions. */
export function RightRail() {
  const people = useQuery(api.users.suggestions, { limit: 4 });
  if (!people || people.length === 0) return <aside className="hidden xl:block" />;

  return (
    <aside className="hidden xl:block">
      <div className="border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] text-[color:var(--b-ink)] shadow-[6px_6px_0_0_var(--b-shadow)]">
        <div className="bg-[color:var(--b-chrome)] px-3.5 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--b-acid)]">
          People worth following
        </div>
        {people.map((p, i) => (
          <div
            key={p._id}
            className={`flex items-center gap-2.5 px-3.5 py-3 ${
              i < people.length - 1 ? "border-b-2 border-[color:var(--b-line)]" : ""
            }`}
          >
            <Link
              href={`/u/${p.username}`}
              className="grid size-9 flex-none place-items-center border-2 border-[color:var(--b-line)] bg-[color:var(--b-acid)] text-[13px] font-black text-[color:var(--b-acid-ink)]"
            >
              {initials(p.displayName)}
            </Link>
            <div className="min-w-0">
              <Link href={`/u/${p.username}`} className="block truncate text-[14px] font-extrabold hover:underline">
                {p.displayName}
              </Link>
              <span className="font-mono text-[11px] text-[color:var(--b-dim)]">@{p.username}</span>
            </div>
            <span className="ml-auto">
              <FollowButton targetUserId={p._id} />
            </span>
          </div>
        ))}
      </div>
    </aside>
  );
}
