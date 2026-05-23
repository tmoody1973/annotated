/** The canonical watch URL for a YouTube video id — the source's `canonicalUrl`. */
export function youtubeCanonicalUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}
