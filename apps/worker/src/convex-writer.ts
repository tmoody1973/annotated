import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import type { TranscriptWord } from "./transcript-mapper.js";

type Provider = "deepgram" | "youtube-vtt";

/**
 * String-based references to the Convex `transcripts.*` mutations. The worker
 * is a separate package and `convex/_generated` is gitignored, so we reference
 * functions by name rather than importing the generated `api` — build-stable
 * across fresh checkouts.
 */
const createRef = makeFunctionReference<
  "mutation",
  { sourceId: string; provider: Provider; deepgramJobId?: string; workerToken: string },
  string
>("transcripts:create");

const setReadyRef = makeFunctionReference<
  "mutation",
  { transcriptId: string; words: TranscriptWord[]; deepgramJobId?: string; workerToken: string },
  null
>("transcripts:setReady");

const setFailedRef = makeFunctionReference<
  "mutation",
  { transcriptId: string; workerToken: string },
  null
>("transcripts:setFailed");

export interface TranscriptWriter {
  createProcessing(sourceId: string): Promise<string>;
  markReady(transcriptId: string, words: TranscriptWord[]): Promise<void>;
  markFailed(transcriptId: string): Promise<void>;
}

/**
 * Writes transcript state back to Convex over HTTP, presenting the shared
 * worker token on every call so the Convex side can authorize the write.
 */
export function createTranscriptWriter(
  convexUrl: string,
  workerToken: string
): TranscriptWriter {
  const client = new ConvexHttpClient(convexUrl);

  return {
    async createProcessing(sourceId: string): Promise<string> {
      return await client.mutation(createRef, {
        sourceId,
        provider: "deepgram",
        workerToken,
      });
    },

    async markReady(transcriptId: string, words: TranscriptWord[]): Promise<void> {
      await client.mutation(setReadyRef, { transcriptId, words, workerToken });
    },

    async markFailed(transcriptId: string): Promise<void> {
      await client.mutation(setFailedRef, { transcriptId, workerToken });
    },
  };
}
