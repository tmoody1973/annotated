"use client";

import { useState } from "react";
import { useConvexAuth } from "convex/react";
import { SignInButton } from "@clerk/nextjs";
import { ArticleClipModal } from "../_components/article-clip-modal";

/** Takes written from The Record belong to the campaign room by default. */
export const CAMPAIGN_TOPIC_SLUG = "wisconsin-2026";

const className =
  "border-2 border-[color:var(--b-line)] bg-[color:var(--b-acid)] px-3 py-1.5 text-[12px] font-black uppercase tracking-wide text-[color:var(--b-acid-ink)] shadow-[3px_3px_0_0_var(--b-shadow)] transition-transform hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_0_var(--b-shadow)]";

/**
 * The one action that fixes a record entry nobody has annotated. Opens the
 * ordinary composer with the source already loaded — nothing about the flow is
 * campaign-specific beyond the prefill.
 */
export function AddTakeButton({ sourceUrl }: { sourceUrl: string }) {
  const { isAuthenticated } = useConvexAuth();
  const [open, setOpen] = useState(false);

  if (!isAuthenticated) {
    return (
      <SignInButton mode="modal">
        <button className={className}>Add yours</button>
      </SignInButton>
    );
  }

  return (
    <>
      <button className={className} onClick={() => setOpen(true)}>
        Add yours
      </button>
      {open && (
        <ArticleClipModal
          initialUrl={sourceUrl}
          pinnedTopicSlug={CAMPAIGN_TOPIC_SLUG}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
