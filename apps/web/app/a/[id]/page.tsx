import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { ClaimButton } from "./claim-button";
import { VoteButtons } from "../../_components/vote-buttons";
import { FollowButton } from "../../_components/follow-button";
import { Comments } from "../../_components/comments";
import { ClipArticle } from "../../_components/clip-article";

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

  // A threaded clip lives on its thread page; deep-link to its position.
  if (annotation.threadId) {
    redirect(`/t/${annotation.threadId}#clip-${annotation.threadOrder ?? 0}`);
  }

  return (
    <main className="flex min-h-screen flex-col items-center bg-[#f4f1e8] px-4 py-10 text-[#111]">
      <div className="w-full max-w-2xl">
        <header className="mb-6 flex items-center justify-between">
          <span className="text-lg font-black uppercase tracking-tight">Annotated</span>
          <span className="border-2 border-[#111] px-2 py-0.5 text-xs font-bold uppercase">
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

        <footer className="mt-8 text-center font-mono text-xs text-[#555]">
          annotated.com
        </footer>
      </div>
    </main>
  );
}
