import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { fetchYoutubeSubsVtt } from "../youtube-subs-fetcher.js";
import { parseVttToWords } from "../youtube-vtt.js";
import type { TranscriptWriter } from "../convex-writer.js";

export interface TranscribeYoutubeDeps {
  writer: TranscriptWriter;
  workerToken: string;
}

const bodySchema = z.object({
  videoId: z.string().min(1),
});

function extractBearerToken(authorization: string | undefined): string | undefined {
  if (!authorization?.startsWith("Bearer ")) return undefined;
  return authorization.slice("Bearer ".length);
}

/**
 * POST /transcribe-youtube — authorize, then (once per source) fetch the video's
 * English captions via yt-dlp (no download), parse the VTT to words, and store
 * them as a youtube-vtt transcript. Idempotent: skips if a transcript already
 * exists. A video with no captions or unparseable VTT is marked failed and
 * answered 200 — the accordion simply doesn't render. Only a yt-dlp failure 502s.
 */
export function registerTranscribeYoutubeRoute(
  app: FastifyInstance,
  deps: TranscribeYoutubeDeps
): void {
  app.post("/transcribe-youtube", async (request, reply) => {
    const token = extractBearerToken(request.headers.authorization);
    if (!token || token !== deps.workerToken) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "Invalid request body", issues: parsed.error.issues });
    }

    const { videoId } = parsed.data;

    const sourceId = await deps.writer.resolveYoutubeSourceId(videoId);
    if (!sourceId) {
      return reply.code(200).send({ status: "no-source" });
    }

    if (await deps.writer.hasTranscript(sourceId)) {
      return reply.code(200).send({ status: "exists" });
    }

    const transcriptId = await deps.writer.createProcessing(sourceId, "youtube-vtt");

    let raw: string | null;
    try {
      raw = await fetchYoutubeSubsVtt(videoId);
    } catch (err) {
      request.log.error(err);
      await deps.writer.markFailed(transcriptId);
      return reply.code(502).send({ error: "Caption lookup failed" });
    }

    const words = raw ? parseVttToWords(raw) : [];
    if (words.length === 0) {
      await deps.writer.markFailed(transcriptId);
      return reply.code(200).send({ status: "no-captions" });
    }

    await deps.writer.markReady(transcriptId, words);
    return reply.code(200).send({ status: "ready", wordCount: words.length });
  });
}
