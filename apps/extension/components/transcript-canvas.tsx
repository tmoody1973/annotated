import { useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { makeFunctionReference } from "convex/server";
import {
  selectClipSpan,
  formatClipTimestamp,
  type TranscriptWord,
} from "@annotated/shared";
import {
  clipAudio,
  getWorkerToken,
  getWebUrl,
  transcodeCommentary,
} from "../lib/worker-client";
import { accent, ink, monoStack, muted } from "../lib/clip-styles";
import { CommentaryComposer } from "./commentary-composer";
import { AnonymousToggle } from "./anonymous-toggle";
import { useThread } from "../lib/use-thread";

const publishPodcastClip = makeFunctionReference<
  "mutation",
  {
    sourceId: string;
    clipStorageId: string;
    clipStartMs: number;
    clipEndMs: number;
    selectedText: string;
    commentaryText?: string;
    commentaryAudioStorageId?: string;
    commentaryAudioTranscript?: string;
    isAnonymous?: boolean;
    threadId?: string;
    workerToken: string;
  },
  string
>("testing:publishPodcastClipDev");

interface SpeakerSegment {
  speaker: string | undefined;
  words: { word: TranscriptWord; index: number }[];
}

/** Groups consecutive words by speaker so the transcript reads as a dialogue. */
function groupBySpeaker(words: TranscriptWord[]): SpeakerSegment[] {
  const segments: SpeakerSegment[] = [];
  words.forEach((word, index) => {
    const last = segments[segments.length - 1];
    if (last && last.speaker === word.speaker) {
      last.words.push({ word, index });
    } else {
      segments.push({ speaker: word.speaker, words: [{ word, index }] });
    }
  });
  return segments;
}

/**
 * The transcript-as-canvas: tap a word to anchor, tap another to complete the
 * span. The selection auto-fills the verbatim quote (never machine-authored)
 * and drives the audio clip. The user's take is the product; publishing cuts the
 * audio span on the worker and writes the annotation.
 */
export function TranscriptCanvas({
  sourceId,
  mp3Url,
  words,
}: {
  sourceId: string;
  mp3Url: string;
  words: TranscriptWord[];
}) {
  const publish = useMutation(publishPodcastClip);
  const thread = useThread();
  const [anchor, setAnchor] = useState<number | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [take, setTake] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [status, setStatus] = useState<"idle" | "publishing" | "error">("idle");
  // The current step of a publish, so the button names what's happening: cutting
  // the audio on the worker (~2s) vs. writing the annotation. No bar — too fast.
  const [phase, setPhase] = useState<"slicing" | "saving" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [publishedId, setPublishedId] = useState<string | null>(null);
  // Synchronous re-entrancy lock — React state alone can't prevent a double-click
  // from firing two publishes (and creating two clips) before the re-render.
  const publishing = useRef(false);

  const segments = useMemo(() => groupBySpeaker(words), [words]);

  const selection =
    anchor !== null && focus !== null
      ? selectClipSpan(words, anchor, focus)
      : null;
  const lo = anchor !== null && focus !== null ? Math.min(anchor, focus) : null;
  const hi = anchor !== null && focus !== null ? Math.max(anchor, focus) : null;

  const onWord = (index: number): void => {
    if (anchor === null || focus !== null) {
      setAnchor(index);
      setFocus(null);
    } else {
      setFocus(index);
    }
  };

  const isSelected = (index: number): boolean =>
    (lo !== null && hi !== null && index >= lo && index <= hi) || anchor === index;

  const canPublish =
    selection !== null &&
    selection.withinCap &&
    (take.trim().length > 0 || audioBlob !== null) &&
    status !== "publishing";

  const onPublish = async (): Promise<void> => {
    if (!selection || publishing.current) return;
    publishing.current = true;
    setStatus("publishing");
    setPhase("slicing");
    setError(null);
    try {
      const clipStorageId = await clipAudio(
        mp3Url,
        selection.clipStartMs,
        selection.clipEndMs
      );
      const commentaryAudio = audioBlob
        ? await transcodeCommentary(audioBlob)
        : null;
      setPhase("saving");
      const annotationId = await publish({
        sourceId,
        clipStorageId,
        clipStartMs: selection.clipStartMs,
        clipEndMs: selection.clipEndMs,
        selectedText: selection.quote,
        commentaryText: take.trim(),
        commentaryAudioStorageId: commentaryAudio?.storageId,
        commentaryAudioTranscript: commentaryAudio?.transcript ?? undefined,
        isAnonymous,
        threadId: thread.threadId ?? undefined,
        workerToken: getWorkerToken(),
      });
      setPublishedId(annotationId);
      setLink(`${getWebUrl()}/a/${annotationId}`);
      setStatus("idle");
      setPhase(null);
    } catch (e) {
      publishing.current = false;
      setStatus("error");
      setPhase(null);
      setError(e instanceof Error ? e.message : "Publish failed");
    }
  };

  const addAnotherToThread = (): void => {
    if (!publishedId) return;
    void thread.continueThread(publishedId).then(() => {
      // Return to the canvas on the same episode; keep words/source, drop the
      // last selection + take so the next clip starts fresh.
      setAnchor(null);
      setFocus(null);
      setTake("");
      setAudioBlob(null);
      setLink(null);
      setPublishedId(null);
      setStatus("idle");
      publishing.current = false;
    });
  };

  if (link) {
    return (
      <section style={{ marginTop: 14 }}>
        <p style={{ fontFamily: monoStack, fontSize: 12, color: muted }}>Published.</p>
        <a className="ann-view-link" href={link} target="_blank" rel="noreferrer"
           style={{ fontFamily: monoStack, fontWeight: 800, color: ink }}>
          View annotation →
        </a>
        <button
          type="button"
          className="ann-publish"
          onClick={addAnotherToThread}
          style={{
            marginTop: 12,
            width: "100%",
            padding: "10px 0",
            fontFamily: monoStack,
            fontWeight: 800,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            background: ink,
            color: "#fff",
            border: "none",
            cursor: "pointer",
          }}
        >
          + Add another clip to this thread
        </button>
      </section>
    );
  }

  const labelStyle = {
    fontFamily: monoStack,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    color: muted,
  };

  return (
    <section style={{ marginTop: 14 }}>
      <div style={labelStyle}>
        Tap a word, then another, to clip the span · up to 90s (fair use)
      </div>

      <div
        className="ann-transcript"
        style={{
          marginTop: 8,
          maxHeight: 260,
          overflowY: "auto",
          border: `2px solid ${ink}`,
          padding: 10,
          lineHeight: 1.7,
          fontSize: 14,
        }}
      >
        {segments.map((seg, si) => (
          <p key={si} style={{ margin: "0 0 10px" }}>
            {seg.speaker !== undefined && (
              <span style={{ ...labelStyle, display: "block", color: accent }}>
                Speaker {seg.speaker}
              </span>
            )}
            {seg.words.map(({ word, index }) => (
              <span
                key={index}
                className="ann-word"
                data-index={index}
                onClick={() => onWord(index)}
                style={{
                  cursor: "pointer",
                  background: isSelected(index) ? accent : "transparent",
                  padding: "0 1px",
                }}
              >
                {word.word}{" "}
              </span>
            ))}
          </p>
        ))}
      </div>

      {selection && (
        <div style={{ marginTop: 10 }}>
          <div style={labelStyle}>
            Span {formatClipTimestamp(selection.clipStartMs)}–
            {formatClipTimestamp(selection.clipEndMs)}
            {!selection.withinCap && (
              <span style={{ color: "#c00" }}> · over 90s — shorten</span>
            )}
          </div>
          <p
            className="ann-quote"
            style={{
              fontFamily: monoStack,
              fontSize: 13,
              borderLeft: `3px solid ${accent}`,
              paddingLeft: 8,
              margin: "6px 0 0",
            }}
          >
            “{selection.quote}”
          </p>
        </div>
      )}

      <div style={{ marginTop: 10 }}>
        <CommentaryComposer
          text={take}
          onTextChange={setTake}
          onAudioChange={setAudioBlob}
          disabled={status === "publishing"}
        />
      </div>

      <AnonymousToggle
        checked={isAnonymous}
        onChange={setIsAnonymous}
        disabled={status === "publishing"}
      />

      {error && (
        <p style={{ color: "#c00", fontSize: 12, margin: "6px 0 0" }}>{error}</p>
      )}

      <button
        className="ann-publish"
        disabled={!canPublish}
        onClick={() => void onPublish()}
        style={{
          marginTop: 10,
          width: "100%",
          padding: "10px 0",
          fontFamily: monoStack,
          fontWeight: 800,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          background: canPublish ? ink : muted,
          color: "#fff",
          border: "none",
          cursor: canPublish ? "pointer" : "not-allowed",
        }}
      >
        {status === "publishing"
          ? phase === "slicing"
            ? "Slicing clip… (~2s)"
            : "Saving annotation…"
          : "Publish clip"}
      </button>
    </section>
  );
}
