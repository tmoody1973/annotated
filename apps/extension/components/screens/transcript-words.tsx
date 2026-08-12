/**
 * The words themselves, speaker-grouped and fillable by drag, tap or keyboard.
 *
 * Every word is a real button. That is what makes the keyboard path work
 * without a parallel implementation: Enter is just a tap, and Escape clears.
 */
import { useMemo } from "react";
import type { TranscriptWord } from "@annotated/shared";
import type { SelectionAction } from "../../lib/transcript-drag";

interface SpeakerSegment {
  speaker: string | undefined;
  words: { word: TranscriptWord; index: number }[];
}

/** Groups consecutive words by speaker so the transcript reads as a dialogue. */
function groupBySpeaker(words: TranscriptWord[]): SpeakerSegment[] {
  const segments: SpeakerSegment[] = [];
  words.forEach((word, index) => {
    const last = segments[segments.length - 1];
    if (last && last.speaker === word.speaker) last.words.push({ word, index });
    else segments.push({ speaker: word.speaker, words: [{ word, index }] });
  });
  return segments;
}

interface TranscriptWordsProps {
  words: TranscriptWord[];
  isSelected: (index: number) => boolean;
  dispatch: (action: SelectionAction) => void;
}

export function TranscriptWords({ words, isSelected, dispatch }: TranscriptWordsProps) {
  const segments = useMemo(() => groupBySpeaker(words), [words]);

  return (
    <div
      className="ann-card"
      // Releasing outside a word must still end the drag, or the selection
      // keeps following the pointer after the button is up.
      onPointerUp={() => dispatch({ type: "pointerUp" })}
      onPointerLeave={() => dispatch({ type: "pointerUp" })}
      onKeyDown={(event) => {
        if (event.key === "Escape") dispatch({ type: "clear" });
      }}
      style={{
        maxHeight: "52vh",
        overflowY: "auto",
        padding: 12,
        lineHeight: 1.7,
        fontSize: 14,
        userSelect: "none",
        touchAction: "pan-y",
      }}
    >
      {segments.map((segment, segmentIndex) => (
        <p key={segmentIndex} style={{ margin: segmentIndex === 0 ? 0 : "12px 0 0" }}>
          {segment.speaker ? (
            <span
              className="ann-dim"
              style={{
                display: "block",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 2,
              }}
            >
              Speaker {segment.speaker}
            </span>
          ) : null}
          {segment.words.map(({ word, index }) => (
            <button
              key={index}
              type="button"
              onPointerDown={(event) => {
                // Stop the browser's own text-drag, then take focus by hand —
                // preventDefault also suppresses it, and without focus inside
                // the transcript there is nothing for Escape to reach.
                event.preventDefault();
                event.currentTarget.focus();
                dispatch({ type: "pointerDown", index });
              }}
              onPointerEnter={() => dispatch({ type: "pointerEnter", index })}
              // detail === 0 means the click came from Enter or Space rather
              // than a pointer — the pointer path already handled a real click.
              onClick={(event) => {
                if (event.detail === 0) dispatch({ type: "tap", index });
              }}
              aria-pressed={isSelected(index)}
              style={{
                font: "inherit",
                border: "none",
                padding: "1px 0",
                margin: 0,
                cursor: "text",
                // A button collapses its own trailing whitespace, which ran
                // every word together; `pre` keeps the space and lets the
                // highlight run through it instead of striping word by word.
                whiteSpace: "pre",
                background: isSelected(index) ? "var(--b-acid)" : "transparent",
                color: "var(--b-ink)",
              }}
            >
              {word.word}{" "}
            </button>
          ))}
        </p>
      ))}
    </div>
  );
}
