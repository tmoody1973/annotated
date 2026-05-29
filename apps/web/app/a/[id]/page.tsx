import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { slugId, splitSlugId, sliceTranscriptToSpan } from "@annotated/shared";
import { ClaimButton } from "./claim-button";
import { SaveImageDialog } from "./save-image-dialog";
import { VoteButtons } from "../../_components/vote-buttons";
import { FollowButton } from "../../_components/follow-button";
import { Comments } from "../../_components/comments";
import { ClipArticle } from "../../_components/clip-article";
import { AppShell } from "../../_components/app-shell";
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
    podcastName?: string | null;
    youtubeChannelUrl?: string | null;
  } | null;
  author: { id: string; username: string; displayName: string; avatarUrl?: string | null } | null;
}

const getById = makeFunctionReference<
  "query",
  { annotationId: string },
  AnnotationView | null
>("annotations:getById");

const getTranscriptBySource = makeFunctionReference<
  "query",
  { sourceId: string },
  { wordsJson?: string; words?: { word: string; startMs: number; endMs: number }[] } | null
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
    if (!row) return undefined;
    // New transcripts store wordsJson (bypasses Convex's 8192-array cap); older
    // rows used the `words` array. Support both so podcast + legacy clips work.
    type TranscriptWord = { word: string; startMs: number; endMs: number };
    const words: TranscriptWord[] = row.wordsJson
      ? (JSON.parse(row.wordsJson) as TranscriptWord[])
      : (row.words ?? []);
    if (words.length === 0) return undefined;
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

  // YouTube clips show the spoken transcript for the clip window: the clip is
  // selected by playback time, so the VTT (video-relative, no ad-insertion
  // drift) is the only place that text surfaces. Podcasts are intentionally NOT
  // re-sliced here — their quote is already the transcript words the user
  // dragged in the sidebar, and the episode transcript can drift from the cut
  // audio. An accurate podcast clip transcript needs Deepgram on the clipped mp3.
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
    <AppShell narrow>
      <JsonLd data={jsonLd} />
      <ClipArticle
          data={{
            selectedText: annotation.selectedText,
            commentaryText: annotation.commentaryText,
            commentaryAudioUrl: annotation.commentaryAudioUrl,
            commentaryAudioTranscript: annotation.commentaryAudioTranscript,
            clipTranscript,
            captionsUrl:
              annotation.source?.type === "youtube" && clipTranscript
                ? `/a/${canonicalParam}/captions`
                : undefined,
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
          <SaveImageDialog slug={canonicalParam} />
        </div>

        <Comments annotationId={annotation._id} />

        <div className="mt-6">
          <ClaimButton annotationId={annotation._id} />
        </div>

        <footer className="mt-8 text-center font-mono text-xs text-[color:var(--b-dim-onbg)]">
          annotated.com
        </footer>
    </AppShell>
  );
}
