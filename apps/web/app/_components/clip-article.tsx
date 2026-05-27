import { formatClipTimestamp } from "@annotated/shared";

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
  selectedText?: string;
  commentaryText?: string;
  commentaryAudioUrl?: string | null;
  commentaryAudioTranscript?: string;
  clipStartMs?: number;
  clipEndMs?: number;
  clipUrl: string | null;
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
  } | null;
}

const label = "font-mono text-[11px] font-bold uppercase tracking-[0.14em]";

/**
 * The brutalist clip card: media (by source type), the quote, text + voice
 * commentary, author, and (optionally) the source attribution. Presentational
 * and server-renderable — shared by the /a/[id] landing and the /t/[id] thread
 * so a clip looks identical standalone or in a thread. Reads --b-* tokens, so it
 * flips light/dark with the theme.
 */
export function ClipArticle({ data }: { data: ClipArticleData }) {
  const isPodcast = data.sourceType === "podcast";
  const isArticle = data.sourceType === "article";
  const range =
    data.clipStartMs != null && data.clipEndMs != null
      ? `${formatClipTimestamp(data.clipStartMs)}–${formatClipTimestamp(data.clipEndMs)}`
      : null;

  return (
    <article className="border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] text-[color:var(--b-ink)] shadow-[8px_8px_0_0_var(--b-shadow)]">
      {!isArticle && (
        <div className="border-b-[3px] border-[color:var(--b-line)] bg-[color:var(--b-chrome)]">
          {!data.clipUrl ? (
            <p className={`p-8 text-center ${label} text-[color:var(--b-acid)]`}>clip unavailable</p>
          ) : isPodcast ? (
            <audio controls src={data.clipUrl} className="block w-full p-4" />
          ) : (
            <video controls src={data.clipUrl} className="block max-h-[60vh] w-full bg-black" />
          )}
        </div>
      )}

      {isArticle && data.screenshotUrl && (
        <figure className="border-b-[3px] border-[color:var(--b-line)]">
          <SourceVisual screenshotUrl={data.screenshotUrl} href={data.source?.canonicalUrl} />
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

        {data.commentaryText && (
          <p className="mt-5 text-[17px] leading-relaxed">{data.commentaryText}</p>
        )}

        {data.commentaryAudioUrl && (
          <div className="mt-5 border-l-[6px] border-[color:var(--b-acid)] pl-4">
            <p className={`mb-2 ${label} text-[color:var(--b-dim)]`}>Voice commentary</p>
            <audio controls src={data.commentaryAudioUrl} className="w-full" />
            {data.commentaryAudioTranscript && (
              <p className="mt-2 text-[15px] italic leading-relaxed text-[color:var(--b-dim)]">
                “{data.commentaryAudioTranscript}”
              </p>
            )}
          </div>
        )}

        {data.authorName && (
          <p className={`mt-4 ${label}`}>— {data.authorName}</p>
        )}

        {data.source && (
          <div className="mt-6 border-t-[3px] border-[color:var(--b-line)] pt-4">
            <p className={`${label} text-[color:var(--b-dim)]`}>
              Clipped from{data.source.siteName ? ` · ${data.source.siteName}` : ""}
            </p>
            <p className="mt-1 text-[17px] font-extrabold">{data.source.title}</p>
            <a
              href={data.source.canonicalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 border-2 border-[color:var(--b-line)] bg-[color:var(--b-acid)] px-3 py-1.5 text-sm font-black uppercase tracking-wide text-[color:var(--b-acid-ink)]"
            >
              View original ↗
            </a>
          </div>
        )}
      </div>
    </article>
  );
}
