"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { SignInButton } from "@clerk/nextjs";
import { api } from "@annotated/backend/convex/_generated/api";
import type { Id } from "@annotated/backend/convex/_generated/dataModel";

/**
 * Brutalist up/down vote — Jason's binary "brilliant" (▲) vs "BS" (▼). The user's
 * choice highlights (acid up / red down); the net score sits between in mono.
 * Signed-out users route to sign-in. Counts update in real time via the parent.
 */
export function VoteButtons({
  annotationId,
  upCount,
  downCount,
}: {
  annotationId: string;
  upCount: number;
  downCount: number;
}) {
  const { isAuthenticated } = useConvexAuth();
  const id = annotationId as Id<"annotations">;
  const myVote = useQuery(
    api.votes.getMyVote,
    isAuthenticated ? { annotationId: id } : "skip"
  );
  const toggle = useMutation(api.votes.toggleVote);
  const net = upCount - downCount;

  const shell =
    "inline-flex items-center border-2 border-[color:var(--b-line)] select-none";
  const cell = "px-2.5 py-1.5 text-[14px] font-black leading-none";
  const score =
    "border-x-2 border-[color:var(--b-line)] px-2.5 py-1.5 font-mono text-[13px] font-bold leading-none";

  if (!isAuthenticated) {
    return (
      <SignInButton mode="modal">
        <button className={shell} aria-label="Vote (sign in)">
          <span className={cell}>▲</span>
          <span className={score}>{net}</span>
          <span className={cell}>▼</span>
        </button>
      </SignInButton>
    );
  }

  return (
    <div className={shell}>
      <button
        className={`${cell} ${myVote === 1 ? "bg-[color:var(--b-acid)] text-[color:var(--b-acid-ink)]" : "hover:bg-[color:var(--b-acid)]"}`}
        aria-label="Brilliant (upvote)"
        aria-pressed={myVote === 1}
        onClick={() => void toggle({ annotationId: id, value: 1 })}
      >
        ▲
      </button>
      <span className={score}>{net}</span>
      <button
        className={`${cell} ${myVote === -1 ? "bg-[#ff3b30] text-white" : "hover:bg-[#ff3b30] hover:text-white"}`}
        aria-label="BS (downvote)"
        aria-pressed={myVote === -1}
        onClick={() => void toggle({ annotationId: id, value: -1 })}
      >
        ▼
      </button>
    </div>
  );
}
