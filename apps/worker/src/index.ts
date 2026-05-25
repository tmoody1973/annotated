import Fastify from "fastify";
import { loadEnv } from "./env.js";
import { createDeepgramClient } from "./deepgram-client.js";
import { createTranscriptWriter } from "./convex-writer.js";
import { createClipUploader } from "./clip-uploader.js";
import { registerTranscribeRoute } from "./routes/transcribe.js";
import { registerClipYoutubeRoute } from "./routes/clip-youtube.js";
import { registerClipAudioRoute } from "./routes/clip-audio.js";
import { registerExtractArticleRoute } from "./routes/extract-article.js";
import { registerTranscodeCommentaryRoute } from "./routes/transcode-commentary.js";

const env = loadEnv();

// The article path POSTs a page's full outerHTML (option B) as JSON — real news
// pages routinely exceed Fastify's 1MB default and would 413 before the route
// runs. Raise the cap so large articles extract instead of silently failing.
const app = Fastify({ logger: true, bodyLimit: 16 * 1024 * 1024 });

app.get("/health", async () => ({ status: "ok" }));

registerTranscribeRoute(app, {
  deepgram: createDeepgramClient(env.DEEPGRAM_API_KEY),
  writer: createTranscriptWriter(env.CONVEX_URL, env.WORKER_AUTH_TOKEN),
  workerToken: env.WORKER_AUTH_TOKEN,
});

registerClipYoutubeRoute(app, {
  uploader: createClipUploader(env.CONVEX_URL, env.WORKER_AUTH_TOKEN),
  workerToken: env.WORKER_AUTH_TOKEN,
});

registerClipAudioRoute(app, {
  uploader: createClipUploader(env.CONVEX_URL, env.WORKER_AUTH_TOKEN),
  workerToken: env.WORKER_AUTH_TOKEN,
});

registerExtractArticleRoute(app, {
  workerToken: env.WORKER_AUTH_TOKEN,
});

registerTranscodeCommentaryRoute(app, {
  uploader: createClipUploader(env.CONVEX_URL, env.WORKER_AUTH_TOKEN),
  deepgram: createDeepgramClient(env.DEEPGRAM_API_KEY),
  workerToken: env.WORKER_AUTH_TOKEN,
});

const start = async () => {
  try {
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
