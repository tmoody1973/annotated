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
  {
    transcriptId: string;
    wordsJson: string;
    deepgramJobId?: string;
    episodeStorageId?: string;
    workerToken: string;
  },
  null
>("transcripts:setReady");

const filesGetUrlRef = makeFunctionReference<
  "query",
  { storageId: string },
  string | null
>("files:getUrl");

const setFailedRef = makeFunctionReference<
  "mutation",
  { transcriptId: string; workerToken: string },
  null
>("transcripts:setFailed");

const getBySourceRef = makeFunctionReference<
  "query",
  { sourceId: string },
  { status: string } | null
>("transcripts:getBySource");

const getByYoutubeIdRef = makeFunctionReference<
  "query",
  { youtubeVideoId: string },
  { _id: string } | null
>("sources:getByYoutubeId");

export interface TranscriptWriter {
  createProcessing(sourceId: string, provider?: Provider): Promise<string>;
  markReady(
    transcriptId: string,
    words: TranscriptWord[],
    episodeStorageId?: string
  ): Promise<void>;
  markFailed(transcriptId: string): Promise<void>;
  /** True if a transcript row already exists for this source (any provider). */
  hasTranscript(sourceId: string): Promise<boolean>;
  /** Resolves the source id for a YouTube video, or null if no source exists yet. */
  resolveYoutubeSourceId(videoId: string): Promise<string | null>;
  /** Signed Convex URL for a stored file (the frozen episode), or null. */
  getStorageUrl(storageId: string): Promise<string | null>;
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
    async createProcessing(
      sourceId: string,
      provider: Provider = "deepgram"
    ): Promise<string> {
      return await client.mutation(createRef, {
        sourceId,
        provider,
        workerToken,
      });
    },

    async markReady(
      transcriptId: string,
      words: TranscriptWord[],
      episodeStorageId?: string
    ): Promise<void> {
      // Send the words as a JSON string — Convex caps array args at 8192
      // elements, which a full episode exceeds. The client parses it back.
      await client.mutation(setReadyRef, {
        transcriptId,
        wordsJson: JSON.stringify(words),
        ...(episodeStorageId ? { episodeStorageId } : {}),
        workerToken,
      });
    },

    async markFailed(transcriptId: string): Promise<void> {
      await client.mutation(setFailedRef, { transcriptId, workerToken });
    },

    async getStorageUrl(storageId: string): Promise<string | null> {
      return await client.query(filesGetUrlRef, { storageId });
    },

    async hasTranscript(sourceId: string): Promise<boolean> {
      const existing = await client.query(getBySourceRef, { sourceId });
      return existing !== null;
    },

    async resolveYoutubeSourceId(videoId: string): Promise<string | null> {
      const source = await client.query(getByYoutubeIdRef, {
        youtubeVideoId: videoId,
      });
      return source?._id ?? null;
    },
  };
}
