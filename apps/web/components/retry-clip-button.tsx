"use client";

/**
 * "Try again" on a clip whose slice failed, for the person who published it.
 *
 * The page used to say "try clipping it again", which meant going back to the
 * extension and publishing a *second* annotation at a *different* URL. The
 * broken one stayed broken forever, and anyone who already had the link kept
 * seeing it. This re-slices the same row, so the URL, votes and comments all
 * survive.
 *
 * Rendered only to the author: `retrySlice` rejects anyone else server-side,
 * so a button for other viewers would be a promise the backend refuses.
 */
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@annotated/backend/convex/_generated/api";
import type { Id } from "@annotated/backend/convex/_generated/dataModel";

export function RetryClipButton({ annotationId }: { annotationId: string }) {
  // The server answers "may you retry this?" rather than handing every client
  // the author's id to compare against — an annotation can be anonymous.
  const allowed = useQuery(api.clips.canRetry, {
    annotationId: annotationId as Id<"annotations">,
  });
  const retry = useMutation(api.clips.retrySlice);
  const [state, setState] = useState<"idle" | "working" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  if (allowed !== true) return null;

  const onRetry = async (): Promise<void> => {
    setState("working");
    setMessage(null);
    try {
      const result = await retry({ annotationId: annotationId as Id<"annotations"> });
      if (!result.retried) {
        setState("error");
        setMessage(result.reason ?? "That didn't work.");
        return;
      }
      // Success needs no message: mediaState flips to "processing" and the
      // live subscription swaps this whole notice for the spinner.
    } catch (cause: unknown) {
      setState("error");
      setMessage(cause instanceof Error ? cause.message : "That didn't work.");
    }
  };

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => void onRetry()}
        disabled={state === "working"}
        className="border-2 border-[color:var(--b-acid)] bg-transparent px-4 py-2 text-[12px] font-extrabold uppercase tracking-[0.1em] text-[color:var(--b-acid)] disabled:opacity-60"
      >
        {state === "working" ? "Rebuilding…" : "Try again"}
      </button>
      {message ? (
        <p role="alert" className="mt-2 text-[13px] text-[color:var(--b-dim-onbg)]">
          {message}
        </p>
      ) : null}
    </div>
  );
}
