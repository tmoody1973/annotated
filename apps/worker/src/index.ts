import Fastify from "fastify";
import { loadEnv } from "./env.js";
import { createDeepgramClient } from "./deepgram-client.js";
import { createTranscriptWriter } from "./convex-writer.js";
import { createClipUploader } from "./clip-uploader.js";
import { registerTranscribeRoute } from "./routes/transcribe.js";
import { registerClipYoutubeRoute } from "./routes/clip-youtube.js";

const env = loadEnv();

const app = Fastify({ logger: true });

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

const start = async () => {
  try {
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
