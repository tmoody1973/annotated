import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { formatClipTimestamp } from "@annotated/shared";
import { ClaimButton } from "./claim-button";
import { VoteButtons } from "../../_components/vote-buttons";
import { FollowButton } from "../../_components/follow-button";
import { Comments } from "../../_components/comments";

interface AnnotationView {
  _id: string;
  commentaryText?: string;
  commentaryAudioUrl?: string | null;
  commentaryAudioTranscript?: string;
  selectedText?: string;
  clipStartMs?: number;
  clipEndMs?: number;
  clipUrl: string | null;
  likeCount: number;
  downCount: number;
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
  const { id } = await params;
  const annotation = await fetchAnnotation(id);
  if (!annotation) return { title: "Not found — Annotated" };
  return {
    title: `${annotation.source?.title ?? "Clip"} — Annotated`,
    description: annotation.commentaryText ?? "A clip annotated on Annotated.",
  };
}

export default async function AnnotationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const annotation = await fetchAnnotation(id);
  if (!annotation) notFound();

  const range =
    annotation.clipStartMs != null && annotation.clipEndMs != null
      ? `${formatClipTimestamp(annotation.clipStartMs)}–${formatClipTimestamp(annotation.clipEndMs)}`
      : null;

  const isPodcast = annotation.source?.type === "podcast";
  const isArticle = annotation.source?.type === "article";

  return (
    <main className="flex min-h-screen flex-col items-center bg-[#f4f1e8] px-4 py-10 text-[#111]">
      <div className="w-full max-w-2xl">
        <header className="mb-6 flex items-center justify-between">
          <span className="text-lg font-black uppercase tracking-tight">Annotated</span>
          <span className="border-2 border-[#111] px-2 py-0.5 text-xs font-bold uppercase">
            Clip
          </span>
        </header>

        <article className="border-[3px] border-[#111] bg-white shadow-[8px_8px_0_0_#111]">
          {!isArticle && (
            <div className="border-b-[3px] border-[#111] bg-black">
              {!annotation.clipUrl ? (
                <p className="p-8 text-center font-mono text-sm text-white">
                  clip unavailable
                </p>
              ) : isPodcast ? (
                <audio controls src={annotation.clipUrl} className="block w-full p-4" />
              ) : (
                <video
                  controls
                  src={annotation.clipUrl}
                  className="block max-h-[60vh] w-full"
                />
              )}
            </div>
          )}

          <div className="p-5 sm:p-6">
            {isArticle && (
              <span className="inline-block border-2 border-[#111] bg-[#ffe600] px-2 py-1 font-mono text-xs font-bold uppercase tracking-widest">
                Highlight
              </span>
            )}

            {range && !isArticle && (
              <span className="inline-block border-2 border-[#111] bg-[#ffe600] px-2 py-1 font-mono text-sm font-bold">
                {range}
              </span>
            )}

            {annotation.selectedText &&
              (isArticle ? (
                <blockquote className="mt-4 border-l-[6px] border-[#ffe600] pl-5 text-2xl font-bold leading-snug text-[#111]">
                  “{annotation.selectedText}”
                </blockquote>
              ) : (
                <blockquote className="mt-4 border-l-[6px] border-[#ffe600] pl-4 font-mono text-sm leading-relaxed text-[#333]">
                  “{annotation.selectedText}”
                </blockquote>
              ))}

            {annotation.commentaryText && (
              <p className="mt-4 border-l-[6px] border-[#111] pl-4 text-lg leading-relaxed">
                {annotation.commentaryText}
              </p>
            )}

            {annotation.commentaryAudioUrl && (
              <div className="mt-4 border-l-[6px] border-[#ff5c00] pl-4">
                <p className="mb-2 font-mono text-xs font-bold uppercase tracking-widest text-[#555]">
                  Voice commentary
                </p>
                <audio
                  controls
                  src={annotation.commentaryAudioUrl}
                  className="w-full"
                />
                {annotation.commentaryAudioTranscript && (
                  <p className="mt-2 text-sm italic leading-relaxed text-[#333]">
                    “{annotation.commentaryAudioTranscript}”
                  </p>
                )}
              </div>
            )}

            {annotation.author && (
              <p className="mt-3 text-sm font-bold uppercase tracking-wide text-[#555]">
                — {annotation.author.displayName}
              </p>
            )}

            {annotation.source && (
              <div className="mt-6 border-t-[3px] border-[#111] pt-4">
                <p className="text-xs font-bold uppercase tracking-widest text-[#555]">
                  Clipped from{annotation.source.siteName ? ` · ${annotation.source.siteName}` : ""}
                </p>
                <p className="mt-1 font-bold">{annotation.source.title}</p>
                <a
                  href={annotation.source.canonicalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block border-2 border-[#111] bg-white px-3 py-1.5 text-sm font-bold underline decoration-2 hover:bg-[#ffe600]"
                >
                  View original ↗
                </a>
              </div>
            )}
          </div>
        </article>

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

        <footer className="mt-8 text-center font-mono text-xs text-[#555]">
          annotated.com
        </footer>
      </div>
    </main>
  );
}
