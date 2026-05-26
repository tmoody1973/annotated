import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { slugId, splitSlugId } from "@annotated/shared";
import { ClaimButton } from "./claim-button";
import { VoteButtons } from "../../_components/vote-buttons";
import { FollowButton } from "../../_components/follow-button";
import { Comments } from "../../_components/comments";
import { ClipArticle } from "../../_components/clip-article";
import { JsonLd } from "../../_components/json-ld";
import { absoluteUrl, clipPath, threadPath } from "../../_lib/urls";

interface AnnotationView {
  _id: string;
  commentaryText?: string;
  commentaryAudioUrl?: string | null;
  commentaryAudioTranscript?: string;
  selectedText?: string;
  clipStartMs?: number;
  clipEndMs?: number;
  clipUrl: string | null;
  screenshotUrl?: string | null;
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
  } | null;
  author: { id: string; username: string; displayName: string } | null;
}

const getById = makeFunctionReference<
  "query",
  { annotationId: string },
  AnnotationView | null
>("annotations:getById");

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

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
    <main className="flex min-h-screen flex-col items-center bg-[color:var(--calm-paper)] px-4 py-10 text-[color:var(--calm-ink)]">
      <JsonLd data={jsonLd} />
      <div className="w-full max-w-2xl">
        <header className="mb-6 flex items-center justify-between">
          <span className="text-lg font-semibold tracking-tight">Annotated</span>
          <span className="rounded-full border border-[color:var(--calm-hair)] px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[color:var(--calm-ink-3)]">
            Clip
          </span>
        </header>

        <ClipArticle
          data={{
            selectedText: annotation.selectedText,
            commentaryText: annotation.commentaryText,
            commentaryAudioUrl: annotation.commentaryAudioUrl,
            commentaryAudioTranscript: annotation.commentaryAudioTranscript,
            clipStartMs: annotation.clipStartMs,
            clipEndMs: annotation.clipEndMs,
            clipUrl: annotation.clipUrl,
            screenshotUrl: annotation.screenshotUrl,
            sourceType: annotation.source?.type,
            authorName: annotation.author?.displayName,
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

        <footer className="mt-8 text-center font-mono text-xs text-[color:var(--calm-ink-3)]">
          annotated.com
        </footer>
      </div>
    </main>
  );
}
