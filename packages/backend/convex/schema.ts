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
    website: v.optional(v.string()),
    isVerified: v.optional(v.boolean()),
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
    // Channel name lives in `author` (shared with article journalist); the
    // channel URL is YouTube-specific. Captured at clip time going forward —
    // optional so pre-existing rows validate (channel name only, no link).
    youtubeChannelUrl: v.optional(v.string()),
    // Podcast
    podcastName: v.optional(v.string()),
    podcastEpisodeGuid: v.optional(v.string()),
    mp3Url: v.optional(v.string()),
    // Article
    siteName: v.optional(v.string()),
    // Article social-card image (og:image) — citation visual fallback when no
    // viewport screenshot was captured at clip time.
    imageUrl: v.optional(v.string()),
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
    // The word list as a JSON string (parsed client-side). Stored as text rather
    // than an array because Convex caps arrays at 8192 elements — for stored
    // fields, mutation args, AND query results — and a full episode easily
    // exceeds that. `words` is the legacy array (≤8192) kept for pre-existing
    // rows; new transcripts write `wordsJson`. Both optional.
    wordsJson: v.optional(v.string()),
    words: v.optional(
      v.array(
        v.object({
          word: v.string(),
          startMs: v.number(),
          endMs: v.number(),
          speaker: v.optional(v.string()),
          confidence: v.optional(v.number()),
        })
      )
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("failed")
    ),
    deepgramJobId: v.optional(v.string()),
    // The episode audio frozen into Convex storage at transcribe time. Podcast
    // clips are cut from THIS copy (not the live enclosure) so the audio shares
    // one timeline with these word timestamps — no dynamic-ad-insertion drift.
    episodeStorageId: v.optional(v.id("_storage")),
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
    // Source screenshot (gap §4): a capture of the original page taken in the
    // extension at clip time, so an article landing reads as a citation ("we
    // point at it, we don't replace it") rather than a bare quote. Per-annotation
    // because it's a moment-in-time of what that clipper saw. Optional so clips
    // without a capture (and all pre-§4 rows) validate.
    screenshotStorageId: v.optional(v.id("_storage")),
    // Anonymous publishing (gap §9): when true, the author identity is masked in
    // every public projection (feed, landing, profile) — `authorId` is kept on
    // the row server-side for claims/moderation but never projected. Optional,
    // default off, so pre-§9 rows validate and behave exactly as before.
    isAnonymous: v.optional(v.boolean()),
    // Editorial curation (§1 cold-start): hand-picked clips that lead the
    // signed-out "Curated / Editor's Picks" default feed, so a first-time
    // visitor lands on a highlight reel instead of an empty "For You". Optional,
    // default off, so every pre-§1 row validates and stays uncurated. Toggled
    // via the internal `annotations.setEditorPick` (CLI/dashboard only).
    isEditorPick: v.optional(v.boolean()),
    // Publishing
    isPublic: v.boolean(),
    publishedAt: v.optional(v.number()),
    // Denormalized counts for feed rendering without extra queries.
    commentCount: v.number(),
    // Upvote count (kept the name `likeCount` for backward compatibility with
    // existing rows / the deployed build; an upvote === a "like").
    likeCount: v.number(),
    downCount: v.optional(v.number()),
    // Threading (gap §1): a clip can belong to an ordered thread of clips from
    // one source by one author. Optional so standalone clips / pre-§1 rows
    // validate; `threadOrder` is the 0-based position within the thread.
    threadId: v.optional(v.id("threads")),
    threadOrder: v.optional(v.number()),
  })
    .index("by_author", ["authorId"])
    .index("by_source", ["sourceId"])
    .index("by_feed", ["isPublic", "publishedAt"])
    .index("by_curated", ["isEditorPick", "publishedAt"])
    .index("by_thread", ["threadId"]),

  // Threads: an ordered series of annotations from one source by one author,
  // addressable at /t/[id] (gap §1 — Jason's #1 demo flow).
  threads: defineTable({
    authorId: v.id("users"),
    sourceId: v.id("sources"),
    title: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_author", ["authorId"])
    .index("by_source_and_author", ["sourceId", "authorId"]),

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

  // Likes on individual comments. Drift-proof: the count is derived from rows,
  // never stored. One row per (comment, user).
  commentLikes: defineTable({
    commentId: v.id("comments"),
    userId: v.id("users"),
  })
    .index("by_comment", ["commentId"])
    .index("by_comment_and_user", ["commentId", "userId"]),

  // Publisher-accounts waitlist (the /publishers "coming soon" page). Public,
  // unauthenticated capture; deduped by email.
  publisherWaitlist: defineTable({
    email: v.string(),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

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

  // Canonical, curated topics. Addressable rooms (/topics/[slug]).
  topics: defineTable({
    slug: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
  }).index("by_slug", ["slug"]),

  // Annotation↔topic join. `publishedAt` is denormalized from the annotation
  // (immutable, set once) so a topic room reads its most-recent candidates by index.
  annotationTopics: defineTable({
    annotationId: v.id("annotations"),
    topicId: v.id("topics"),
    publishedAt: v.number(),
  })
    .index("by_topic", ["topicId", "publishedAt"])
    .index("by_annotation", ["annotationId"]),
});
