import type { FastifyInstance } from "fastify";
import { clipYoutubeBodySchema, evaluateClipSpan } from "../clip-schema.js";
import { clipYoutubeVideo } from "../youtube-clipper.js";
import type { ClipUploader } from "../clip-uploader.js";

export interface ClipDeps {
  uploader: ClipUploader;
  workerToken: string;
}

function extractBearerToken(authorization: string | undefined): string | undefined {
  if (!authorization?.startsWith("Bearer ")) return undefined;
  return authorization.slice("Bearer ".length);
}

/**
 * POST /clip-youtube — authorize, validate the body + 90s span, clip the video
 * span at 240p via yt-dlp+ffmpeg, upload the result to Convex storage, and
 * return its storageId. Temp files are always cleaned up.
 */
export function registerClipYoutubeRoute(
  app: FastifyInstance,
  deps: ClipDeps
): void {
  app.post("/clip-youtube", async (request, reply) => {
    const token = extractBearerToken(request.headers.authorization);
    if (!token || token !== deps.workerToken) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const parsed = clipYoutubeBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "Invalid request body", issues: parsed.error.issues });
    }

    const { videoId, startMs, endMs } = parsed.data;
    const span = evaluateClipSpan(startMs, endMs);
    if (!span.ok) {
      return reply.code(400).send({ error: span.error });
    }

    let clip;
    try {
      clip = await clipYoutubeVideo(videoId, startMs, endMs);
    } catch (err) {
      request.log.error(err);
      return reply.code(502).send({ error: "Clip generation failed" });
    }

    try {
      const storageId = await deps.uploader.upload(clip.filePath);
      return reply.code(200).send({ storageId, durationMs: span.durationMs });
    } catch (err) {
      request.log.error(err);
      return reply.code(502).send({ error: "Clip upload failed" });
    } finally {
      await clip.cleanup();
    }
  });
}
