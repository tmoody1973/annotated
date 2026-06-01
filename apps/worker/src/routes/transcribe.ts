import type { FastifyInstance } from "fastify";
import { transcribeBodySchema } from "../transcribe-schema.js";
import { mapDeepgramResult, type TranscriptWord } from "../transcript-mapper.js";
import type { DeepgramClient } from "../deepgram-client.js";
import type { TranscriptWriter } from "../convex-writer.js";
import type { ClipUploader } from "../clip-uploader.js";
import { downloadEpisode } from "../episode-downloader.js";

export interface TranscribeDeps {
  deepgram: DeepgramClient;
  writer: TranscriptWriter;
  uploader: ClipUploader;
  workerToken: string;
}

/**
 * Freezes the episode so the transcript and any later clip share one timeline:
 * download the enclosure ONCE, store it in Convex, and transcribe THAT stored
 * copy. Returns the words + the stored episode id. Returns null on any failure
 * so the caller can fall back to transcribing the live URL (dynamic ad insertion
 * means a live re-fetch would drift from the bytes a clip is cut from — see the
 * podcast-transcript-drift note).
 */
async function transcribeFrozenEpisode(
  deps: TranscribeDeps,
  mp3Url: string,
  log: { warn: (obj: unknown, msg?: string) => void }
): Promise<{ words: TranscriptWord[]; episodeStorageId: string } | null> {
  let episode: Awaited<ReturnType<typeof downloadEpisode>> | undefined;
  try {
    episode = await downloadEpisode(mp3Url);
    const episodeStorageId = await deps.uploader.upload(episode.filePath, "audio/mpeg");
    const frozenUrl = await deps.writer.getStorageUrl(episodeStorageId);
    if (!frozenUrl) return null;
    const result = await deps.deepgram.transcribeUrl(frozenUrl);
    return { words: mapDeepgramResult(result), episodeStorageId };
  } catch (err) {
    log.warn({ err }, "episode freeze failed; falling back to live-URL transcription");
    return null;
  } finally {
    await episode?.cleanup();
  }
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
      // Prefer the frozen copy (transcript + clip share one timeline). Fall back
      // to the live URL — drift-prone, but better than failing to transcribe.
      const frozen = await transcribeFrozenEpisode(deps, mp3Url, request.log);
      const words = frozen
        ? frozen.words
        : mapDeepgramResult(await deps.deepgram.transcribeUrl(mp3Url));
      await deps.writer.markReady(transcriptId, words, frozen?.episodeStorageId);
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
