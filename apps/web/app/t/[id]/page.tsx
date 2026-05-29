import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { slugId, splitSlugId } from "@annotated/shared";
import { ClaimButton } from "../../a/[id]/claim-button";
import { VoteButtons } from "../../_components/vote-buttons";
import { FollowButton } from "../../_components/follow-button";
import { Comments } from "../../_components/comments";
import { ClipArticle } from "../../_components/clip-article";
import { JsonLd } from "../../_components/json-ld";
import { absoluteUrl, threadPath } from "../../_lib/urls";

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
    imageUrl?: string | null;
    youtubeThumbnailUrl?: string | null;
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
  const { id: param } = await params;
  const { id } = splitSlugId(param);
  const thread = await fetchThread(id);
  if (!thread) return { title: "Not found — Annotated" };
  const sourceTitle = thread.source?.title ?? "Thread";
  const title = `${sourceTitle} — ${thread.clips.length} clips — Annotated`;
  const description = `A ${thread.clips.length}-clip thread on Annotated.`;
  const canonical = absoluteUrl(
    threadPath(thread.title ?? sourceTitle, thread._id)
  );
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "article" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: param } = await params;
  const { id } = splitSlugId(param);
  const thread = await fetchThread(id);
  if (!thread) notFound();

  // Canonicalize the URL: redirect any non-canonical slug to /t/[slug]-[id].
  const canonicalParam = slugId(thread.title ?? thread.source?.title ?? "thread", thread._id);
  if (param !== canonicalParam) {
    permanentRedirect(threadPath(thread.title ?? thread.source?.title ?? "thread", thread._id));
  }

  // Structured data: a thread is a collection citing one source.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    url: absoluteUrl(`/t/${canonicalParam}`),
    headline: thread.title ?? thread.source?.title ?? "Thread",
    ...(thread.author
      ? { author: { "@type": "Person", name: thread.author.displayName } }
      : {}),
    ...(thread.source
      ? {
          citation: {
            "@type": "CreativeWork",
            name: thread.source.title,
            url: thread.source.canonicalUrl,
          },
        }
      : {}),
    hasPart: thread.clips.map((clip) => ({
      "@type": "CreativeWork",
      text: clip.commentaryText ?? clip.selectedText ?? "",
    })),
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
            🧵 {thread.clips.length} clips
          </span>
        </header>

        {thread.source && (
          <div className="mb-6 border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] p-5 text-[color:var(--b-ink)] shadow-[8px_8px_0_0_var(--b-shadow)]">
            {(thread.source.imageUrl ?? thread.source.youtubeThumbnailUrl) && (
              // eslint-disable-next-line @next/next/no-img-element -- source og:image, not a static asset
              <img
                src={thread.source.imageUrl ?? thread.source.youtubeThumbnailUrl ?? undefined}
                alt="Source page visual"
                className="-mx-5 -mt-5 mb-4 block max-h-[260px] w-[calc(100%+2.5rem)] max-w-none border-b-[3px] border-[color:var(--b-line)] object-cover object-top"
              />
            )}
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--b-dim)]">
              Thread{thread.source.siteName ? ` · ${thread.source.siteName}` : ""}
            </p>
            <p className="mt-1 text-[26px] font-extrabold leading-[1.08] tracking-[-0.01em]">
              {thread.source.title}
            </p>
            <div className="mt-3 flex items-center gap-3">
              {thread.author && (
                <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--b-dim)]">
                  — {thread.author.displayName}
                </span>
              )}
              {thread.author && <FollowButton targetUserId={thread.author.id} />}
            </div>
            <a
              href={thread.source.canonicalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 border-2 border-[color:var(--b-line)] bg-[color:var(--b-acid)] px-3 py-1.5 text-sm font-black uppercase tracking-wide text-[color:var(--b-acid-ink)]"
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
              <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--b-dim-onbg)]">
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

        <footer className="mt-10 text-center font-mono text-xs text-[color:var(--b-dim-onbg)]">
          annotated.com
        </footer>
      </div>
    </main>
  );
}
