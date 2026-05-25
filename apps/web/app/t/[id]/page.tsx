import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { ClaimButton } from "../../a/[id]/claim-button";
import { VoteButtons } from "../../_components/vote-buttons";
import { FollowButton } from "../../_components/follow-button";
import { Comments } from "../../_components/comments";
import { ClipArticle } from "../../_components/clip-article";

interface ThreadClip {
  _id: string;
  selectedText?: string;
  commentaryText?: string;
  commentaryAudioUrl?: string | null;
  commentaryAudioTranscript?: string;
  clipStartMs?: number;
  clipEndMs?: number;
  clipUrl: string | null;
  likeCount: number;
  downCount: number;
  threadOrder?: number;
}

interface ThreadView {
  _id: string;
  title: string | null;
  source: {
    canonicalUrl: string;
    title: string;
    type: string;
    siteName?: string;
    author?: string;
  } | null;
  author: { id: string; username: string; displayName: string } | null;
  clips: ThreadClip[];
}

const getWithClips = makeFunctionReference<
  "query",
  { threadId: string },
  ThreadView | null
>("threads:getWithClips");

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

async function fetchThread(id: string): Promise<ThreadView | null> {
  if (!convexUrl) {
    throw new Error("Missing NEXT_PUBLIC_CONVEX_URL");
  }
  try {
    const client = new ConvexHttpClient(convexUrl);
    return await client.query(getWithClips, { threadId: id });
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const thread = await fetchThread(id);
  if (!thread) return { title: "Not found — Annotated" };
  const title = thread.source?.title ?? "Thread";
  return {
    title: `${title} — ${thread.clips.length} clips — Annotated`,
    description: `A ${thread.clips.length}-clip thread on Annotated.`,
  };
}

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const thread = await fetchThread(id);
  if (!thread) notFound();

  return (
    <main className="flex min-h-screen flex-col items-center bg-[#f4f1e8] px-4 py-10 text-[#111]">
      <div className="w-full max-w-2xl">
        <header className="mb-6 flex items-center justify-between">
          <span className="text-lg font-black uppercase tracking-tight">Annotated</span>
          <span className="border-2 border-[#111] bg-[#ffe600] px-2 py-0.5 text-xs font-bold uppercase">
            🧵 {thread.clips.length} clips
          </span>
        </header>

        {thread.source && (
          <div className="mb-6 border-[3px] border-[#111] bg-white p-5 shadow-[8px_8px_0_0_#111]">
            <p className="text-xs font-bold uppercase tracking-widest text-[#555]">
              Thread{thread.source.siteName ? ` · ${thread.source.siteName}` : ""}
            </p>
            <p className="mt-1 text-xl font-black leading-tight">
              {thread.source.title}
            </p>
            <div className="mt-3 flex items-center gap-3">
              {thread.author && (
                <span className="text-sm font-bold uppercase tracking-wide text-[#555]">
                  — {thread.author.displayName}
                </span>
              )}
              {thread.author && <FollowButton targetUserId={thread.author.id} />}
            </div>
            <a
              href={thread.source.canonicalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block border-2 border-[#111] bg-white px-3 py-1.5 text-sm font-bold underline decoration-2 hover:bg-[#ffe600]"
            >
              View original ↗
            </a>
          </div>
        )}

        <ol className="flex flex-col gap-10">
          {thread.clips.map((clip, index) => (
            <li
              key={clip._id}
              id={`clip-${clip.threadOrder ?? index}`}
              className="scroll-mt-6"
            >
              <p className="mb-2 font-mono text-xs font-bold uppercase tracking-widest text-[#555]">
                Clip {index + 1} / {thread.clips.length}
              </p>
              <ClipArticle
                data={{
                  selectedText: clip.selectedText,
                  commentaryText: clip.commentaryText,
                  commentaryAudioUrl: clip.commentaryAudioUrl,
                  commentaryAudioTranscript: clip.commentaryAudioTranscript,
                  clipStartMs: clip.clipStartMs,
                  clipEndMs: clip.clipEndMs,
                  clipUrl: clip.clipUrl,
                  sourceType: thread.source?.type,
                }}
              />
              <div className="mt-4 flex items-center gap-3">
                <VoteButtons
                  annotationId={clip._id}
                  upCount={clip.likeCount}
                  downCount={clip.downCount}
                />
              </div>
              <Comments annotationId={clip._id} />
              <div className="mt-4">
                <ClaimButton annotationId={clip._id} />
              </div>
            </li>
          ))}
        </ol>

        <footer className="mt-10 text-center font-mono text-xs text-[#555]">
          annotated.com
        </footer>
      </div>
    </main>
  );
}
