function sourceKindLabel(type: string): string {
  switch (type) {
    case "youtube":
      return "YouTube";
    case "podcast":
      return "Podcast";
    case "article":
      return "Article";
    default:
      return "Source";
  }
}

/**
 * The fields needed to attribute the original creator a clip points at. A subset
 * every source projection (feed, landing, thread) can supply.
 */
export interface SourceBylineData {
  type: string;
  canonicalUrl: string;
  siteName?: string | null;
  author?: string | null;
  podcastName?: string | null;
  youtubeChannelUrl?: string | null;
}

interface Resolved {
  kind: string;
  primary: string;
  secondary?: string;
  href: string;
}

/**
 * Resolves the type-aware byline: who created the clipped content and where to
 * reach them. Article → journalist + publication; podcast → show; YouTube →
 * channel (linked to the channel, not the video).
 */
function resolve(source: SourceBylineData): Resolved {
  const kind = sourceKindLabel(source.type);
  switch (source.type) {
    case "youtube":
      return {
        kind,
        primary: source.author ?? "YouTube channel",
        href: source.youtubeChannelUrl ?? source.canonicalUrl,
      };
    case "podcast":
      return {
        kind,
        primary: source.podcastName ?? "Podcast",
        href: source.canonicalUrl,
      };
    case "article":
      return {
        kind,
        primary: source.author ?? source.siteName ?? "Publication",
        secondary: source.author ? (source.siteName ?? undefined) : undefined,
        href: source.canonicalUrl,
      };
    default:
      return { kind, primary: source.siteName ?? "Source", href: source.canonicalUrl };
  }
}

/**
 * Prominent creator attribution — the journalist / channel / show a clip points
 * at. Brutalist block with an acid left-accent, linking out to the original (or
 * the YouTube channel). This is the "we highlight the creator" surface.
 */
export function SourceByline({
  source,
  className = "",
}: {
  source: SourceBylineData;
  className?: string;
}) {
  const { kind, primary, secondary, href } = resolve(source);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`group flex items-center gap-3 border-l-[5px] border-[color:var(--b-acid)] bg-[color:var(--b-chrome)] py-2.5 pl-3 pr-3.5 text-[color:var(--b-card)] ${className}`}
    >
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--b-acid)]">
          Clipped from · {kind}
        </p>
        <p className="truncate text-[15px] font-extrabold leading-tight group-hover:underline">
          {primary}
        </p>
        {secondary && (
          <p className="truncate font-mono text-[12px] opacity-75">{secondary}</p>
        )}
      </div>
      <span aria-hidden className="flex-none text-[15px] font-black">↗</span>
    </a>
  );
}
