/**
 * The transcript drag — the interaction the product is built around, given the
 * whole panel.
 *
 * Two things this screen owes the user. First, drag across the words and the
 * audio span comes with them; tap and keyboard do the same job for anyone a
 * drag doesn't serve. Second, when the transcript isn't ready, an honest
 * estimate and something to do inside the wait — a dead spinner on a 48-minute
 * episode is the podcast path's biggest threat to the 90-second target.
 */
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import {
  formatClipTimestamp,
  selectClipSpan,
  decodeWords,
  type TranscriptWord,
} from "@annotated/shared";
import {
  EMPTY_SELECTION,
  isWordSelected,
  selectionReducer,
  transcribeEstimateMs,
  formatSpanDuration,
} from "../../lib/transcript-drag";
import { transcribePodcast } from "../../lib/worker-client";
import type { PodcastDetection } from "../../lib/use-active-tab-podcast";
import { ProgressIndicator } from "../progress-indicator";
import { TranscriptWords } from "./transcript-words";
import { Retry, Waiting } from "./transcript-states";
import { resolveArgs, type ResolveArgs, type ResolveResult } from "../../lib/podcast-resolve";

interface TranscriptRow {
  status: "pending" | "processing" | "ready" | "failed";
  wordsJson?: string;
  words?: TranscriptWord[];
  episodeDurationMs?: number;
  _creationTime: number;
}

const resolvePodcastRef = makeFunctionReference<"action", ResolveArgs, ResolveResult>(
  "podcasts:resolvePodcast",
);

const getTranscriptBySource = makeFunctionReference<
  "query",
  { sourceId: string },
  TranscriptRow | null
>("transcripts:getBySource");

/** Words arrive as JSON (Convex caps arrays at 8192); older rows are inline. */
function parseWords(row: TranscriptRow): TranscriptWord[] {
  if (row.wordsJson) return decodeWords(row.wordsJson);
  return row.words ?? [];
}

interface ClipBodyPodcastProps {
  podcast: Exclude<PodcastDetection, { kind: "spotify" }>;
  onSelection: (quote: string, clipStartMs: number, clipEndMs: number, sourceId: string) => void;
  onWriteTakeFirst: () => void;
}

export function ClipBodyPodcast({
  podcast,
  onSelection,
  onWriteTakeFirst,
}: ClipBodyPodcastProps) {
  const resolve = useAction(resolvePodcastRef);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setSourceId(null);
    setProblem(null);
    resolve(resolveArgs(podcast))
      .then((result) => {
        if (cancelled) return;
        if (result.status === "resolved") setSourceId(result.sourceId);
        else setProblem(result.reason);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setProblem(cause instanceof Error ? cause.message : "Couldn't open this episode.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [podcast.canonicalUrl, attempt]);

  if (problem) return <Retry message={problem} onRetry={() => setAttempt((n) => n + 1)} />;
  if (sourceId === null) return <Waiting label="Finding this episode…" estimateMs={6_000} />;

  return (
    <Transcript
      sourceId={sourceId}
      onSelection={onSelection}
      onWriteTakeFirst={onWriteTakeFirst}
    />
  );
}

function Transcript({
  sourceId,
  onSelection,
  onWriteTakeFirst,
}: {
  sourceId: string;
  onSelection: (quote: string, clipStartMs: number, clipEndMs: number, sourceId: string) => void;
  onWriteTakeFirst: () => void;
}) {
  const row = useQuery(getTranscriptBySource, { sourceId });
  const requested = useRef<string | null>(null);
  const startedLocallyAt = useRef<number | null>(null);
  const [triggerError, setTriggerError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [selection, dispatch] = useReducer(selectionReducer, EMPTY_SELECTION);

  useEffect(() => {
    const key = `${sourceId}:${attempt}`;
    if (row === null && requested.current !== key) {
      requested.current = key;
      startedLocallyAt.current = Date.now();
      void transcribePodcast(sourceId).catch((cause: unknown) => {
        // A worker that rejects before writing a row means no "failed" status
        // will ever arrive — say so here rather than waiting forever.
        setTriggerError(
          cause instanceof Error ? cause.message : "Couldn't start transcribing this episode.",
        );
      });
    }
  }, [row, sourceId, attempt]);

  const words = useMemo(() => (row?.status === "ready" ? parseWords(row) : []), [row]);

  // Report the span up as it changes, so Next reflects the current selection.
  const span =
    selection.anchor !== null && selection.focus !== null && words.length > 0
      ? selectClipSpan(words, selection.anchor, selection.focus)
      : null;

  useEffect(() => {
    if (span && span.withinCap) {
      onSelection(span.quote, span.clipStartMs, span.clipEndMs, sourceId);
    }
  }, [span?.quote, span?.clipStartMs, span?.clipEndMs, span?.withinCap, sourceId]);

  const retry = (): void => {
    setTriggerError(null);
    setAttempt((n) => n + 1);
  };

  if (triggerError) return <Retry message={triggerError} onRetry={retry} />;
  if (row === undefined) return <Waiting label="Opening the transcript…" estimateMs={4_000} />;
  if (row?.status === "failed") {
    return <Retry message="Transcribing this episode didn't finish." onRetry={retry} />;
  }
  if (row === null || row.status === "pending" || row.status === "processing") {
    return (
      <>
        <Waiting
          label="Transcribing this episode…"
          estimateMs={transcribeEstimateMs(row?.episodeDurationMs ?? null)}
          startedAt={row?._creationTime ?? (startedLocallyAt.current ??= Date.now())}
        />
        <button
          type="button"
          className="ann-link"
          style={{ marginTop: 14 }}
          onClick={onWriteTakeFirst}
        >
          Write the take first →
        </button>
      </>
    );
  }

  return (
    <section>
      <TranscriptWords
        words={words}
        isSelected={(index) => isWordSelected(selection, index)}
        dispatch={dispatch}
      />
      <p className="ann-dim ann-mono" aria-live="polite" style={{ fontSize: 12, margin: "10px 0 0" }}>
        {span
          ? `${formatClipTimestamp(span.clipStartMs)}–${formatClipTimestamp(span.clipEndMs)} · ${formatSpanDuration(span.durationMs)}${span.withinCap ? "" : " — longer than 90s, shorten it"}`
          : "Drag across the words you want · up to 90 seconds"}
      </p>
    </section>
  );
}
