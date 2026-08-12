/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as annotations from "../annotations.js";
import type * as articles from "../articles.js";
import type * as cache from "../cache.js";
import type * as claims from "../claims.js";
import type * as clips from "../clips.js";
import type * as comments from "../comments.js";
import type * as files from "../files.js";
import type * as follows from "../follows.js";
import type * as likes from "../likes.js";
import type * as media from "../media.js";
import type * as podcasts from "../podcasts.js";
import type * as publishers from "../publishers.js";
import type * as sources from "../sources.js";
import type * as testing from "../testing.js";
import type * as threads from "../threads.js";
import type * as topics from "../topics.js";
import type * as transcripts from "../transcripts.js";
import type * as users from "../users.js";
import type * as votes from "../votes.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  annotations: typeof annotations;
  articles: typeof articles;
  cache: typeof cache;
  claims: typeof claims;
  clips: typeof clips;
  comments: typeof comments;
  files: typeof files;
  follows: typeof follows;
  likes: typeof likes;
  media: typeof media;
  podcasts: typeof podcasts;
  publishers: typeof publishers;
  sources: typeof sources;
  testing: typeof testing;
  threads: typeof threads;
  topics: typeof topics;
  transcripts: typeof transcripts;
  users: typeof users;
  votes: typeof votes;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
