import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import type { TranscriptWord } from "@annotated/shared";
import { transcribePodcast } from "../lib/worker-client";
import { TranscriptCanvas } from "./transcript-canvas";
import { ProgressIndicator } from "./progress-indicator";
import { monoStack, muted } from "../lib/clip-styles";

/** Honest estimate for a typical episode's Deepgram sync transcription. */
const TRANSCRIBE_ESTIMATE_MS = 30_000;

interface TranscriptRow {
  status: "pending" | "processing" | "ready" | "failed";
  // Words as a JSON string (new rows; bypasses Convex's 8192-array cap) or the
  // legacy inline array (pre-existing short rows). Parsed client-side.
  wordsJson?: string;
  words?: TranscriptWord[];
  /** The episode audio frozen in Convex storage — clips cut from this match the
   *  transcript timeline (no ad drift). Absent on older / fallback transcripts. */
  episodeStorageId?: string;
  /** Convex server timestamp the row was created — when transcription began. */
  _creationTime: number;
}

/** Parses the transcript's words from the JSON string, falling back to the
 *  legacy inline array. Empty on malformed JSON rather than throwing. */
function parseWords(row: TranscriptRow): TranscriptWord[] {
  if (row.wordsJson) {
    try {
      return JSON.parse(row.wordsJson) as TranscriptWord[];
    } catch {
      return [];
    }
  }
  return row.words ?? [];
}

const getTranscriptBySource = makeFunctionReference<
  "query",
  { sourceId: string },
  TranscriptRow | null
>("transcripts:getBySource");

const getStorageUrl = makeFunctionReference<
  "query",
  { storageId: string },
  string | null
>("files:getUrl");

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
  // Resolve the frozen episode's URL so clips cut from the same bytes that were
  // transcribed (no ad drift). Skips until the row carries an episodeStorageId.
  const episodeStorageId =
    transcript?.status === "ready" ? transcript.episodeStorageId : undefined;
  const frozenUrl = useQuery(
    getStorageUrl,
    episodeStorageId ? { storageId: episodeStorageId } : "skip"
  );
  const requested = useRef<string | null>(null);
  // Local fallback start time for the brief window after we trigger transcription
  // but before the worker has inserted the row (which carries the real start).
  const localStartedAt = useRef<number | null>(null);
  const [triggerError, setTriggerError] = useState<string | null>(null);

  useEffect(() => {
    // Trigger transcription exactly once per source, only when none exists yet.
    if (transcript === null && requested.current !== sourceId) {
      requested.current = sourceId;
      localStartedAt.current = Date.now();
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
    return (
      <ProgressIndicator
        label="Transcribing this episode…"
        estimateMs={TRANSCRIBE_ESTIMATE_MS}
        startedAt={
          transcript?._creationTime ?? (localStartedAt.current ??= Date.now())
        }
      />
    );
  }
  if (transcript.status === "failed") {
    return <p style={note}>Transcription failed — try reopening the sidebar.</p>;
  }

  return (
    <TranscriptCanvas
      sourceId={sourceId}
      mp3Url={mp3Url}
      clipUrl={frozenUrl ?? undefined}
      words={parseWords(transcript)}
    />
  );
}
