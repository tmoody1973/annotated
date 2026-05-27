import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { fetchChaptersRaw } from "../youtube-chapters-fetcher.js";

export interface ChaptersDeps {
  workerToken: string;
}

const bodySchema = z.object({ videoId: z.string().min(1) });

function extractBearerToken(authorization: string | undefined): string | undefined {
  if (!authorization?.startsWith("Bearer ")) return undefined;
  return authorization.slice("Bearer ".length);
}

/**
 * POST /youtube-chapters — authorize, then read a video's chapter metadata via
 * yt-dlp (metadata-only, no download). Returns the raw yt-dlp `chapters` payload
 * (array or null); the extension normalizes it with the shared parser. Kept a
 * thin proxy so the worker stays free of the shared package, like the other
 * yt-dlp routes.
 */
export function registerYoutubeChaptersRoute(
  app: FastifyInstance,
  deps: ChaptersDeps
): void {
  app.post("/youtube-chapters", async (request, reply) => {
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

    try {
      const chapters = await fetchChaptersRaw(parsed.data.videoId);
      return reply.code(200).send({ chapters });
    } catch (err) {
      request.log.error(err);
      return reply.code(502).send({ error: "Chapter lookup failed" });
    }
  });
}
