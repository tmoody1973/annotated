"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "@annotated/backend/convex/_generated/api";

export function CurrentUserPanel() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const ensureCurrentUser = useMutation(api.users.ensureCurrentUser);
  const currentUser = useQuery(
    api.users.currentUser,
    isAuthenticated ? {} : "skip"
  );

  // Call the idempotent upsert once the Convex auth state is ready.
  useEffect(() => {
    if (isAuthenticated) {
      void ensureCurrentUser();
    }
  }, [isAuthenticated, ensureCurrentUser]);

  if (isLoading) {
    return <p className="text-sm text-neutral-500">Loading…</p>;
  }

  if (!currentUser) {
    return <p className="text-sm text-neutral-500">Syncing your profile…</p>;
  }

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4 text-sm">
      <div className="font-medium">{currentUser.displayName}</div>
      <div className="text-neutral-500">@{currentUser.username}</div>
    </div>
  );
}
