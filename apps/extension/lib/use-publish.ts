/**
 * Publishing, once, for all three paths.
 *
 * Each of the old composers carried its own copy of this — the re-entrancy
 * lock, the audio upload, the error mapping — which is three places for the
 * same bug. The screens now hand a draft to one function.
 *
 * Publish is optimistic (Plan A): the annotation row exists in ~2s and the
 * clip is sliced afterwards, so the caller gets an id to show immediately.
 */
import { useCallback, useRef, useState } from "react";
import { getActiveVideoMeta } from "./player-time";
import { uploadTakeAudio } from "./worker-client";
import {
  NotSignedInError,
  publishArticleAuthed,
  publishPodcastAuthed,
  publishYoutubeAuthed,
} from "./convex-publish";
import type { Draft } from "./use-panel-flow";
import type { DetectedSource } from "./use-detected-source";

export interface PublishState {
  publishing: boolean;
  error: string | null;
  publish: (
    detected: DetectedSource,
    draft: Draft,
    threadId: string | null,
  ) => Promise<string | null>;
}

function describeFailure(cause: unknown): string {
  if (cause instanceof NotSignedInError) {
    return "Sign in at annotated.sh, then publish again — your take is kept.";
  }
  return cause instanceof Error ? cause.message : "Publishing didn't go through.";
}

export function usePublish(): PublishState {
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A synchronous lock: React state alone can't stop a double-click from firing
  // two publishes — and two clips — before the re-render lands.
  const inFlight = useRef(false);

  const publish = useCallback(
    async (
      detected: DetectedSource,
      draft: Draft,
      threadId: string | null,
    ): Promise<string | null> => {
      if (inFlight.current) return null;
      inFlight.current = true;
      setPublishing(true);
      setError(null);

      try {
        // A recorded take has to reach storage first: the annotation row
        // references it. A text-only take skips this entirely.
        const audio = draft.takeAudio ? await uploadTakeAudio(draft.takeAudio) : null;
        const shared = {
          takeText: draft.takeText.trim(),
          takeAudioStorageId: audio?.storageId,
          takeAudioTranscript: audio?.transcript ?? undefined,
          isAnonymous: draft.isAnonymous,
          threadId: threadId ?? undefined,
          topicIds: draft.topicIds,
        };

        if (detected.kind === "youtube" && draft.spanMs) {
          // Read the attribution at publish time, not at detection time —
          // YouTube's player data lags behind an SPA navigation.
          const meta = await getActiveVideoMeta();
          return await publishYoutubeAuthed({
            ...shared,
            videoId: detected.videoId,
            title: meta.title ?? "YouTube video",
            author: meta.channelName ?? undefined,
            channelUrl: meta.channelUrl ?? undefined,
            clipStartMs: draft.spanMs.startMs,
            clipEndMs: draft.spanMs.endMs,
          });
        }

        if (detected.kind === "podcast" && draft.sourceId && draft.spanMs && draft.selectedText) {
          return await publishPodcastAuthed({
            ...shared,
            sourceId: draft.sourceId,
            clipStartMs: draft.spanMs.startMs,
            clipEndMs: draft.spanMs.endMs,
            selectedText: draft.selectedText,
          });
        }

        if (detected.kind === "article" && draft.selectedText && draft.textRange) {
          return await publishArticleAuthed({
            ...shared,
            canonicalUrl: detected.article.url,
            title: detected.article.title,
            selectedText: draft.selectedText,
            textStart: draft.textRange.start,
            textEnd: draft.textRange.end,
          });
        }

        setError("This clip is missing something — go back and choose the evidence again.");
        return null;
      } catch (cause: unknown) {
        setError(describeFailure(cause));
        return null;
      } finally {
        inFlight.current = false;
        setPublishing(false);
      }
    },
    [],
  );

  return { publishing, error, publish };
}
