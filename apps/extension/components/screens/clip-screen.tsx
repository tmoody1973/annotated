/**
 * Screen 2. One shell, three bodies — the shell owns the fair-use line and the
 * one way forward; the body owns whatever "choose the evidence" means for this
 * kind of source.
 */
import { evaluateClipSpan, type ArticleHighlight } from "@annotated/shared";
import type { DetectedSource } from "../../lib/use-detected-source";
import type { Span } from "../../lib/scrubber";
import type { Draft } from "../../lib/use-panel-flow";
import { ClipBodyYoutube } from "./clip-body-youtube";
import { ClipBodyArticle } from "./clip-body-article";

interface ClipScreenProps {
  detected: DetectedSource;
  draft: Draft;
  onSpanChange: (span: Span) => void;
  onHighlight: (highlight: ArticleHighlight | null) => void;
  onNext: () => void;
}

export function ClipScreen({
  detected,
  draft,
  onSpanChange,
  onHighlight,
  onNext,
}: ClipScreenProps) {
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
        <ClipBodyYoutube span={draft.spanMs} onChange={onSpanChange} />
      ) : detected.kind === "article" ? (
        <ClipBodyArticle
          detection={detected.article}
          highlight={highlight}
          onChange={onHighlight}
        />
      ) : (
        <p className="ann-dim" style={{ fontSize: 14 }}>
          The transcript view lands in the next commit.
        </p>
      )}

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
  if (!draft.spanMs) return false;
  return evaluateClipSpan(draft.spanMs.startMs, draft.spanMs.endMs).ok;
}
