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
import type { MediaState } from "../../../components/clip-media";

interface AnnotationView {
  _id: string;
  sourceId: string;
  removed?: boolean;
  takeText?: string;
  takeAudioUrl?: string | null;
  takeAudioTranscript?: string;
  selectedText?: string;
  clipStartMs?: number;
  clipEndMs?: number;
  clipUrl: string | null;
  mediaState?: MediaState;
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
  // A removed clip keeps its URL but stops being a page worth indexing or
  // unfurling: the take it described is gone.
  if (annotation.removed) {
    return {
      title: "Removed clip — Annotated",
      description: "This clip was removed by the person who published it.",
      robots: { index: false, follow: false },
    };
  }
  const title = `${annotation.source?.title ?? "Clip"} — Annotated`;
  const description =
    annotation.takeText ??
    annotation.takeAudioTranscript ??
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

const tombstoneLabel =
  "font-mono text-[11px] font-bold uppercase tracking-[0.14em]";

/**
 * What a removed clip resolves to.
 *
 * Removal is soft precisely so a pasted link doesn't become a 404, which would
 * quietly rewrite what other people saw. So the page still answers — it just
 * says what happened, and keeps the one thing that outlives the take: the link
 * to the original source, so whoever followed the link still gets somewhere.
 */
function RemovedClip({
  source,
}: {
  source: AnnotationView["source"];
}) {
  return (
    <AppShell narrow>
      <article className="border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] text-[color:var(--b-ink)] shadow-[8px_8px_0_0_var(--b-shadow)]">
        <div className="border-b-[3px] border-[color:var(--b-line)] bg-[color:var(--b-chrome)] px-5 py-3 sm:px-6">
          <p className={`${tombstoneLabel} text-[color:var(--b-acid)]`}>Removed</p>
        </div>
        <div className="p-5 sm:p-6">
          <p className="font-display text-[28px] leading-[1.06] tracking-[-0.01em] sm:text-[34px]">
            The person who published this took it down.
          </p>
          <p className="mt-3 text-[17px] leading-relaxed text-[color:var(--b-dim)]">
            The clip and the take are gone. This link still resolves so it
            doesn&rsquo;t turn into a dead end for anyone who saved it.
          </p>
          {source && (
            <div className="mt-6 border-t-[3px] border-[color:var(--b-line)] pt-4">
              <p className={`${tombstoneLabel} text-[color:var(--b-dim)]`}>
                It was clipped from
              </p>
              <a
                href={source.canonicalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-[17px] font-extrabold underline decoration-[color:var(--b-acid)] decoration-[3px] underline-offset-4"
              >
                {source.title}
              </a>
            </div>
          )}
        </div>
      </article>

      <footer className="mt-8 text-center font-mono text-xs text-[color:var(--b-dim-onbg)]">
        annotated.com
      </footer>
    </AppShell>
  );
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

  // Checked after canonicalization so a removed clip's link still normalizes to
  // one URL, and before any of the clip machinery: its media is deleted, so the
  // player would otherwise sit on "processing" forever.
  if (annotation.removed) return <RemovedClip source={annotation.source} />;

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

  // Structured data: the take is the original work; it cites the source.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    url: absoluteUrl(`/a/${canonicalParam}`),
    headline: annotation.takeText ?? annotation.selectedText ?? "Clip",
    ...(annotation.takeText ? { text: annotation.takeText } : {}),
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
            annotationId: annotation._id,
            selectedText: annotation.selectedText,
            takeText: annotation.takeText,
            takeAudioUrl: annotation.takeAudioUrl,
            takeAudioTranscript: annotation.takeAudioTranscript,
            clipTranscript,
            captionsUrl:
              annotation.source?.type === "youtube" && clipTranscript
                ? `/a/${canonicalParam}/captions`
                : undefined,
            clipStartMs: annotation.clipStartMs,
            clipEndMs: annotation.clipEndMs,
            clipUrl: annotation.clipUrl,
            mediaState: annotation.mediaState,
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
