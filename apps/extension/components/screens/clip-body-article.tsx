/**
 * The article path. The "clip" is a quote, so the panel renders the cleaned
 * article text and you highlight inside it.
 *
 * Selecting in the panel rather than on the live page is deliberate and worth
 * not undoing: the container holds the extracted text as one pre-wrap block, so
 * a DOM range's length *is* the character offset the worker will see. Mirroring
 * a selection made on the page would put the live DOM between the two and the
 * offsets would drift.
 *
 * Hitting the word ceiling is not an error. The quote stops growing, a label
 * says so, and the user carries on.
 */
import { useEffect, useRef, useState } from "react";
import {
  countWords,
  MAX_QUOTE_WORDS,
  selectArticleHighlight,
  type ArticleHighlight,
} from "@annotated/shared";
import { extractArticle, type ExtractedArticle } from "../../lib/worker-client";
import { NotSignedInError } from "../../lib/convex-publish";
import { openSignIn } from "../../lib/use-auth-state";
import type { ArticleDetection } from "../../lib/use-active-tab-article";

/**
 * Maps the current selection to character offsets within the rendered article
 * container — the pre-range length is the exact start offset.
 */
function readSelectionOffsets(container: HTMLElement): { start: number; end: number } | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return null;
  const pre = range.cloneRange();
  pre.selectNodeContents(container);
  pre.setEnd(range.startContainer, range.startOffset);
  const start = pre.toString().length;
  return { start, end: start + range.toString().length };
}

interface ClipBodyArticleProps {
  detection: ArticleDetection;
  highlight: ArticleHighlight | null;
  onChange: (highlight: ArticleHighlight | null) => void;
}

export function ClipBodyArticle({ detection, highlight, onChange }: ClipBodyArticleProps) {
  const textRef = useRef<HTMLDivElement>(null);
  const [article, setArticle] = useState<ExtractedArticle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setArticle(null);
    setError(null);
    setNeedsSignIn(false);
    extractArticle(detection.url, detection.html)
      .then((result) => {
        if (!cancelled) setArticle(result);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        // Reading the article runs server-side, which means it needs an identity
        // — unlike a video or a podcast, where the clip is chosen entirely in
        // the browser. So the article path meets the sign-in wall one screen
        // earlier than the others, and has to say so rather than showing a raw
        // authentication error.
        if (cause instanceof NotSignedInError) setNeedsSignIn(true);
        else setError(cause instanceof Error ? cause.message : "Couldn't read this article.");
      });
    return () => {
      cancelled = true;
    };
    // Keyed on the URL alone: the same page's outerHTML churns as ads and lazy
    // nodes load, and re-extracting on that would wipe a highlight in progress.
  }, [detection.url]);

  const onSelect = (): void => {
    const container = textRef.current;
    if (!container || !article) return;
    const offsets = readSelectionOffsets(container);
    if (!offsets) return;
    const next = selectArticleHighlight(article.textContent, offsets.start, offsets.end);
    onChange(next.valid ? next : null);
  };

  if (needsSignIn) {
    return (
      <div>
        <p style={{ fontSize: 14, lineHeight: 1.5, margin: "0 0 12px" }}>
          Sign in to pull this article's text into the panel, then highlight the part you want.
        </p>
        <button type="button" className="ann-publish ann-press" onClick={openSignIn}>
          Sign in
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <p className="ann-dim" style={{ fontSize: 14 }}>
        {error}
      </p>
    );
  }
  if (!article) {
    return (
      <p className="ann-dim" style={{ fontSize: 14 }}>
        Reading the article…
      </p>
    );
  }

  const words = highlight ? countWords(highlight.selectedText) : 0;

  return (
    <section>
      <p style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.3, margin: "0 0 2px" }}>
        {article.title}
      </p>
      {article.siteName ? (
        <p className="ann-dim" style={{ fontSize: 12, margin: "0 0 10px" }}>
          {article.siteName}
        </p>
      ) : null}

      <div
        ref={textRef}
        className="ann-card"
        onMouseUp={onSelect}
        style={{
          maxHeight: 260,
          overflowY: "auto",
          padding: 12,
          lineHeight: 1.6,
          fontSize: 14,
          whiteSpace: "pre-wrap",
          userSelect: "text",
        }}
      >
        {article.textContent}
      </div>

      <p
        className="ann-dim ann-mono"
        aria-live="polite"
        style={{ fontSize: 12, margin: "10px 0 0" }}
      >
        {words} / ~{MAX_QUOTE_WORDS} words · fair use
        {highlight?.clamped ? ` — clipped to ~${MAX_QUOTE_WORDS} words (fair use)` : ""}
      </p>
    </section>
  );
}
