import { makeFunctionReference } from "convex/server";
import {
  buildAuthedClient,
  withTimeout,
  CONVEX_TIMEOUT_MS,
  CONVEX_UNREACHABLE,
} from "./convex-client";

export { NotSignedInError } from "./convex-client";

export type YoutubePublishArgs = {
  videoId: string;
  title: string;
  // YouTube channel name + URL (the creator), read from the watch page at clip
  // time. `author` is the channel name; the clip's own author is still derived
  // server-side from the Clerk identity.
  author?: string;
  channelUrl?: string;
  clipStartMs: number;
  clipEndMs: number;
  takeText?: string;
  takeAudioStorageId?: string;
  takeAudioTranscript?: string;
  isAnonymous?: boolean;
  threadId?: string;
  topicIds: string[];
};

export type PodcastPublishArgs = {
  sourceId: string;
  clipStartMs: number;
  clipEndMs: number;
  selectedText: string;
  takeText?: string;
  takeAudioStorageId?: string;
  takeAudioTranscript?: string;
  isAnonymous?: boolean;
  threadId?: string;
  topicIds: string[];
};

export type ArticlePublishArgs = {
  canonicalUrl: string;
  title: string;
  siteName?: string;
  author?: string;
  sourceImageUrl?: string;
  selectedText: string;
  textStart: number;
  textEnd: number;
  takeText?: string;
  takeAudioStorageId?: string;
  takeAudioTranscript?: string;
  screenshotStorageId?: string;
  isAnonymous?: boolean;
  threadId?: string;
  topicIds: string[];
};

const createYoutube = makeFunctionReference<"mutation", YoutubePublishArgs, string>(
  "annotations:createYoutube"
);

const createPodcast = makeFunctionReference<"mutation", PodcastPublishArgs, string>(
  "annotations:createPodcast"
);

const createArticle = makeFunctionReference<"mutation", ArticlePublishArgs, string>(
  "annotations:createArticle"
);

/**
 * Publishes a YouTube clip as the signed-in Clerk user via a one-shot authed
 * ConvexHttpClient (token fetched on demand, never wired into the panel's
 * reactive client). The author is derived server-side from the identity — this
 * call carries no worker token and no author argument.
 */
export async function publishYoutubeAuthed(args: YoutubePublishArgs): Promise<string> {
  const client = await buildAuthedClient();
  return await withTimeout(client.mutation(createYoutube, args), CONVEX_TIMEOUT_MS, CONVEX_UNREACHABLE);
}

/**
 * Publishes a podcast clip as the signed-in Clerk user. The author is derived
 * server-side from the Clerk identity — no worker token, no author argument.
 */
export async function publishPodcastAuthed(args: PodcastPublishArgs): Promise<string> {
  const client = await buildAuthedClient();
  return await withTimeout(client.mutation(createPodcast, args), CONVEX_TIMEOUT_MS, CONVEX_UNREACHABLE);
}

/**
 * Publishes an article highlight as the signed-in Clerk user. The author is
 * derived server-side from the Clerk identity — no worker token, no author argument.
 */
export async function publishArticleAuthed(args: ArticlePublishArgs): Promise<string> {
  const client = await buildAuthedClient();
  return await withTimeout(client.mutation(createArticle, args), CONVEX_TIMEOUT_MS, CONVEX_UNREACHABLE);
}
