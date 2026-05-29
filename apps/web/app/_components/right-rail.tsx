"use client";

import Link from "next/link";
import { useConvexAuth, useQuery } from "convex/react";
import { SignUpButton } from "@clerk/nextjs";
import { api } from "@annotated/backend/convex/_generated/api";
import { FollowButton } from "./follow-button";
import { AuthorAvatar } from "./author-avatar";

/** Logged-out conversion card that leads the rail (§1): the rail becomes a
 *  join/follow funnel for strangers. Unmounts once signed in. */
function JoinCard() {
  return (
    <div className="border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] text-[color:var(--b-ink)] shadow-[6px_6px_0_0_var(--b-shadow)]">
      <div className="bg-[color:var(--b-chrome)] px-3.5 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--b-acid)]">
        Join Annotated
      </div>
      <div className="p-3.5">
        <p className="font-mono text-[12px] leading-relaxed text-[color:var(--b-ink)]">
          Follow the people whose takes you trust. Save clips. Publish your own.
        </p>
        <SignUpButton mode="modal">
          <button className="mt-3 w-full border-2 border-[color:var(--b-line)] bg-[color:var(--b-acid)] px-3 py-2.5 font-mono text-[12px] font-bold uppercase tracking-wide text-[color:var(--b-acid-ink)]">
            Create account →
          </button>
        </SignUpButton>
      </div>
    </div>
  );
}

/** Brutalist right dashboard rail: a logged-out join card (conversion layer)
 *  above real "people worth following" suggestions. */
export function RightRail() {
  const { isAuthenticated } = useConvexAuth();
  const people = useQuery(api.users.suggestions, { limit: 4 });

  const hasPeople = !!people && people.length > 0;
  if (isAuthenticated && !hasPeople) return <aside className="hidden xl:block" />;

  return (
    <aside className="hidden flex-col gap-5 xl:flex xl:sticky xl:top-[76px] xl:self-start">
      {!isAuthenticated && <JoinCard />}

      {hasPeople && (
        <div className="border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] text-[color:var(--b-ink)] shadow-[6px_6px_0_0_var(--b-shadow)]">
          <div className="bg-[color:var(--b-chrome)] px-3.5 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--b-acid)]">
            People worth following
          </div>
          {people!.map((p, i) => (
            <div
              key={p._id}
              className={`flex items-center gap-2.5 px-3.5 py-3 ${
                i < people!.length - 1 ? "border-b-2 border-[color:var(--b-line)]" : ""
              }`}
            >
              <Link href={`/@${p.username}`} className="flex-none">
                <AuthorAvatar displayName={p.displayName} avatarUrl={p.avatarUrl} size={36} />
              </Link>
              <div className="min-w-0">
                <Link href={`/@${p.username}`} className="block truncate text-[14px] font-extrabold hover:underline">
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
      )}
    </aside>
  );
}
