/**
 * Screen 2. One shell, three bodies — the shell owns the fair-use line and the
 * one way forward; the body owns whatever "choose the evidence" means for this
 * kind of source.
 */
import { evaluateClipSpan, type ArticleHighlight, type Chapter } from "@annotated/shared";
import type { DetectedSource } from "../../lib/use-detected-source";
import type { Span } from "../../lib/scrubber";
import type { Draft } from "../../lib/use-panel-flow";
import { seedTakeFromChapter } from "../../lib/chapter-seed";
import { ChapterList } from "./chapter-list";
import { ClipBodyYoutube } from "./clip-body-youtube";
import { ClipBodyArticle } from "./clip-body-article";
import { ClipBodyPodcast } from "./clip-body-podcast";

interface ClipScreenProps {
  detected: DetectedSource;
  draft: Draft;
  onSpanChange: (span: Span) => void;
  onHighlight: (highlight: ArticleHighlight | null) => void;
  onPodcastSelection: (quote: string, startMs: number, endMs: number, sourceId: string) => void;
  onTakeText: (text: string) => void;
  onNext: () => void;
}

export function ClipScreen({
  detected,
  draft,
  onSpanChange,
  onHighlight,
  onPodcastSelection,
  onTakeText,
  onNext,
}: ClipScreenProps) {
  // Picking a chapter sets the clip and titles the take. Re-picking keeps the
  // title in step, but text the user actually wrote is never clobbered.
  function selectChapter(chapter: Chapter, startMs: number, endMs: number): void {
    onSpanChange({ startMs, endMs });
    const seeded = seedTakeFromChapter(draft.takeText, chapter.title);
    if (seeded !== null) onTakeText(seeded);
  }

  const highlight: ArticleHighlight | null =
    draft.selectedText !== null && draft.textRange !== null
      ? {
          selectedText: draft.selectedText,
          textStart: draft.textRange.start,
          textEnd: draft.textRange.end,
          valid: true,
          clamped: false,
        }
      : null;

  return (
    <>
      {detected.kind === "youtube" && draft.spanMs ? (
        <>
          <ChapterList videoId={detected.videoId} onSelect={selectChapter} />
          <ClipBodyYoutube span={draft.spanMs} onChange={onSpanChange} />
        </>
      ) : detected.kind === "article" ? (
        <ClipBodyArticle
          detection={detected.article}
          highlight={highlight}
          onChange={onHighlight}
        />
      ) : detected.kind === "podcast" && detected.podcast.kind !== "spotify" ? (
        <ClipBodyPodcast
          podcast={detected.podcast}
          onSelection={onPodcastSelection}
          onWriteTakeFirst={onNext}
        />
      ) : null}

      <button
        type="button"
        className="ann-publish ann-press"
        style={{ marginTop: 16 }}
        disabled={!isReady(detected, draft)}
        onClick={onNext}
      >
        Next — your take
      </button>
      <p className="ann-dim" style={{ fontSize: 12, margin: "10px 0 0" }}>
        Up to 90 seconds · fair use
      </p>
    </>
  );
}

function isReady(detected: DetectedSource, draft: Draft): boolean {
  if (detected.kind === "article") return (draft.selectedText?.trim().length ?? 0) > 0;
  if (detected.kind === "podcast") {
    return (draft.selectedText?.trim().length ?? 0) > 0 && draft.spanMs !== null;
  }
  if (!draft.spanMs) return false;
  return evaluateClipSpan(draft.spanMs.startMs, draft.spanMs.endMs).ok;
}
