import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // User profiles, mirrored from Clerk on first sign-in.
  users: defineTable({
    clerkId: v.string(),
    username: v.string(),
    displayName: v.string(),
    avatarUrl: v.optional(v.string()),
    bio: v.optional(v.string()),
    xHandle: v.optional(v.string()),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_username", ["username"]),

  // Podcast episodes, YouTube videos, and articles.
  // Shared across all users — two people clipping the same episode share one row.
  sources: defineTable({
    type: v.union(
      v.literal("youtube"),
      v.literal("podcast"),
      v.literal("article")
    ),
    canonicalUrl: v.string(),
    title: v.string(),
    author: v.optional(v.string()),
    // YouTube
    youtubeVideoId: v.optional(v.string()),
    youtubeThumbnailUrl: v.optional(v.string()),
    youtubeDurationMs: v.optional(v.number()),
    // Podcast
    podcastName: v.optional(v.string()),
    podcastEpisodeGuid: v.optional(v.string()),
    mp3Url: v.optional(v.string()),
    // Article
    siteName: v.optional(v.string()),
    // Cache metadata
    cachedAt: v.optional(v.number()),
  })
    .index("by_canonical_url", ["canonicalUrl"])
    .index("by_youtube_id", ["youtubeVideoId"])
    .index("by_podcast_guid", ["podcastEpisodeGuid"]),

  // RSS feed cache. One row per feed URL, TTL 6 hours.
  rssCache: defineTable({
    feedUrl: v.string(),
    rawXml: v.string(),
    fetchedAt: v.number(),
  }).index("by_feed_url", ["feedUrl"]),

  // iTunes Lookup cache. One row per Apple podcast id, TTL 7 days.
  // Stores the raw JSON response (podcast + episode list) so repeat opens of
  // the same show skip the network round-trip.
  itunesCache: defineTable({
    appleId: v.string(),
    json: v.string(),
    fetchedAt: v.number(),
  }).index("by_apple_id", ["appleId"]),

  // Word-level transcripts. Shared per source — computed once, reused forever.
  transcripts: defineTable({
    sourceId: v.id("sources"),
    provider: v.union(v.literal("deepgram"), v.literal("youtube-vtt")),
    words: v.array(
      v.object({
        word: v.string(),
        startMs: v.number(),
        endMs: v.number(),
        speaker: v.optional(v.string()),
        confidence: v.optional(v.number()),
      })
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("failed")
    ),
    deepgramJobId: v.optional(v.string()),
  })
    .index("by_source", ["sourceId"])
    .index("by_status", ["status"]),

  // Annotations: a clip + commentary published by a user.
  annotations: defineTable({
    authorId: v.id("users"),
    sourceId: v.id("sources"),
    // Clip time boundaries (audio/video).
    clipStartMs: v.optional(v.number()),
    clipEndMs: v.optional(v.number()),
    // Storage ID for the sliced clip file (set by the worker after slicing).
    clipStorageId: v.optional(v.id("_storage")),
    // Text selection boundaries for article sources.
    textStart: v.optional(v.number()),
    textEnd: v.optional(v.number()),
    selectedText: v.optional(v.string()),
    // Commentary — at least one of these must be present.
    commentaryText: v.optional(v.string()),
    commentaryAudioStorageId: v.optional(v.id("_storage")),
    // Deepgram transcript of the recorded commentary (best-effort; for captions
    // + feed previews of audio-only annotations).
    commentaryAudioTranscript: v.optional(v.string()),
    // Publishing
    isPublic: v.boolean(),
    publishedAt: v.optional(v.number()),
    // Denormalized counts for feed rendering without extra queries.
    commentCount: v.number(),
    // Upvote count (kept the name `likeCount` for backward compatibility with
    // existing rows / the deployed build; an upvote === a "like").
    likeCount: v.number(),
    downCount: v.optional(v.number()),
  })
    .index("by_author", ["authorId"])
    .index("by_source", ["sourceId"])
    .index("by_feed", ["isPublic", "publishedAt"]),

  // Comments on annotations. `parentId` threads a reply onto a top-level
  // comment; nesting is capped at one level (a reply to a reply flattens to
  // the same top-level parent). Optional so pre-existing flat rows validate.
  comments: defineTable({
    annotationId: v.id("annotations"),
    authorId: v.id("users"),
    text: v.string(),
    createdAt: v.number(),
    parentId: v.optional(v.id("comments")),
  })
    .index("by_annotation", ["annotationId"])
    .index("by_author", ["authorId"])
    .index("by_parent", ["parentId"]),

  // Follow relationships between users.
  follows: defineTable({
    followerId: v.id("users"),
    followingId: v.id("users"),
  })
    .index("by_follower", ["followerId"])
    .index("by_following", ["followingId"]),

  // Votes on annotations. `value` is the direction: +1 = "brilliant" (upvote, a
  // "like"), -1 = "BS" (downvote). Optional so pre-existing like rows (no value)
  // validate and read as upvotes.
  likes: defineTable({
    annotationId: v.id("annotations"),
    userId: v.id("users"),
    value: v.optional(v.union(v.literal(1), v.literal(-1))),
  })
    .index("by_annotation", ["annotationId"])
    .index("by_user", ["userId"])
    .index("by_annotation_and_user", ["annotationId", "userId"]),

  // Fair-use dispute claims. Written to DB and emailed to Tarik; manual review only (v1).
  claims: defineTable({
    annotationId: v.id("annotations"),
    claimantName: v.string(),
    claimantEmail: v.string(),
    reason: v.string(),
    submittedAt: v.number(),
    status: v.union(v.literal("open"), v.literal("resolved")),
  })
    .index("by_annotation", ["annotationId"])
    .index("by_status", ["status"]),
});
