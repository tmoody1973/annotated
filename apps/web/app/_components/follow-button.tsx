"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { SignInButton } from "@clerk/nextjs";
import { api } from "@annotated/backend/convex/_generated/api";
import type { Id } from "@annotated/backend/convex/_generated/dataModel";

const BASE =
  "border-2 border-[color:var(--b-line)] px-3.5 py-1.5 text-[12px] font-black uppercase tracking-wide";

/**
 * Brutalist follow/unfollow toggle. Filled acid when not following, outline when
 * following. Hidden on your own content; signed-out users route to sign-in.
 */
export function FollowButton({ targetUserId }: { targetUserId: string }) {
  const { isAuthenticated } = useConvexAuth();
  const id = targetUserId as Id<"users">;
  const me = useQuery(api.users.currentUser, isAuthenticated ? {} : "skip");
  const following = useQuery(
    api.follows.isFollowing,
    isAuthenticated ? { targetUserId: id } : "skip"
  );
  const toggle = useMutation(api.follows.toggleFollow);

  if (!isAuthenticated) {
    return (
      <SignInButton mode="modal">
        <button className={`${BASE} bg-[color:var(--b-acid)] text-[color:var(--b-acid-ink)]`}>
          Follow
        </button>
      </SignInButton>
    );
  }

  if (me && me._id === targetUserId) return null;

  return (
    <button
      className={`${BASE} ${
        following
          ? "bg-[color:var(--b-card)] text-[color:var(--b-ink)] hover:bg-[#ff3b30] hover:text-white hover:border-[#ff3b30]"
          : "bg-[color:var(--b-acid)] text-[color:var(--b-acid-ink)]"
      }`}
      onClick={() => void toggle({ targetUserId: id })}
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}
