// Extensionless imports (this package uses Bundler resolution) so every consumer
// bundler — vitest, Plasmo, tsc, and Next/Turbopack — resolves them.
export { extractYoutubeVideoId } from "./extract-youtube-id";
export { youtubeCanonicalUrl } from "./youtube-canonical-url";
export { formatClipTimestamp } from "./format-clip-timestamp";
export { clockToMs, evaluateClipSpan, MAX_CLIP_MS } from "./clip-span";
export type { ClipSpanResult } from "./clip-span";
