import { readFile } from "node:fs/promises";
import type { FastifyInstance } from "fastify";
import { transcodeCommentaryBodySchema } from "../transcode-commentary-schema.js";
import { transcodeToMp3 } from "../commentary-transcoder.js";
import type { ClipUploader } from "../clip-uploader.js";
import type { DeepgramClient } from "../deepgram-client.js";

export interface TranscodeCommentaryDeps {
  uploader: ClipUploader;
  deepgram: DeepgramClient;
  workerToken: string;
}

function extractBearerToken(authorization: string | undefined): string | undefined {
  if (!authorization?.startsWith("Bearer ")) return undefined;
  return authorization.slice("Bearer ".length);
}

/**
 * POST /transcode-commentary — authorize, validate the base64 audio body,
 * transcode the recorded webm/opus voice note to mp3, upload it to Convex
 * storage, and return its storageId. Temp files always cleaned.
 */
export function registerTranscodeCommentaryRoute(
  app: FastifyInstance,
  deps: TranscodeCommentaryDeps
): void {
  app.post("/transcode-commentary", async (request, reply) => {
    const token = extractBearerToken(request.headers.authorization);
    if (!token || token !== deps.workerToken) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const parsed = transcodeCommentaryBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "Invalid request body", issues: parsed.error.issues });
    }

    const audioBytes = Buffer.from(parsed.data.audioBase64, "base64");
    if (audioBytes.length === 0) {
      return reply.code(400).send({ error: "Empty audio payload" });
    }

    let clip;
    try {
      clip = await transcodeToMp3(audioBytes);
    } catch (err) {
      request.log.error(err);
      return reply.code(502).send({ error: "Commentary transcode failed" });
    }

    try {
      const storageId = await deps.uploader.upload(clip.filePath, "audio/mpeg");
      // Transcription is best-effort: a Deepgram hiccup must not fail the publish,
      // so a failure yields a null transcript rather than a 5xx.
      let transcript: string | null = null;
      try {
        const mp3 = await readFile(clip.filePath);
        const text = (await deps.deepgram.transcribeFile(mp3, "audio/mpeg")).trim();
        transcript = text.length > 0 ? text : null;
      } catch (transcribeErr) {
        request.log.warn(transcribeErr, "Commentary transcription failed");
      }
      return reply.code(200).send({ storageId, transcript });
    } catch (err) {
      request.log.error(err);
      return reply.code(502).send({ error: "Commentary upload failed" });
    } finally {
      await clip.cleanup();
    }
  });
}
