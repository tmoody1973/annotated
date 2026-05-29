"use client";

import { useQuery } from "convex/react";
import { api } from "@annotated/backend/convex/_generated/api";
import { EmptyClipsNudge } from "./empty-clips-nudge";

/** Empty annotation list on a profile: the owner sees the extension/onboarding
 *  nudge; a visitor sees neutral copy (don't pitch installing to someone looking
 *  at someone else's empty profile). */
export function ProfileEmptyState({ username }: { username: string }) {
  const me = useQuery(api.users.currentUser);
  const isOwner = me?.username === username;

  if (isOwner) return <EmptyClipsNudge />;

  return (
    <p className="font-mono text-sm text-[color:var(--b-dim-onbg)]">No annotations yet.</p>
  );
}
