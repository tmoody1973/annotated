import type { FastifyInstance } from "fastify";
import { transcribeBodySchema } from "../transcribe-schema.js";
import { mapDeepgramResult } from "../transcript-mapper.js";
import type { DeepgramClient } from "../deepgram-client.js";
import type { TranscriptWriter } from "../convex-writer.js";

export interface TranscribeDeps {
  deepgram: DeepgramClient;
  writer: TranscriptWriter;
  workerToken: string;
}

function extractBearerToken(authorization: string | undefined): string | undefined {
  if (!authorization?.startsWith("Bearer ")) return undefined;
  return authorization.slice("Bearer ".length);
}

/**
 * POST /transcribe — authorize the caller, validate the body, create a
 * "processing" transcript row, transcribe the MP3 synchronously via Deepgram,
 * then write the words and flip the row to "ready". On failure the row is
 * marked "failed". Mirrors the ARCHITECTURE.md contract with a sync internal.
 */
export function registerTranscribeRoute(
  app: FastifyInstance,
  deps: TranscribeDeps
): void {
  app.post("/transcribe", async (request, reply) => {
    const token = extractBearerToken(request.headers.authorization);
    if (!token || token !== deps.workerToken) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const parsed = transcribeBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "Invalid request body", issues: parsed.error.issues });
    }

    const { sourceId, mp3Url } = parsed.data;
    const transcriptId = await deps.writer.createProcessing(sourceId);

    try {
      const result = await deps.deepgram.transcribeUrl(mp3Url);
      const words = mapDeepgramResult(result);
      await deps.writer.markReady(transcriptId, words);
      return reply
        .code(200)
        .send({ transcriptId, status: "ready", wordCount: words.length });
    } catch (err) {
      request.log.error(err);
      await deps.writer.markFailed(transcriptId);
      return reply
        .code(502)
        .send({ transcriptId, status: "failed", error: "Transcription failed" });
    }
  });
}
