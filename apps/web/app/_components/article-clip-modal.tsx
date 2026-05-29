"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { makeFunctionReference } from "convex/server";
import { useAction, useMutation } from "convex/react";
import {
  selectArticleHighlight,
  extractYoutubeVideoId,
  parsePodcastUrl,
  slugId,
  type ArticleHighlight,
} from "@annotated/shared";
import { TopicPicker } from "./topic-picker";

interface Extracted {
  title: string;
  textContent: string;
  byline: string | null;
  siteName: string | null;
  imageUrl: string | null;
}

type CreateArticleArgs = {
  canonicalUrl: string;
  title: string;
  siteName?: string;
  author?: string;
  sourceImageUrl?: string;
  selectedText: string;
  textStart: number;
  textEnd: number;
  commentaryText?: string;
  topicIds: string[];
};

const extractArticleRef = makeFunctionReference<"action", { url: string }, Extracted>(
  "articles:extractArticle"
);
const createArticleRef = makeFunctionReference<"mutation", CreateArticleArgs, string>(
  "annotations:createArticle"
);

/** Reads the current text selection's char offsets within the pre-wrap article
 *  container (offsets map 1:1 to textContent because it's a single text node). */
function readSelectionOffsets(container: HTMLElement): { a: number; b: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return null;
  const pre = range.cloneRange();
  pre.selectNodeContents(container);
  pre.setEnd(range.startContainer, range.startOffset);
  const a = pre.toString().length;
  const b = a + range.toString().length;
  return { a, b };
}

export function ArticleClipModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const extract = useAction(extractArticleRef);
  const publish = useMutation(createArticleRef);

  const [url, setUrl] = useState("");
  const [article, setArticle] = useState<(Extracted & { url: string }) | null>(null);
  const [highlight, setHighlight] = useState<ArticleHighlight | null>(null);
  const [commentary, setCommentary] = useState("");
  const [topicIds, setTopicIds] = useState<string[]>([]);
  const [status, setStatus] = useState<"url" | "extracting" | "compose" | "publishing">("url");
  const [error, setError] = useState<string | null>(null);

  async function handleExtract() {
    setError(null);
    const trimmed = url.trim();
    if (extractYoutubeVideoId(trimmed) || parsePodcastUrl(trimmed)) {
      setError("YouTube and podcasts are clipped in the extension. Paste an article URL here.");
      return;
    }
    setStatus("extracting");
    try {
      const result = await extract({ url: trimmed });
      setArticle({ ...result, url: trimmed });
      setStatus("compose");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extraction failed");
      setStatus("url");
    }
  }

  function onSelect(container: HTMLElement) {
    if (!article) return;
    const offsets = readSelectionOffsets(container);
    if (!offsets) return;
    setHighlight(selectArticleHighlight(article.textContent, offsets.a, offsets.b));
  }

  const canPublish =
    !!article && !!highlight?.valid && commentary.trim().length > 0 && topicIds.length > 0;

  async function handlePublish() {
    if (!article || !highlight) return;
    setStatus("publishing");
    setError(null);
    try {
      const id = await publish({
        canonicalUrl: article.url,
        title: article.title,
        siteName: article.siteName ?? undefined,
        author: article.byline ?? undefined,
        sourceImageUrl: article.imageUrl ?? undefined,
        selectedText: highlight.selectedText,
        textStart: highlight.textStart,
        textEnd: highlight.textEnd,
        commentaryText: commentary.trim(),
        topicIds,
      });
      router.push(`/a/${slugId(article.title, id)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed");
      setStatus("compose");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] text-[color:var(--b-ink)] shadow-[8px_8px_0_0_var(--b-shadow)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b-[3px] border-[color:var(--b-line)] bg-[color:var(--b-chrome)] px-4 py-3 text-[color:var(--b-card)]">
          <span className="font-display text-lg tracking-tight">NEW CLIP</span>
          <button onClick={onClose} aria-label="Close" className="text-xl font-black">×</button>
        </div>

        <div className="p-4">
          {error && (
            <p className="mb-3 border-2 border-[color:var(--b-line)] bg-[#ffecec] px-3 py-2 text-[13px] font-bold text-[#9a0000]">
              {error}
            </p>
          )}

          {status === "url" || status === "extracting" ? (
            <div className="flex flex-col gap-3">
              <label className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--b-dim)]">
                Paste an article URL
              </label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                className="border-[3px] border-[color:var(--b-line)] px-3 py-2 font-mono text-sm"
              />
              <button
                onClick={handleExtract}
                disabled={status === "extracting" || url.trim().length === 0}
                className="border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-acid)] px-4 py-2 font-black uppercase tracking-wide text-[color:var(--b-acid-ink)] shadow-[4px_4px_0_0_var(--b-shadow)] disabled:opacity-50"
              >
                {status === "extracting" ? "Reading…" : "Read article →"}
              </button>
            </div>
          ) : article ? (
            <div className="flex flex-col gap-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--b-dim)]">
                  {article.siteName ?? "Article"} — highlight a passage
                </p>
                <h3 className="text-lg font-extrabold leading-tight">{article.title}</h3>
              </div>
              <div
                onMouseUp={(e) => onSelect(e.currentTarget)}
                className="max-h-[40vh] overflow-y-auto border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-bg)] p-3 text-[14px] leading-relaxed"
                style={{ whiteSpace: "pre-wrap" }}
              >
                {article.textContent}
              </div>
              {highlight?.selectedText && (
                <blockquote className="border-l-[5px] border-[color:var(--b-acid)] pl-3 text-[15px] font-semibold">
                  &ldquo;{highlight.selectedText}&rdquo;
                  {highlight.clamped && (
                    <span className="ml-1 font-mono text-[11px] text-[color:var(--b-dim)]">(trimmed to 100 words)</span>
                  )}
                </blockquote>
              )}
              <textarea
                value={commentary}
                onChange={(e) => setCommentary(e.target.value)}
                placeholder="Add your take…"
                rows={3}
                className="border-[3px] border-[color:var(--b-line)] px-3 py-2 text-sm"
              />
              <TopicPicker selected={topicIds} onChange={setTopicIds} />
              <button
                onClick={handlePublish}
                disabled={!canPublish || status === "publishing"}
                className="border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-acid)] px-4 py-2 font-black uppercase tracking-wide text-[color:var(--b-acid-ink)] shadow-[4px_4px_0_0_var(--b-shadow)] disabled:opacity-50"
              >
                {status === "publishing" ? "Publishing…" : "Publish clip"}
              </button>
              {!canPublish && (
                <p className="font-mono text-[11px] text-[color:var(--b-dim)]">
                  Highlight a passage, add a take, and pick at least one topic.
                </p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
