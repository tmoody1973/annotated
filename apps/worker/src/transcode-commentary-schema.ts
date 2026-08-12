import { z } from "zod";

// 90s of opus is well under a megabyte; cap base64 generously but below the
// Fastify 16MB body limit so an oversized payload 400s cleanly, never 413s.
export const MAX_COMMENTARY_BASE64_LENGTH = 12 * 1024 * 1024;

// Exactly one of audioBase64 (extension-bundled path) or audioUrl (Convex
// storage URL, avoiding a megabyte of base64 in an action argument) must be
// present — enforced below so a caller can't send both or neither.
export const transcodeCommentaryBodySchema = z
  .object({
    audioBase64: z.string().min(1).max(MAX_COMMENTARY_BASE64_LENGTH).optional(),
    audioUrl: z.string().url().optional(),
    mimeType: z.string().regex(/^audio\//, "mimeType must be an audio/* type"),
  })
  .refine((body) => Boolean(body.audioBase64) !== Boolean(body.audioUrl), {
    message: "Provide exactly one of audioBase64 or audioUrl",
  });

export type TranscodeCommentaryBody = z.infer<typeof transcodeCommentaryBodySchema>;
