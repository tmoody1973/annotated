"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { SignInButton } from "@clerk/nextjs";
import { Button } from "@heroui/react";
import { api } from "@annotated/backend/convex/_generated/api";
import type { Id } from "@annotated/backend/convex/_generated/dataModel";

/**
 * Follow/unfollow toggle for a target user. Hidden when the target is the
 * signed-in user themselves; routes signed-out users to sign-in.
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
        <Button size="sm">Follow</Button>
      </SignInButton>
    );
  }

  // Don't show a follow button on your own content.
  if (me && me._id === targetUserId) return null;

  return (
    <Button
      size="sm"
      variant={following ? "outline" : "primary"}
      onPress={() => void toggle({ targetUserId: id })}
    >
      {following ? "Following" : "Follow"}
    </Button>
  );
}
