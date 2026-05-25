"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { SignInButton } from "@clerk/nextjs";
import { Button } from "@heroui/react";
import { api } from "@annotated/backend/convex/_generated/api";
import type { Id } from "@annotated/backend/convex/_generated/dataModel";

/**
 * Up/down vote control for an annotation — Jason's binary "brilliant" (▲) vs
 * "BS" (▼) trigger. The user's current choice is highlighted; the net score is
 * shown small (no Reddit-style score wars). Signed-out users route to sign-in.
 * Counts update in real time via the parent feed/landing query.
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

  if (!isAuthenticated) {
    return (
      <SignInButton mode="modal">
        <Button variant="ghost" size="sm" aria-label="Vote (sign in)">
          ▲ {net} ▼
        </Button>
      </SignInButton>
    );
  }

  return (
    <div className="inline-flex items-center gap-1">
      <Button
        variant={myVote === 1 ? "primary" : "ghost"}
        size="sm"
        aria-label="Brilliant (upvote)"
        aria-pressed={myVote === 1}
        onPress={() => void toggle({ annotationId: id, value: 1 })}
      >
        ▲
      </Button>
      <span
        className="min-w-6 text-center text-sm tabular-nums text-muted"
        aria-label={`net score ${net}`}
      >
        {net}
      </span>
      <Button
        variant={myVote === -1 ? "danger" : "ghost"}
        size="sm"
        aria-label="BS (downvote)"
        aria-pressed={myVote === -1}
        onPress={() => void toggle({ annotationId: id, value: -1 })}
      >
        ▼
      </Button>
    </div>
  );
}
