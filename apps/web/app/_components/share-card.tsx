import { authorInitials } from "@annotated/shared";

export type ShareFormat = "story" | "grid";

export interface ShareCardData {
  quote: string;
  commentary?: string;
  authorName?: string; // undefined => anonymous
  avatarUrl?: string | null;
  isVerified?: boolean;
  sourceTitle?: string;
  sourceType: string;
}

const COLORS = {
  bg: "#f4f1e8",
  ink: "#111111",
  acid: "#ffe600",
  acidInk: "#111111",
  dim: "#555555",
} as const;

function clamp(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function typeLabel(sourceType: string): string {
  switch (sourceType) {
    case "podcast":
      return "Podcast";
    case "youtube":
      return "Video";
    case "article":
      return "Article";
    default:
      return "Clip";
  }
}

/** Square avatar (photo or acid initials block) sized for the card. Inline —
 *  Satori can't render the app's AuthorAvatar component (it relies on CSS vars). */
function CardAvatar({
  authorName,
  avatarUrl,
  size,
}: {
  authorName: string;
  avatarUrl?: string | null;
  size: number;
}) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          border: `3px solid ${COLORS.ink}`,
          objectFit: "cover",
        }}
      />
    );
  }
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        border: `3px solid ${COLORS.ink}`,
        background: COLORS.acid,
        color: COLORS.acidInk,
        fontSize: Math.round(size * 0.42),
        fontWeight: 700,
      }}
    >
      {authorInitials(authorName) || "·"}
    </div>
  );
}

/**
 * The downloadable share card rendered by `next/og` (Satori). Two layouts off
 * `format`: Story (1080×1920, taller hero) and Grid (1080×1080, compact). The
 * annotated.sh wordmark anchors the bottom — it drives the share→traffic loop.
 */
export function ShareCard({
  data,
  format,
}: {
  data: ShareCardData;
  format: ShareFormat;
}) {
  const isStory = format === "story";
  const pad = isStory ? 88 : 64;
  const quoteSize = isStory ? 72 : 60;
  const commentarySize = isStory ? 34 : 30;
  const avatarSize = isStory ? 72 : 60;
  const identitySize = isStory ? 34 : 30;
  const quoteMax = isStory ? 220 : 180;
  const commentaryMax = isStory ? 200 : 140;
  const anonymous = !data.authorName;
  const name = data.authorName ?? "Anonymous";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: COLORS.bg,
        color: COLORS.ink,
        padding: `${pad}px`,
        borderLeft: `28px solid ${COLORS.acid}`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: isStory ? 34 : 28,
          fontWeight: 700,
          letterSpacing: 2,
          textTransform: "uppercase",
        }}
      >
        <div style={{ display: "flex" }}>Annotated</div>
        <div
          style={{
            display: "flex",
            border: `3px solid ${COLORS.ink}`,
            padding: "6px 18px",
            fontSize: isStory ? 28 : 22,
          }}
        >
          {typeLabel(data.sourceType)}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          marginTop: isStory ? 80 : 48,
          fontSize: quoteSize,
          fontWeight: 700,
          lineHeight: 1.12,
        }}
      >
        “{clamp(data.quote, quoteMax)}”
      </div>

      {data.commentary && (
        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: commentarySize,
            lineHeight: 1.3,
            color: COLORS.dim,
          }}
        >
          {clamp(data.commentary, commentaryMax)}
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginTop: "auto",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {!anonymous && (
            <CardAvatar
              authorName={name}
              avatarUrl={data.avatarUrl}
              size={avatarSize}
            />
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: identitySize, fontWeight: 700 }}>
            {name}
            {!anonymous && data.isVerified && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: Math.round(identitySize * 0.8),
                  height: Math.round(identitySize * 0.8),
                  background: COLORS.acid,
                  color: COLORS.acidInk,
                  fontSize: Math.round(identitySize * 0.5),
                  fontWeight: 700,
                }}
              >
                ✓
              </div>
            )}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: isStory ? 28 : 24,
            color: COLORS.dim,
          }}
        >
          <div style={{ display: "flex" }}>
            {data.sourceTitle ? clamp(data.sourceTitle, 56) : ""}
          </div>
          <div style={{ display: "flex", color: COLORS.ink, fontWeight: 700 }}>
            annotated.sh
          </div>
        </div>
      </div>
    </div>
  );
}
