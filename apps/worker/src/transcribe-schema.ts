import { z } from "zod";

/** Body of a POST /transcribe request: which source, and the audio to transcribe. */
export const transcribeBodySchema = z.object({
  sourceId: z.string().min(1),
  mp3Url: z.string().url(),
});

export type TranscribeBody = z.infer<typeof transcribeBodySchema>;
