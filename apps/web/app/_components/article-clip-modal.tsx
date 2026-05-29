"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { makeFunctionReference } from "convex/server";
import { useAction, useMutation } from "convex/react";
import {
  selectArticleHighlight,
  extractYoutubeVideoId,
  parsePodcastUrl,
  slugId,
  type ArticleHighlight,
  type BrowserKind,
} from "@annotated/shared";
import { TopicPicker } from "./topic-picker";
import { ExtensionCta } from "./extension-cta";
import { useBrowserInfo } from "../_lib/use-browser-info";
import { markManualPublish } from "../_lib/extension-nudge";

const BROWSER_NAMES: Record<BrowserKind, string> = {
  chrome: "Chrome",
  edge: "Edge",
  firefox: "Firefox",
  brave: "Brave",
  safari: "Safari",
  other: "your browser",
};

/** Keeps focus inside the dialog, closes on Esc, and restores focus to the
 *  invoking control on unmount (WCAG modal requirements). */
function useDialogA11y(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = () =>
      ref.current?.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'
      );
    focusables()?.[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (!items || items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);
  return ref;
}

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

  const browser = useBrowserInfo();
  const dialogRef = useDialogA11y(onClose);

  // The content script (once shipped) marks the document; until then this stays
  // false and the install upsell always shows for supported desktop browsers.
  const [extensionInstalled, setExtensionInstalled] = useState(false);
  useEffect(() => {
    if (document.documentElement.getAttribute("data-annotated-extension") === "1") {
      setExtensionInstalled(true);
    }
  }, []);

  // Upsell only where the extension is actually installable and not already on.
  const showUpsell = browser.supported && !extensionInstalled;

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
      markManualPublish();
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
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-clip-title"
        className="w-full max-w-2xl border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] text-[color:var(--b-ink)] shadow-[8px_8px_0_0_var(--b-shadow)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b-[3px] border-[color:var(--b-line)] bg-[color:var(--b-chrome)] px-4 py-3 text-[color:var(--b-card)]">
          <span id="new-clip-title" className="font-display text-lg tracking-tight">NEW CLIP</span>
          <button onClick={onClose} aria-label="Close" className="text-xl font-black">×</button>
        </div>

        <div className="p-4">
          {error && (
            <p className="mb-3 border-2 border-[color:var(--b-line)] bg-[#ffecec] px-3 py-2 text-[13px] font-bold text-[#9a0000]">
              {error}
            </p>
          )}

          {status === "url" || status === "extracting" ? (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="font-display text-xl tracking-tight">Clip from anywhere.</h2>
                <p className="mt-1 font-mono text-[12px] text-[color:var(--b-dim)]">
                  Grab a passage, add your take, publish the receipt — with the source linked.
                </p>
              </div>

              {showUpsell && (
                <div className="border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-acid)] text-[color:var(--b-acid-ink)] shadow-[5px_5px_0_0_var(--b-shadow)]">
                  <div className="flex items-center justify-between border-b-2 border-[color:var(--b-line)] px-3 py-1.5">
                    <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em]">
                      ★ Easiest way
                    </span>
                    <span className="font-mono text-[10px]">~10s install</span>
                  </div>
                  <div className="flex items-center gap-3 p-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-[color:var(--b-line)] bg-[color:var(--b-card)] font-display text-xl text-[color:var(--b-ink)]">
                      ⊕
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-base leading-tight">
                        Annotated for {BROWSER_NAMES[browser.kind]}
                      </p>
                      <p className="font-mono text-[11px]">Clip straight from any page — no copy-paste.</p>
                    </div>
                    <ExtensionCta
                      href={browser.storeUrl}
                      ariaLabel={browser.label}
                      className="shrink-0 border-2 border-[color:var(--b-line)] bg-[color:var(--b-chrome)] px-3 py-2 font-mono text-[12px] font-bold uppercase tracking-wide text-[color:var(--b-acid)]"
                    >
                      {browser.label}
                    </ExtensionCta>
                  </div>
                </div>
              )}

              {showUpsell && (
                <div className="flex items-center gap-3">
                  <span className="h-px flex-1 bg-[color:var(--b-line)]" />
                  <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--b-dim)]">
                    Or do it manually
                  </span>
                  <span className="h-px flex-1 bg-[color:var(--b-line)]" />
                </div>
              )}

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
