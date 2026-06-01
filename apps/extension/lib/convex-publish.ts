import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { getConvexToken } from "./auth-token";

const convexUrl = process.env.PLASMO_PUBLIC_CONVEX_URL ?? "";

const CONVEX_TIMEOUT_MS = 25000;
const CONVEX_UNREACHABLE =
  "Couldn't reach Annotated's servers. Check your connection and try again.";

/** Rejects with a clear message if a Convex call stalls, so publish never spins
 *  forever when the deployment is unreachable (e.g. a network/firewall dropping
 *  the connection — the WebSocket-1006 case). */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

export type YoutubePublishArgs = {
  videoId: string;
  title: string;
  // YouTube channel name + URL (the creator), read from the watch page at clip
  // time. `author` is the channel name; the clip's own author is still derived
  // server-side from the Clerk identity.
  author?: string;
  channelUrl?: string;
  clipStorageId: string;
  clipStartMs: number;
  clipEndMs: number;
  commentaryText?: string;
  commentaryAudioStorageId?: string;
  commentaryAudioTranscript?: string;
  isAnonymous?: boolean;
  threadId?: string;
  topicIds: string[];
};

export type PodcastPublishArgs = {
  sourceId: string;
  clipStorageId: string;
  clipStartMs: number;
  clipEndMs: number;
  selectedText: string;
  commentaryText?: string;
  commentaryAudioStorageId?: string;
  commentaryAudioTranscript?: string;
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
  commentaryText?: string;
  commentaryAudioStorageId?: string;
  commentaryAudioTranscript?: string;
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

/** Mirrors the Clerk identity into a `users` row, idempotently. The web app runs
 *  this on sign-in, but a user who only ever authed through the extension's
 *  syncHost may not have a row yet — and createYoutube derives the author from it. */
const ensureCurrentUser = makeFunctionReference<"mutation", Record<string, never>, string>(
  "users:ensureCurrentUser"
);

/** Thrown when a publish is attempted with no Clerk session — the caller prompts
 *  sign-in rather than silently attributing the clip to the dev seed user. */
export class NotSignedInError extends Error {
  constructor() {
    super("Sign in on the web app, then close and reopen this panel, to publish.");
    this.name = "NotSignedInError";
  }
}

/** Creates an authed one-shot ConvexHttpClient for the signed-in Clerk user.
 *  Throws NotSignedInError when no token is available. Guarantees the users
 *  row exists before the caller uses the client to derive the author. */
async function buildAuthedClient(): Promise<ConvexHttpClient> {
  if (!convexUrl) {
    throw new Error("Missing PLASMO_PUBLIC_CONVEX_URL");
  }
  const token = await getConvexToken();
  if (!token) throw new NotSignedInError();
  const client = new ConvexHttpClient(convexUrl);
  client.setAuth(token);
  // Guarantee the users row exists before deriving the author from it.
  await withTimeout(client.mutation(ensureCurrentUser, {}), CONVEX_TIMEOUT_MS, CONVEX_UNREACHABLE);
  return client;
}

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
