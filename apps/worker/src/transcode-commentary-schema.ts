import { z } from "zod";

// 90s of opus is well under a megabyte; cap base64 generously but below the
// Fastify 16MB body limit so an oversized payload 400s cleanly, never 413s.
export const MAX_COMMENTARY_BASE64_LENGTH = 12 * 1024 * 1024;

export const transcodeCommentaryBodySchema = z.object({
  audioBase64: z.string().min(1).max(MAX_COMMENTARY_BASE64_LENGTH),
  mimeType: z.string().regex(/^audio\//, "mimeType must be an audio/* type"),
});

export type TranscodeCommentaryBody = z.infer<typeof transcodeCommentaryBodySchema>;
