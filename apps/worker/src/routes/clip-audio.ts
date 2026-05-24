import type { FastifyInstance } from "fastify";
import { clipAudioBodySchema, evaluateClipSpan } from "../clip-schema.js";
import { clipAudio } from "../audio-clipper.js";
import type { ClipUploader } from "../clip-uploader.js";

export interface ClipAudioDeps {
  uploader: ClipUploader;
  workerToken: string;
}

function extractBearerToken(authorization: string | undefined): string | undefined {
  if (!authorization?.startsWith("Bearer ")) return undefined;
  return authorization.slice("Bearer ".length);
}

/**
 * POST /clip-audio — authorize, validate the body + 90s span, cut the podcast
 * audio span with ffmpeg (range-seeking the redirect-resolved enclosure), upload
 * the mp3 to Convex storage, and return its storageId. Temp files always cleaned.
 */
export function registerClipAudioRoute(
  app: FastifyInstance,
  deps: ClipAudioDeps
): void {
  app.post("/clip-audio", async (request, reply) => {
    const token = extractBearerToken(request.headers.authorization);
    if (!token || token !== deps.workerToken) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const parsed = clipAudioBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "Invalid request body", issues: parsed.error.issues });
    }

    const { mp3Url, startMs, endMs } = parsed.data;
    const span = evaluateClipSpan(startMs, endMs);
    if (!span.ok) {
      return reply.code(400).send({ error: span.error });
    }

    let clip;
    try {
      clip = await clipAudio(mp3Url, startMs, endMs);
    } catch (err) {
      request.log.error(err);
      return reply.code(502).send({ error: "Audio clip generation failed" });
    }

    try {
      const storageId = await deps.uploader.upload(clip.filePath, "audio/mpeg");
      return reply.code(200).send({ storageId, durationMs: span.durationMs });
    } catch (err) {
      request.log.error(err);
      return reply.code(502).send({ error: "Clip upload failed" });
    } finally {
      await clip.cleanup();
    }
  });
}
