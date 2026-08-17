/**
 * A video's own chapters, as clip presets.
 *
 * The hardest part of clipping an hour-long video is not the drag — it is
 * knowing where to drag. When the uploader has already marked the segments,
 * that work is done and the panel should hand it over rather than make the
 * user scrub for it.
 *
 * Lost in the four-screen rewrite (the composer this lived in was deleted
 * whole), restored here. The parser, the Convex action and the client call
 * all survived with no caller.
 */
import { useEffect, useState } from "react";
import { formatClipTimestamp, MAX_CLIP_MS, type Chapter } from "@annotated/shared";
import { fetchYoutubeChapters } from "../../lib/worker-client";

/** How tall the list may grow before it scrolls — long videos have dozens. */
const MAX_HEIGHT = 168;

export function ChapterList({
  videoId,
  onSelect,
}: {
  videoId: string;
  /** Receives the chapter's span, already capped to the fair-use limit. */
  onSelect: (chapter: Chapter, startMs: number, endMs: number) => void;
}) {
  const [chapters, setChapters] = useState<Chapter[]>([]);

  useEffect(() => {
    let active = true;
    // Clear first so a previous video's chapters never linger against a new one.
    setChapters([]);
    fetchYoutubeChapters(videoId)
      .then((result) => {
        if (active) setChapters(result);
      })
      .catch(() => {
        // Chapters are an enhancement; a lookup failure must not block clipping.
        if (active) setChapters([]);
      });
    return () => {
      active = false;
    };
  }, [videoId]);

  if (chapters.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
      <span
        className="ann-dim"
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        Chapters · tap to set the clip
      </span>
      <div
        style={{
          border: "2px solid var(--b-line)",
          background: "var(--b-card)",
          maxHeight: MAX_HEIGHT,
          overflowY: "auto",
        }}
      >
        {chapters.map((chapter, index) => (
          <button
            key={`${chapter.startMs}-${index}`}
            type="button"
            className="ann-press"
            onClick={() =>
              onSelect(
                chapter,
                chapter.startMs,
                Math.min(chapter.endMs, chapter.startMs + MAX_CLIP_MS)
              )
            }
            style={{
              display: "flex",
              width: "100%",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 10,
              padding: "9px 11px",
              border: "none",
              borderTop: index === 0 ? "none" : "1px solid var(--b-line)",
              background: "transparent",
              color: "var(--b-ink)",
              font: "inherit",
              fontSize: 13,
              fontWeight: 600,
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <span>{chapter.title}</span>
            <span className="ann-mono ann-dim" style={{ fontSize: 12, flexShrink: 0 }}>
              {formatClipTimestamp(chapter.startMs)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
