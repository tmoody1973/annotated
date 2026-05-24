"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { SignInButton } from "@clerk/nextjs";
import { Button } from "@heroui/react";
import { api } from "@annotated/backend/convex/_generated/api";
import type { Id } from "@annotated/backend/convex/_generated/dataModel";

/**
 * Heart toggle for an annotation. Signed-out users are routed to sign-in; signed
 * in, it toggles the like and the count updates in real time via the feed query.
 */
export function LikeButton({
  annotationId,
  likeCount,
}: {
  annotationId: string;
  likeCount: number;
}) {
  const { isAuthenticated } = useConvexAuth();
  const id = annotationId as Id<"annotations">;
  const liked = useQuery(api.likes.isLiked, isAuthenticated ? { annotationId: id } : "skip");
  const toggle = useMutation(api.likes.toggleLike);

  const label = `${liked ? "♥" : "♡"} ${likeCount}`;

  if (!isAuthenticated) {
    return (
      <SignInButton mode="modal">
        <Button variant="ghost" size="sm" aria-label="Like (sign in)">
          ♡ {likeCount}
        </Button>
      </SignInButton>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={liked ? "Unlike" : "Like"}
      onPress={() => void toggle({ annotationId: id })}
    >
      {label}
    </Button>
  );
}
