import { formatClipTimestamp } from "@annotated/shared";
import { SourceByline, resolveSourceByline } from "./source-byline";
import type { MediaState } from "../../components/clip-media";
import { ClipMediaLive } from "../../components/clip-media-live";

/**
 * The source screenshot, capped in height and top-anchored so the head of the
 * page shows. Linked to the original when the source URL is known (omitted on
 * thread pages), reinforcing "click through to the real thing".
 */
function SourceVisual({
  screenshotUrl,
  href,
}: {
  screenshotUrl: string;
  href?: string;
}) {
  const image = (
    // eslint-disable-next-line @next/next/no-img-element -- signed Convex storage URL, not a static asset
    <img
      src={screenshotUrl}
      alt="Screenshot of the original source page"
      className="block max-h-[340px] w-full object-cover object-top"
    />
  );
  if (!href) return image;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="block">
      {image}
    </a>
  );
}

export interface ClipArticleData {
  annotationId: string;
  selectedText?: string;
  takeText?: string;
  takeAudioUrl?: string | null;
  takeAudioTranscript?: string;
  // The transcript text for the clip window (youtube-vtt / podcast deepgram),
  // shown in an accordion — the WCAG text alternative for the clip's audio.
  clipTranscript?: string;
  // Same-origin WebVTT URL for synchronized captions on the video <track>.
  captionsUrl?: string;
  clipStartMs?: number;
  clipEndMs?: number;
  clipUrl: string | null;
  mediaState?: MediaState;
  // A capture of the original article page (gap §4), shown as the citation
  // visual so the clip reads as "pointing at" the source, not replacing it.
  screenshotUrl?: string | null;
  sourceType?: string;
  authorName?: string;
  // When present, renders the "Clipped from" attribution block inside the card.
  // Omitted on thread pages, where the source is shown once at the thread head.
  source?: {
    canonicalUrl: string;
    title: string;
    siteName?: string;
    imageUrl?: string | null;
    author?: string | null;
    podcastName?: string | null;
    youtubeChannelUrl?: string | null;
  } | null;
}

const label = "font-mono text-[11px] font-bold uppercase tracking-[0.14em]";

/**
 * The brutalist clip card: media (by source type), the quote, text + voice
 * take, author, and (optionally) the source attribution. Presentational
 * and server-renderable — shared by the /a/[id] landing and the /t/[id] thread
 * so a clip looks identical standalone or in a thread. Reads --b-* tokens, so it
 * flips light/dark with the theme.
 */
export function ClipArticle({ data }: { data: ClipArticleData }) {
  const isPodcast = data.sourceType === "podcast";
  const isArticle = data.sourceType === "article";
  // Prefer the clipper's viewport screenshot; fall back to the source's og:image
  // so an article clip always has a citation visual.
  const articleVisual = data.screenshotUrl ?? data.source?.imageUrl ?? null;
  const range =
    data.clipStartMs != null && data.clipEndMs != null
      ? `${formatClipTimestamp(data.clipStartMs)}–${formatClipTimestamp(data.clipEndMs)}`
      : null;
  // The creator name, resolved once so the quiet pre-player line and the full
  // "Clipped from" block at the bottom (SourceByline) agree on who made this.
  const byline = data.source
    ? resolveSourceByline({
        type: data.sourceType ?? "",
        canonicalUrl: data.source.canonicalUrl,
        siteName: data.source.siteName,
        author: data.source.author,
        podcastName: data.source.podcastName,
        youtubeChannelUrl: data.source.youtubeChannelUrl,
      })
    : null;

  return (
    <article className="border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] text-[color:var(--b-ink)] shadow-[8px_8px_0_0_var(--b-shadow)]">
      {data.source && byline && (
        <div className="border-b-[3px] border-[color:var(--b-line)] px-5 pt-4 pb-3 sm:px-6">
          <p className={`${label} text-[color:var(--b-dim)]`}>
            {byline.primary}
            {byline.secondary ? ` · ${byline.secondary}` : ""}
          </p>
          <p
            className="mt-1.5 min-w-0 font-display text-[30px] leading-[1.04] tracking-[-0.01em] not-italic text-[color:var(--b-ink)] sm:text-[36px]"
            style={{ overflowWrap: "anywhere" }}
          >
            {data.source.title}
          </p>
        </div>
      )}

      <ClipMediaLive
        annotationId={data.annotationId}
        mediaState={data.mediaState}
        clipUrl={data.clipUrl}
        sourceType={isArticle ? "article" : isPodcast ? "podcast" : "youtube"}
        captionsUrl={data.captionsUrl}
        className="border-b-[3px] border-[color:var(--b-line)]"
      />

      {isArticle && articleVisual && (
        <figure className="border-b-[3px] border-[color:var(--b-line)]">
          <SourceVisual screenshotUrl={articleVisual} href={data.source?.canonicalUrl} />
          <figcaption className={`border-t-[3px] border-[color:var(--b-line)] bg-[color:var(--b-chrome)] px-5 py-2.5 ${label} text-[color:var(--b-acid)]`}>
            Original — Annotated points at it, doesn&rsquo;t replace it
          </figcaption>
        </figure>
      )}

      <div className="p-5 sm:p-6">
        {isArticle && (
          <span className={`inline-block border-2 border-[color:var(--b-line)] bg-[color:var(--b-acid)] px-2 py-1 ${label} text-[color:var(--b-acid-ink)]`}>
            Highlight
          </span>
        )}

        {range && !isArticle && (
          <span className={`inline-block border-2 border-[color:var(--b-line)] px-2 py-1 ${label}`}>
            {range}
          </span>
        )}

        {data.selectedText && (
          <blockquote
            className={`mt-4 border-l-[6px] border-[color:var(--b-acid)] pl-5 font-extrabold leading-[1.12] tracking-[-0.01em] ${
              isArticle ? "text-[28px]" : "text-[22px]"
            }`}
          >
            “{data.selectedText}”
          </blockquote>
        )}

        {data.takeText && (
          <p className="mt-5 text-[17px] leading-relaxed">{data.takeText}</p>
        )}

        {data.takeAudioUrl && (
          <div className="mt-5 border-l-[6px] border-[color:var(--b-acid)] pl-4">
            <p className={`mb-2 ${label} text-[color:var(--b-dim)]`}>Voice take</p>
            <audio controls src={data.takeAudioUrl} className="w-full" />
            {data.takeAudioTranscript && (
              <p className="mt-2 text-[15px] italic leading-relaxed text-[color:var(--b-dim)]">
                “{data.takeAudioTranscript}”
              </p>
            )}
          </div>
        )}

        {data.clipTranscript && (
          <details className="mt-5 border-2 border-[color:var(--b-line)]">
            <summary className={`cursor-pointer select-none bg-[color:var(--b-chrome)] px-4 py-2.5 ${label} text-[color:var(--b-acid)]`}>
              Transcript
            </summary>
            <p className="border-t-2 border-[color:var(--b-line)] px-4 py-3 text-[15px] leading-relaxed text-[color:var(--b-ink)]">
              {data.clipTranscript}
            </p>
          </details>
        )}

        {data.authorName && (
          <p className={`mt-4 ${label}`}>— {data.authorName}</p>
        )}

        {data.source && (
          <div className="mt-6 border-t-[3px] border-[color:var(--b-line)] pt-4">
            <SourceByline
              source={{
                type: data.sourceType ?? "",
                canonicalUrl: data.source.canonicalUrl,
                siteName: data.source.siteName,
                author: data.source.author,
                podcastName: data.source.podcastName,
                youtubeChannelUrl: data.source.youtubeChannelUrl,
              }}
            />
            <p className="mt-2 text-[17px] font-extrabold">{data.source.title}</p>
          </div>
        )}
      </div>
    </article>
  );
}
