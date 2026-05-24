import { z } from "zod";

/** SPEC: clips are capped at 90 seconds. */
export const MAX_CLIP_MS = 90_000;

/** Body of a POST /clip-youtube request. */
export const clipYoutubeBodySchema = z.object({
  videoId: z.string().min(1),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().positive(),
});

export type ClipYoutubeBody = z.infer<typeof clipYoutubeBodySchema>;

/** Body of a POST /clip-audio request. mp3Url is the podcast enclosure (may be redirect-prefixed).
 * Restricted to http(s) so the URL can't drive curl/ffmpeg at file:// or internal metadata IPs. */
export const clipAudioBodySchema = z.object({
  mp3Url: z
    .string()
    .url()
    .refine((u) => /^https?:\/\//i.test(u), "mp3Url must be http(s)"),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().positive(),
});

export type ClipAudioBody = z.infer<typeof clipAudioBodySchema>;

export type ClipSpanResult =
  | { ok: true; durationMs: number }
  | { ok: false; error: string };

/**
 * Validates a clip span against the SPEC 90s cap and ordering. Pure — the route
 * uses it to return a 400 with a reason before any download work begins.
 */
export function evaluateClipSpan(startMs: number, endMs: number): ClipSpanResult {
  if (endMs <= startMs) {
    return { ok: false, error: "endMs must be greater than startMs" };
  }
  const durationMs = endMs - startMs;
  if (durationMs > MAX_CLIP_MS) {
    return { ok: false, error: `clip exceeds the ${MAX_CLIP_MS / 1000}s limit` };
  }
  return { ok: true, durationMs };
}
