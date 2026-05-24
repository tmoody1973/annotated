import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DEEPGRAM_API_KEY: z.string().min(1, "DEEPGRAM_API_KEY is required"),
  CONVEX_URL: z.string().url("CONVEX_URL must be a valid URL"),
  WORKER_AUTH_TOKEN: z.string().min(1, "WORKER_AUTH_TOKEN is required"),
  PORT: z.coerce.number().int().positive().default(8080),
});

export type WorkerEnv = z.infer<typeof envSchema>;

let cached: WorkerEnv | null = null;

/**
 * Validates and returns the worker environment, failing fast with a readable
 * message if anything required is missing. Result is cached after first load.
 */
export function loadEnv(): WorkerEnv {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid worker environment:\n${issues}`);
  }

  cached = parsed.data;
  return cached;
}
