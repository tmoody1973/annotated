import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { selectArticleHighlight, type ArticleHighlight } from "@annotated/shared";
import type { ArticleDetection } from "../lib/use-active-tab-article";
import {
  extractArticle,
  getWebUrl,
  getWorkerToken,
  transcodeCommentary,
  type ExtractedArticle,
} from "../lib/worker-client";
import { accent, ink, monoStack, muted } from "../lib/clip-styles";
import { CommentaryComposer } from "./commentary-composer";

const publishArticleClip = makeFunctionReference<
  "mutation",
  {
    canonicalUrl: string;
    title: string;
    siteName?: string;
    author?: string;
    selectedText: string;
    textStart: number;
    textEnd: number;
    commentaryText?: string;
    commentaryAudioStorageId?: string;
    commentaryAudioTranscript?: string;
    workerToken: string;
  },
  string
>("testing:publishArticleClipDev");

const label = {
  fontFamily: monoStack,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase" as const,
  color: muted,
};

/**
 * Maps the current text selection to character offsets within the rendered
 * article container. The container holds the cleaned text as a single pre-wrap
 * block, so the pre-range length is the exact start offset — offsets line up
 * with the text the worker returned, never the live page DOM.
 */
function readSelectionOffsets(
  container: HTMLElement
): { start: number; end: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return null;
  const pre = range.cloneRange();
  pre.selectNodeContents(container);
  pre.setEnd(range.startContainer, range.startOffset);
  const start = pre.toString().length;
  const end = start + range.toString().length;
  return { start, end };
}

/**
 * The article path: extract the clean text on the worker, let the user highlight
 * a span of prose (their "clip" is the quote, not a media file), add a take, and
 * publish to a source-linked landing page. No transcription, no ffmpeg.
 */
export function ArticlePanel({ detection }: { detection: ArticleDetection }) {
  const publish = useMutation(publishArticleClip);
  const textRef = useRef<HTMLDivElement | null>(null);
  const publishing = useRef(false);

  const [article, setArticle] = useState<ExtractedArticle | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<ArticleHighlight | null>(null);
  const [take, setTake] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [status, setStatus] = useState<"idle" | "publishing" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setArticle(null);
    setExtractError(null);
    setHighlight(null);
    extractArticle(detection.url, detection.html)
      .then((res) => {
        if (!cancelled) setArticle(res);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setExtractError(
            e instanceof Error ? e.message : "Couldn't extract this article."
          );
        }
      });
    return () => {
      cancelled = true;
    };
    // Re-extract only when the article URL changes — not when the same page's
    // outerHTML churns (ads, lazy nodes) on a tab re-activation, which would
    // otherwise wipe an in-progress highlight and the user's take.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detection.url]);

  const onSelect = (): void => {
    const container = textRef.current;
    if (!container || !article) return;
    const offsets = readSelectionOffsets(container);
    if (!offsets) return;
    const next = selectArticleHighlight(
      article.textContent,
      offsets.start,
      offsets.end
    );
    setHighlight(next.valid ? next : null);
  };

  const canPublish =
    highlight !== null &&
    highlight.valid &&
    (take.trim().length > 0 || audioBlob !== null) &&
    status !== "publishing";

  const onPublish = async (): Promise<void> => {
    if (!highlight || !article || publishing.current) return;
    publishing.current = true;
    setStatus("publishing");
    setError(null);
    try {
      const commentaryAudio = audioBlob
        ? await transcodeCommentary(audioBlob)
        : null;
      const annotationId = await publish({
        canonicalUrl: detection.url,
        title: article.title || detection.title,
        ...(article.siteName ? { siteName: article.siteName } : {}),
        ...(article.byline ? { author: article.byline } : {}),
        selectedText: highlight.selectedText,
        textStart: highlight.textStart,
        textEnd: highlight.textEnd,
        commentaryText: take.trim(),
        commentaryAudioStorageId: commentaryAudio?.storageId,
        commentaryAudioTranscript: commentaryAudio?.transcript ?? undefined,
        workerToken: getWorkerToken(),
      });
      setLink(`${getWebUrl()}/a/${annotationId}`);
      setStatus("idle");
    } catch (e) {
      publishing.current = false;
      setStatus("error");
      setError(e instanceof Error ? e.message : "Publish failed");
    }
  };

  if (link) {
    return (
      <section style={{ marginBottom: 18 }}>
        <p style={{ fontFamily: monoStack, fontSize: 12, color: muted }}>Published.</p>
        <a
          className="ann-view-link"
          href={link}
          target="_blank"
          rel="noreferrer"
          style={{ fontFamily: monoStack, fontWeight: 800, color: ink }}
        >
          View annotation →
        </a>
      </section>
    );
  }

  if (extractError) {
    return (
      <section style={{ marginBottom: 18 }}>
        <div style={label}>📰 Article detected</div>
        <p style={{ fontSize: 14, color: ink, margin: "8px 0 0", lineHeight: 1.4 }}>
          {extractError}
        </p>
      </section>
    );
  }

  if (article === null) {
    return (
      <section style={{ marginBottom: 18 }}>
        <div style={label}>📰 Article detected</div>
        <p style={{ fontSize: 14, color: muted, margin: "8px 0 0" }}>
          Extracting article…
        </p>
      </section>
    );
  }

  return (
    <section style={{ marginBottom: 18 }}>
      <div style={label}>📰 Article detected</div>
      <h2
        style={{
          fontFamily: monoStack,
          fontSize: 16,
          fontWeight: 800,
          color: ink,
          margin: "8px 0 4px",
          lineHeight: 1.3,
        }}
      >
        {article.title}
      </h2>
      {article.siteName && (
        <p style={{ fontSize: 13, color: muted, margin: "0 0 8px" }}>
          {article.siteName}
        </p>
      )}

      <div style={{ ...label, marginTop: 8 }}>Highlight a sentence to clip it</div>
      <div
        ref={textRef}
        className="ann-article-text"
        onMouseUp={onSelect}
        style={{
          marginTop: 8,
          maxHeight: 240,
          overflowY: "auto",
          border: `2px solid ${ink}`,
          padding: 10,
          lineHeight: 1.6,
          fontSize: 14,
          whiteSpace: "pre-wrap",
          userSelect: "text",
        }}
      >
        {article.textContent}
      </div>

      {highlight && (
        <p
          className="ann-quote"
          style={{
            fontFamily: monoStack,
            fontSize: 13,
            borderLeft: `3px solid ${accent}`,
            paddingLeft: 8,
            margin: "10px 0 0",
          }}
        >
          “{highlight.selectedText}”
        </p>
      )}

      <div style={{ marginTop: 10 }}>
        <CommentaryComposer
          text={take}
          onTextChange={setTake}
          onAudioChange={setAudioBlob}
          disabled={status === "publishing"}
        />
      </div>

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
        {status === "publishing" ? "Publishing…" : "Publish highlight"}
      </button>
    </section>
  );
}
