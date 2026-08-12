"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@annotated/backend/convex/_generated/api";
import type { Id } from "@annotated/backend/convex/_generated/dataModel";
import { ClipMedia, type MediaState } from "./clip-media";

type Annotation = FunctionReturnType<typeof api.annotations.getById>;

/**
 * The landing page is server-rendered — a one-shot fetch that never re-renders.
 * When a clip is still slicing at that fetch, its "this page updates itself
 * when it's ready" notice was a lie: nothing re-rendered it. This wraps
 * ClipMedia with a live subscription so that promise is true, but ONLY while
 * the clip needs it — a clip that's already ready must not open a socket just
 * to watch a row that can no longer change.
 */
export function ClipMediaLive({
  annotationId,
  mediaState: initialMediaState,
  clipUrl: initialClipUrl,
  sourceType,
  captionsUrl,
  className,
  bare,
}: {
  annotationId: string;
  mediaState: MediaState;
  clipUrl: string | null;
  sourceType: "youtube" | "podcast" | "article";
  captionsUrl?: string;
  className?: string;
  bare?: boolean;
}) {
  const isProcessing = initialMediaState === "processing";
  const live: Annotation | undefined = useQuery(
    api.annotations.getById,
    isProcessing ? { annotationId: annotationId as Id<"annotations"> } : "skip"
  );

  return (
    <ClipMedia
      mediaState={live ? live.mediaState : initialMediaState}
      clipUrl={live ? live.clipUrl : initialClipUrl}
      sourceType={sourceType}
      captionsUrl={captionsUrl}
      className={className}
      bare={bare}
    />
  );
}
