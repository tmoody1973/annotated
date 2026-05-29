export interface OgCardData {
  quote: string;
  commentary?: string;
  author?: string;
  sourceTitle?: string;
  sourceType: string;
  clipCount?: number;
  // Source visual (screenshot / article og:image / podcast cover / YouTube
  // thumbnail). When present, the card splits into text + a full-height image.
  imageUrl?: string | null;
}

function clamp(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function typeLabel(data: OgCardData): string {
  if (data.clipCount && data.clipCount > 1) return `Thread · ${data.clipCount} clips`;
  switch (data.sourceType) {
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

/**
 * The 1200×630 Open Graph card rendered by `next/og` (Satori) for /a and /t.
 * Brutalism palette (cream + yellow accent + heavy black), every container an
 * explicit flexbox per Satori's constraints. No external fonts (default sans).
 */
export function OgCard({ data }: { data: OgCardData }) {
  const hasImage = !!data.imageUrl;
  const quoteSize = hasImage ? 46 : 56;
  const quoteMax = hasImage ? 130 : 160;
  const commentaryMax = hasImage ? 80 : 120;

  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: "#f4f1e8",
        color: "#111111",
        borderLeft: "24px solid #ffe600",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          padding: "56px 64px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          <div style={{ display: "flex" }}>Annotated</div>
          <div
            style={{
              display: "flex",
              border: "3px solid #111111",
              padding: "4px 16px",
              fontSize: 22,
            }}
          >
            {typeLabel(data)}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 40,
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
              marginTop: 20,
              fontSize: 26,
              lineHeight: 1.3,
              color: "#333333",
            }}
          >
            {clamp(data.commentary, commentaryMax)}
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "auto",
            fontSize: 22,
          }}
        >
          <div style={{ display: "flex" }}>
            {data.author ? `— ${data.author}` : ""}
            {data.sourceTitle ? `  ·  ${clamp(data.sourceTitle, hasImage ? 30 : 48)}` : ""}
          </div>
          <div style={{ display: "flex", fontWeight: 700 }}>annotated.com</div>
        </div>
      </div>

      {hasImage && (
        <div
          style={{
            display: "flex",
            width: 440,
            height: "100%",
            borderLeft: "4px solid #111111",
          }}
        >
          <img
            src={data.imageUrl ?? undefined}
            style={{ width: 440, height: "100%", objectFit: "cover" }}
          />
        </div>
      )}
    </div>
  );
}
