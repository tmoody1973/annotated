import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import type { TranscriptWord } from "@annotated/shared";
import { transcribePodcast } from "../lib/worker-client";
import { TranscriptCanvas } from "./transcript-canvas";
import { monoStack, muted } from "../lib/clip-styles";

interface TranscriptRow {
  status: "pending" | "processing" | "ready" | "failed";
  words: TranscriptWord[];
}

const getTranscriptBySource = makeFunctionReference<
  "query",
  { sourceId: string },
  TranscriptRow | null
>("transcripts:getBySource");

const note = { fontFamily: monoStack, fontSize: 12, color: muted, margin: "10px 0 0" };

/**
 * Once a podcast is resolved, ensures the episode is transcribed (one idempotent
 * worker call when no transcript exists) and subscribes to the transcript row.
 * Renders the drag-select canvas as soon as the words are ready.
 */
export function PodcastClipper({
  sourceId,
  mp3Url,
}: {
  sourceId: string;
  mp3Url: string;
}) {
  const transcript = useQuery(getTranscriptBySource, { sourceId });
  const requested = useRef<string | null>(null);
  const [triggerError, setTriggerError] = useState<string | null>(null);

  useEffect(() => {
    // Trigger transcription exactly once per source, only when none exists yet.
    if (transcript === null && requested.current !== sourceId) {
      requested.current = sourceId;
      void transcribePodcast(sourceId, mp3Url).catch((e: unknown) => {
        // If the worker rejects before writing a row, no "failed" status will
        // ever arrive — surface the error here instead of hanging forever.
        setTriggerError(e instanceof Error ? e.message : "Couldn't start transcription.");
      });
    }
  }, [transcript, sourceId, mp3Url]);

  if (triggerError) return <p style={note}>{triggerError} Reopen the sidebar to retry.</p>;
  if (transcript === undefined) return <p style={note}>Loading…</p>;
  if (transcript === null || transcript.status === "processing" || transcript.status === "pending") {
    return <p style={note}>Transcribing this episode… (~30s for a typical episode)</p>;
  }
  if (transcript.status === "failed") {
    return <p style={note}>Transcription failed — try reopening the sidebar.</p>;
  }

  return <TranscriptCanvas sourceId={sourceId} mp3Url={mp3Url} words={transcript.words} />;
}
