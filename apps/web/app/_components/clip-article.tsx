import { formatClipTimestamp } from "@annotated/shared";

export interface ClipArticleData {
  selectedText?: string;
  commentaryText?: string;
  commentaryAudioUrl?: string | null;
  commentaryAudioTranscript?: string;
  clipStartMs?: number;
  clipEndMs?: number;
  clipUrl: string | null;
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

/**
 * The brutalism clip card: media (by source type), the quote, text + voice
 * commentary, author, and (optionally) the source attribution. Presentational
 * and server-renderable — shared by the /a/[id] landing and the /t/[id] thread
 * page so a clip looks identical standalone or in a thread.
 */
export function ClipArticle({ data }: { data: ClipArticleData }) {
  const isPodcast = data.sourceType === "podcast";
  const isArticle = data.sourceType === "article";
  const range =
    data.clipStartMs != null && data.clipEndMs != null
      ? `${formatClipTimestamp(data.clipStartMs)}–${formatClipTimestamp(data.clipEndMs)}`
      : null;

  return (
    <article className="border-[3px] border-[#111] bg-white shadow-[8px_8px_0_0_#111]">
      {!isArticle && (
        <div className="border-b-[3px] border-[#111] bg-black">
          {!data.clipUrl ? (
            <p className="p-8 text-center font-mono text-sm text-white">
              clip unavailable
            </p>
          ) : isPodcast ? (
            <audio controls src={data.clipUrl} className="block w-full p-4" />
          ) : (
            <video
              controls
              src={data.clipUrl}
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

        {data.selectedText &&
          (isArticle ? (
            <blockquote className="mt-4 border-l-[6px] border-[#ffe600] pl-5 text-2xl font-bold leading-snug text-[#111]">
              “{data.selectedText}”
            </blockquote>
          ) : (
            <blockquote className="mt-4 border-l-[6px] border-[#ffe600] pl-4 font-mono text-sm leading-relaxed text-[#333]">
              “{data.selectedText}”
            </blockquote>
          ))}

        {data.commentaryText && (
          <p className="mt-4 border-l-[6px] border-[#111] pl-4 text-lg leading-relaxed">
            {data.commentaryText}
          </p>
        )}

        {data.commentaryAudioUrl && (
          <div className="mt-4 border-l-[6px] border-[#ff5c00] pl-4">
            <p className="mb-2 font-mono text-xs font-bold uppercase tracking-widest text-[#555]">
              Voice commentary
            </p>
            <audio controls src={data.commentaryAudioUrl} className="w-full" />
            {data.commentaryAudioTranscript && (
              <p className="mt-2 text-sm italic leading-relaxed text-[#333]">
                “{data.commentaryAudioTranscript}”
              </p>
            )}
          </div>
        )}

        {data.authorName && (
          <p className="mt-3 text-sm font-bold uppercase tracking-wide text-[#555]">
            — {data.authorName}
          </p>
        )}

        {data.source && (
          <div className="mt-6 border-t-[3px] border-[#111] pt-4">
            <p className="text-xs font-bold uppercase tracking-widest text-[#555]">
              Clipped from
              {data.source.siteName ? ` · ${data.source.siteName}` : ""}
            </p>
            <p className="mt-1 font-bold">{data.source.title}</p>
            <a
              href={data.source.canonicalUrl}
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
  );
}
