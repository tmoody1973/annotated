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
    <main className="flex min-h-screen flex-col items-center bg-[color:var(--calm-paper)] px-4 py-10 text-[color:var(--calm-ink)]">
      <JsonLd data={jsonLd} />
      <div className="w-full max-w-2xl">
        <header className="mb-6 flex items-center justify-between">
          <span className="text-lg font-semibold tracking-tight">Annotated</span>
          <span className="rounded-full border border-[color:var(--calm-accent)] bg-[color:var(--calm-accent-tint)] px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[color:var(--calm-accent)]">
            🧵 {thread.clips.length} clips
          </span>
        </header>

        {thread.source && (
          <div className="mb-6 rounded-[10px] border border-[color:var(--calm-hair)] bg-[color:var(--calm-panel)] p-5 shadow-[0_1px_2px_rgba(27,26,23,0.06),0_22px_48px_-28px_rgba(27,26,23,0.22)]">
            <p className="text-[11px] font-medium uppercase tracking-widest text-[color:var(--calm-ink-3)]">
              Thread{thread.source.siteName ? ` · ${thread.source.siteName}` : ""}
            </p>
            <p className="mt-1 font-serif text-2xl font-medium leading-tight text-[color:var(--calm-ink)]">
              {thread.source.title}
            </p>
            <div className="mt-3 flex items-center gap-3">
              {thread.author && (
                <span className="text-sm font-medium uppercase tracking-wide text-[color:var(--calm-ink-2)]">
                  — {thread.author.displayName}
                </span>
              )}
              {thread.author && <FollowButton targetUserId={thread.author.id} />}
            </div>
            <a
              href={thread.source.canonicalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 rounded-[7px] border border-[color:var(--calm-hair)] bg-[color:var(--calm-panel)] px-3 py-1.5 text-sm font-medium text-[color:var(--calm-accent)] hover:bg-[color:var(--calm-surface)]"
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
              <p className="mb-2 font-mono text-[11px] font-medium uppercase tracking-widest text-[color:var(--calm-ink-3)]">
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

        <footer className="mt-10 text-center font-mono text-xs text-[color:var(--calm-ink-3)]">
          annotated.com
        </footer>
      </div>
    </main>
  );
}
