import { useMemo, useRef, useState } from "react";
import {
  selectClipSpan,
  formatClipTimestamp,
  type TranscriptWord,
} from "@annotated/shared";
import {
  clipAudio,
  getWebUrl,
  transcodeCommentary,
} from "../lib/worker-client";
import { publishPodcastAuthed, NotSignedInError } from "../lib/convex-publish";
import {
  accent,
  accentTint,
  danger,
  hair,
  ink,
  monoStack,
  muted,
  panel,
  sansStack,
  serifStack,
  valid,
} from "../lib/clip-styles";
import { CommentaryComposer } from "./commentary-composer";
import { AnonymousToggle } from "./anonymous-toggle";
import { TopicPicker } from "./topic-picker";
import { useThread } from "../lib/use-thread";

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
  const thread = useThread();
  const [anchor, setAnchor] = useState<number | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [take, setTake] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [topicIds, setTopicIds] = useState<string[]>([]);
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
    topicIds.length > 0 &&
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
      const annotationId = await publishPodcastAuthed({
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
        topicIds,
      });
      setPublishedId(annotationId);
      setLink(`${getWebUrl()}/a/${annotationId}`);
      setStatus("idle");
      setPhase(null);
    } catch (e) {
      publishing.current = false;
      setStatus("error");
      setPhase(null);
      if (e instanceof NotSignedInError) {
        setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : "Publish failed");
      }
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
      setTopicIds([]);
      setLink(null);
      setPublishedId(null);
      setStatus("idle");
      publishing.current = false;
    });
  };

  if (link) {
    return (
      <section style={{ marginTop: 14 }}>
        <p style={{ fontSize: 13, color: valid, fontWeight: 600, margin: 0 }}>Published.</p>
        <a className="ann-link" href={link} target="_blank" rel="noreferrer"
           style={{ display: "inline-block", marginTop: 4 }}>
          View annotation →
        </a>
        <button
          type="button"
          className="ann-publish ann-press"
          onClick={addAnotherToThread}
          style={{ marginTop: 12 }}
        >
          + Add another clip to this thread
        </button>
      </section>
    );
  }

  const labelStyle = {
    fontFamily: sansStack,
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
          border: `1px solid ${hair}`,
          borderRadius: 7,
          background: panel,
          padding: 12,
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
                  background: isSelected(index) ? accentTint : "transparent",
                  boxShadow: isSelected(index)
                    ? `inset 0 -2px 0 ${accent}`
                    : "none",
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
              <span style={{ color: danger }}> · over 90s — shorten</span>
            )}
          </div>
          <p
            className="ann-quote"
            style={{
              fontFamily: serifStack,
              fontSize: 16,
              lineHeight: 1.45,
              borderLeft: `2px solid ${accent}`,
              paddingLeft: 10,
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

      <div style={{ marginTop: 10 }}>
        <TopicPicker selected={topicIds} onChange={setTopicIds} />
      </div>

      <AnonymousToggle
        checked={isAnonymous}
        onChange={setIsAnonymous}
        disabled={status === "publishing"}
      />

      {error && (
        <p style={{ color: danger, fontSize: 12, margin: "6px 0 0" }}>{error}</p>
      )}

      <button
        className="ann-publish ann-press"
        disabled={!canPublish}
        onClick={() => void onPublish()}
        style={{ marginTop: 10 }}
      >
        {status === "publishing"
          ? phase === "slicing"
            ? "Slicing clip… (~2s)"
            : "Saving annotation…"
          : "Publish clip"}
      </button>

      {topicIds.length === 0 && (
        <p style={{ marginTop: 6, fontSize: 12, color: muted }}>Pick at least one topic</p>
      )}
    </section>
  );
}
