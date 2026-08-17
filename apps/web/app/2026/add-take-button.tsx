"use client";

import { useState } from "react";
import Link from "next/link";
import { useConvexAuth } from "convex/react";
import { SignInButton } from "@clerk/nextjs";
import { ArticleClipModal } from "../_components/article-clip-modal";

/** Takes written from The Record belong to the campaign room by default. */
export const CAMPAIGN_TOPIC_SLUG = "wisconsin-2026";

const className =
  "border-2 border-[color:var(--b-line)] bg-[color:var(--b-acid)] px-3 py-1.5 text-[12px] font-black uppercase tracking-wide text-[color:var(--b-acid-ink)] shadow-[3px_3px_0_0_var(--b-shadow)] transition-transform hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_0_var(--b-shadow)]";

/**
 * The one action that fixes a record entry nobody has annotated.
 *
 * Which composer opens depends on the source. An article is highlighted on the
 * web; audio and video are dragged out in the side panel, and the web app has
 * no way to do that — so an audio row sends you to the episode with the panel,
 * rather than opening a composer that cannot read it.
 */
export function AddTakeButton({
  sourceUrl,
  sourceType = "article",
}: {
  sourceUrl: string;
  sourceType?: string;
}) {
  const { isAuthenticated } = useConvexAuth();
  const [open, setOpen] = useState(false);

  // Audio and video are clipped in the side panel, which means the extension.
  // The button used to open the episode and say nothing — someone without the
  // extension landed on a podcast page with no idea what had happened. Say the
  // requirement before the click, and offer the way to meet it.
  if (sourceType !== "article") {
    return (
      <span className="flex flex-wrap items-center gap-2">
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={className}
        >
          Open the episode ↗
        </a>
        <Link
          href="/extension"
          className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] underline decoration-2 underline-offset-4"
        >
          needs the extension
        </Link>
      </span>
    );
  }

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
