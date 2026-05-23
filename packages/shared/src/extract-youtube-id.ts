/** YouTube video IDs are exactly 11 URL-safe base64 characters. */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

function asValidId(candidate: string | undefined): string | null {
  return candidate && VIDEO_ID.test(candidate) ? candidate : null;
}

/**
 * Extracts a YouTube video ID from a page URL, or returns null if the URL is
 * not a YouTube video. Handles watch, youtu.be, shorts, and embed forms across
 * the www/m/music hosts; ignores extra query params. Never throws.
 */
export function extractYoutubeVideoId(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^(www\.|m\.)/, "");

  if (host === "youtu.be") {
    return asValidId(url.pathname.slice(1).split("/")[0]);
  }

  if (host === "youtube.com" || host.endsWith(".youtube.com")) {
    if (url.pathname === "/watch") {
      return asValidId(url.searchParams.get("v") ?? undefined);
    }
    const pathMatch = url.pathname.match(/^\/(?:shorts|embed)\/([^/?]+)/);
    if (pathMatch) {
      return asValidId(pathMatch[1]);
    }
  }

  return null;
}
