import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { slugId, splitSlugId, sliceTranscriptToSpan } from "@annotated/shared";
import { ClaimButton } from "./claim-button";
import { VoteButtons } from "../../_components/vote-buttons";
import { FollowButton } from "../../_components/follow-button";
import { Comments } from "../../_components/comments";
import { ClipArticle } from "../../_components/clip-article";
import { JsonLd } from "../../_components/json-ld";
import { absoluteUrl, clipPath, threadPath } from "../../_lib/urls";

interface AnnotationView {
  _id: string;
  sourceId: string;
  commentaryText?: string;
  commentaryAudioUrl?: string | null;
  commentaryAudioTranscript?: string;
  selectedText?: string;
  clipStartMs?: number;
  clipEndMs?: number;
  clipUrl: string | null;
  screenshotUrl?: string | null;
  isAnonymous?: boolean;
  likeCount: number;
  downCount: number;
  threadId?: string | null;
  threadOrder?: number;
  source: {
    canonicalUrl: string;
    title: string;
    type: string;
    siteName?: string;
    author?: string;
    imageUrl?: string | null;
  } | null;
  author: { id: string; username: string; displayName: string } | null;
}

const getById = makeFunctionReference<
  "query",
  { annotationId: string },
  AnnotationView | null
>("annotations:getById");

const getTranscriptBySource = makeFunctionReference<
  "query",
  { sourceId: string },
  { wordsJson?: string } | null
>("transcripts:getBySource");

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

/**
 * Builds the clip-window transcript for a YouTube clip: loads the source's
 * stored words (youtube-vtt), slices to [startMs, endMs], and joins them. Returns
 * undefined when there's no transcript yet — the accordion simply won't render.
 */
async function fetchClipTranscript(
  sourceId: string,
  startMs: number,
  endMs: number
): Promise<string | undefined> {
  if (!convexUrl) return undefined;
  try {
    const client = new ConvexHttpClient(convexUrl);
    const row = await client.query(getTranscriptBySource, { sourceId });
    if (!row?.wordsJson) return undefined;
    const words = JSON.parse(row.wordsJson) as {
      word: string;
      startMs: number;
      endMs: number;
    }[];
    const text = sliceTranscriptToSpan(words, startMs, endMs)
      .map((w) => w.word)
      .join(" ")
      .trim();
    return text.length > 0 ? text : undefined;
  } catch {
    return undefined;
  }
}

async function fetchAnnotation(id: string): Promise<AnnotationView | null> {
  if (!convexUrl) {
    throw new Error("Missing NEXT_PUBLIC_CONVEX_URL");
  }
  try {
    const client = new ConvexHttpClient(convexUrl);
    return await client.query(getById, { annotationId: id });
  } catch {
    // Malformed id (fails Convex's v.id validation) — treat as not found.
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: param } = await params;
  const { id } = splitSlugId(param);
  const annotation = await fetchAnnotation(id);
  if (!annotation) return { title: "Not found — Annotated" };
  const title = `${annotation.source?.title ?? "Clip"} — Annotated`;
  const description =
    annotation.commentaryText ??
    annotation.commentaryAudioTranscript ??
    "A clip annotated on Annotated.";
  const canonical = absoluteUrl(
    clipPath(annotation.source?.title ?? "clip", annotation._id)
  );
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "article" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function AnnotationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: param } = await params;
  const { id } = splitSlugId(param);
  const annotation = await fetchAnnotation(id);
  if (!annotation) notFound();

  // A threaded clip lives on its thread page; deep-link to its position.
  if (annotation.threadId) {
    permanentRedirect(
      `${threadPath(annotation.source?.title ?? "thread", annotation.threadId)}#clip-${annotation.threadOrder ?? 0}`
    );
  }

  // Canonicalize the URL: redirect any non-canonical slug to /a/[slug]-[id].
  const canonicalParam = slugId(annotation.source?.title ?? "clip", annotation._id);
  if (param !== canonicalParam) {
    permanentRedirect(clipPath(annotation.source?.title ?? "clip", annotation._id));
  }

  // YouTube clips show the spoken transcript for the clip window (best-effort —
  // backfilled at publish, absent if captions were unavailable or still pending).
  const clipTranscript =
    annotation.source?.type === "youtube" &&
    annotation.clipStartMs != null &&
    annotation.clipEndMs != null
      ? await fetchClipTranscript(
          annotation.sourceId,
          annotation.clipStartMs,
          annotation.clipEndMs
        )
      : undefined;

  // Structured data: the commentary is the original work; it cites the source.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    url: absoluteUrl(`/a/${canonicalParam}`),
    headline: annotation.commentaryText ?? annotation.selectedText ?? "Clip",
    ...(annotation.commentaryText ? { text: annotation.commentaryText } : {}),
    ...(annotation.author
      ? { author: { "@type": "Person", name: annotation.author.displayName } }
      : {}),
    ...(annotation.source
      ? {
          citation: {
            "@type": "CreativeWork",
            name: annotation.source.title,
            url: annotation.source.canonicalUrl,
          },
        }
      : {}),
  };

  return (
    <main className="flex min-h-screen flex-col items-center bg-[color:var(--b-bg)] px-4 py-10 text-[color:var(--b-onbg)]">
      <JsonLd data={jsonLd} />
      <div className="w-full max-w-2xl">
        <header className="mb-6 flex items-center justify-between">
          <a href="/" className="font-display text-lg leading-none tracking-tight">
            <span className="bg-[color:var(--b-acid)] px-1.5 text-[color:var(--b-acid-ink)]">A</span>NNOTATED
          </a>
          <span className="border-2 border-[color:var(--b-line)] bg-[color:var(--b-acid)] px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--b-acid-ink)]">
            Clip
          </span>
        </header>

        <ClipArticle
          data={{
            selectedText: annotation.selectedText,
            commentaryText: annotation.commentaryText,
            commentaryAudioUrl: annotation.commentaryAudioUrl,
            commentaryAudioTranscript: annotation.commentaryAudioTranscript,
            clipTranscript,
            clipStartMs: annotation.clipStartMs,
            clipEndMs: annotation.clipEndMs,
            clipUrl: annotation.clipUrl,
            screenshotUrl: annotation.screenshotUrl,
            sourceType: annotation.source?.type,
            authorName: annotation.isAnonymous
              ? "Anonymous"
              : annotation.author?.displayName,
            source: annotation.source,
          }}
        />

        <div className="mt-6 flex items-center gap-3">
          <VoteButtons
            annotationId={annotation._id}
            upCount={annotation.likeCount}
            downCount={annotation.downCount}
          />
          {annotation.author && (
            <FollowButton targetUserId={annotation.author.id} />
          )}
        </div>

        <Comments annotationId={annotation._id} />

        <div className="mt-6">
          <ClaimButton annotationId={annotation._id} />
        </div>

        <footer className="mt-8 text-center font-mono text-xs text-[color:var(--b-dim-onbg)]">
          annotated.com
        </footer>
      </div>
    </main>
  );
}
