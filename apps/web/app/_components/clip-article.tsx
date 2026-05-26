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
    <article className="overflow-hidden rounded-[10px] border border-[color:var(--calm-hair)] bg-[color:var(--calm-panel)] shadow-[0_1px_2px_rgba(27,26,23,0.06),0_22px_48px_-28px_rgba(27,26,23,0.22)]">
      {!isArticle && (
        <div className="border-b border-[color:var(--calm-hair)] bg-[color:var(--calm-surface)]">
          {!data.clipUrl ? (
            <p className="p-8 text-center font-mono text-sm text-[color:var(--calm-ink-3)]">
              clip unavailable
            </p>
          ) : isPodcast ? (
            <audio controls src={data.clipUrl} className="block w-full p-4" />
          ) : (
            <video
              controls
              src={data.clipUrl}
              className="block max-h-[60vh] w-full bg-[#1b1a17]"
            />
          )}
        </div>
      )}

      <div className="p-5 sm:p-6">
        {isArticle && (
          <span className="inline-block rounded-[6px] border border-[color:var(--calm-accent)] bg-[color:var(--calm-accent-tint)] px-2 py-1 font-mono text-[11px] font-medium uppercase tracking-widest text-[color:var(--calm-accent)]">
            Highlight
          </span>
        )}

        {range && !isArticle && (
          <span className="inline-block rounded-[6px] border border-[color:var(--calm-hair)] bg-[color:var(--calm-surface)] px-2 py-1 font-mono text-sm font-medium text-[color:var(--calm-ink-2)]">
            {range}
          </span>
        )}

        {data.selectedText && (
          <blockquote
            className={`mt-4 border-l-2 border-[color:var(--calm-accent)] pl-5 font-serif leading-snug text-[color:var(--calm-ink)] ${
              isArticle ? "text-2xl font-medium" : "text-lg"
            }`}
          >
            “{data.selectedText}”
          </blockquote>
        )}

        {data.commentaryText && (
          <p className="mt-4 border-l-2 border-[color:var(--calm-hair)] pl-4 font-serif text-lg leading-relaxed text-[color:var(--calm-ink)]">
            {data.commentaryText}
          </p>
        )}

        {data.commentaryAudioUrl && (
          <div className="mt-4 border-l-2 border-[color:var(--calm-accent)] pl-4">
            <p className="mb-2 font-mono text-[11px] font-medium uppercase tracking-widest text-[color:var(--calm-ink-3)]">
              Voice commentary
            </p>
            <audio controls src={data.commentaryAudioUrl} className="w-full" />
            {data.commentaryAudioTranscript && (
              <p className="mt-2 font-serif text-base italic leading-relaxed text-[color:var(--calm-ink-2)]">
                “{data.commentaryAudioTranscript}”
              </p>
            )}
          </div>
        )}

        {data.authorName && (
          <p className="mt-3 text-sm font-medium uppercase tracking-wide text-[color:var(--calm-ink-2)]">
            — {data.authorName}
          </p>
        )}

        {data.source && (
          <div className="mt-6 border-t border-[color:var(--calm-hair)] pt-4">
            <p className="text-[11px] font-medium uppercase tracking-widest text-[color:var(--calm-ink-3)]">
              Clipped from
              {data.source.siteName ? ` · ${data.source.siteName}` : ""}
            </p>
            <p className="mt-1 font-medium text-[color:var(--calm-ink)]">
              {data.source.title}
            </p>
            <a
              href={data.source.canonicalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 rounded-[7px] border border-[color:var(--calm-hair)] bg-[color:var(--calm-panel)] px-3 py-1.5 text-sm font-medium text-[color:var(--calm-accent)] hover:bg-[color:var(--calm-surface)]"
            >
              View original ↗
            </a>
          </div>
        )}
      </div>
    </article>
  );
}
