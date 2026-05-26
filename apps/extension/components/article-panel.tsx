import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { makeFunctionReference } from "convex/server";
import {
  selectArticleHighlight,
  MAX_QUOTE_WORDS,
  type ArticleHighlight,
} from "@annotated/shared";
import type { ArticleDetection } from "../lib/use-active-tab-article";
import {
  extractArticle,
  getWebUrl,
  getWorkerToken,
  transcodeCommentary,
  type ExtractedArticle,
} from "../lib/worker-client";
import {
  accent,
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
import {
  captureVisibleArticle,
  generateUploadUrlRef,
  uploadToConvexStorage,
} from "../lib/screenshot";
import { CommentaryComposer } from "./commentary-composer";
import { AnonymousToggle } from "./anonymous-toggle";
import { useThread } from "../lib/use-thread";

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
    screenshotStorageId?: string;
    isAnonymous?: boolean;
    threadId?: string;
    workerToken: string;
  },
  string
>("testing:publishArticleClipDev");

const label = {
  fontFamily: sansStack,
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
  const generateUploadUrl = useMutation(generateUploadUrlRef);
  const thread = useThread();
  const textRef = useRef<HTMLDivElement | null>(null);
  const publishing = useRef(false);

  const [article, setArticle] = useState<ExtractedArticle | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<ArticleHighlight | null>(null);
  const [take, setTake] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [status, setStatus] = useState<"idle" | "publishing" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [publishedId, setPublishedId] = useState<string | null>(null);

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

  /**
   * Captures the source page and uploads it to Convex storage, returning its
   * storageId. Best-effort: any failure (capture blocked, upload error) resolves
   * to undefined so a missing screenshot never blocks publishing the clip.
   */
  const captureSourceScreenshot = async (): Promise<string | undefined> => {
    try {
      const blob = await captureVisibleArticle();
      if (!blob) return undefined;
      const uploadUrl = await generateUploadUrl({ workerToken: getWorkerToken() });
      return await uploadToConvexStorage(uploadUrl, blob);
    } catch {
      return undefined;
    }
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
      const screenshotStorageId = await captureSourceScreenshot();
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
        ...(screenshotStorageId ? { screenshotStorageId } : {}),
        isAnonymous,
        threadId: thread.threadId ?? undefined,
        workerToken: getWorkerToken(),
      });
      setPublishedId(annotationId);
      setLink(`${getWebUrl()}/a/${annotationId}`);
      setStatus("idle");
    } catch (e) {
      publishing.current = false;
      setStatus("error");
      setError(e instanceof Error ? e.message : "Publish failed");
    }
  };

  const addAnotherToThread = (): void => {
    if (!publishedId) return;
    void thread.continueThread(publishedId).then(() => {
      // Return to the same extracted article; drop the last highlight + take so
      // the next clip starts fresh, keeping the thread + source.
      setHighlight(null);
      setTake("");
      setAudioBlob(null);
      setIsAnonymous(false);
      setLink(null);
      setPublishedId(null);
      setStatus("idle");
      publishing.current = false;
    });
  };

  if (link) {
    return (
      <section style={{ marginBottom: 18 }}>
        <p style={{ fontSize: 13, color: valid, fontWeight: 600, margin: 0 }}>Published.</p>
        <a
          className="ann-link"
          href={link}
          target="_blank"
          rel="noreferrer"
          style={{ display: "inline-block", marginTop: 4 }}
        >
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
          fontFamily: serifStack,
          fontSize: 18,
          fontWeight: 600,
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

      <div style={{ ...label, marginTop: 8 }}>
        Highlight a sentence to clip it · up to ~{MAX_QUOTE_WORDS} words (fair use)
      </div>
      <div
        ref={textRef}
        className="ann-article-text"
        onMouseUp={onSelect}
        style={{
          marginTop: 8,
          maxHeight: 240,
          overflowY: "auto",
          border: `1px solid ${hair}`,
          borderRadius: 7,
          background: panel,
          padding: 12,
          lineHeight: 1.6,
          fontSize: 14,
          whiteSpace: "pre-wrap",
          userSelect: "text",
        }}
      >
        {article.textContent}
      </div>

      {highlight && (
        <>
          <p
            className="ann-quote"
            style={{
              fontFamily: serifStack,
              fontSize: 17,
              lineHeight: 1.45,
              borderLeft: `2px solid ${accent}`,
              paddingLeft: 10,
              margin: "10px 0 0",
            }}
          >
            “{highlight.selectedText}”
          </p>
          {highlight.clamped && (
            <p
              style={{
                fontFamily: monoStack,
                fontSize: 11,
                color: muted,
                margin: "4px 0 0",
              }}
            >
              Clipped to ~{MAX_QUOTE_WORDS} words (fair use)
            </p>
          )}
        </>
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
        <p style={{ color: danger, fontSize: 12, margin: "6px 0 0" }}>{error}</p>
      )}

      <button
        className="ann-publish ann-press"
        disabled={!canPublish}
        onClick={() => void onPublish()}
        style={{ marginTop: 10 }}
      >
        {status === "publishing" ? "Publishing…" : "Publish highlight"}
      </button>
    </section>
  );
}
