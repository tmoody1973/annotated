import { v } from "convex/values";
import { action } from "./_generated/server";
import { workerConfig, WORKER_FETCH_TIMEOUT_MS } from "./clips";
import type { Id } from "./_generated/dataModel";

/**
 * Server-side proxies for the worker endpoints the extension used to call
 * directly with a bundled bearer token. Every one of these is auth-gated on the
 * Clerk identity — the worker token lives only here.
 */

async function requireIdentity(ctx: { auth: { getUserIdentity: () => Promise<unknown> } }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Sign in to continue");
}

const chapterValidator = v.object({
  title: v.string(),
  startMs: v.number(),
  endMs: v.number(),
});

export const youtubeChapters = action({
  args: { videoId: v.string() },
  returns: v.array(chapterValidator),
  handler: async (ctx, args) => {
    await requireIdentity(ctx);
    const { url, token } = workerConfig();
    // Chapters are an enhancement: a failure — including a timeout — must
    // never block clipping.
    try {
      const response = await fetch(`${url}/youtube-chapters`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ videoId: args.videoId }),
        signal: AbortSignal.timeout(WORKER_FETCH_TIMEOUT_MS),
      });
      if (!response.ok) return [];
      const body = (await response.json()) as { chapters?: unknown };
      if (!Array.isArray(body.chapters)) return [];
      return body.chapters as { title: string; startMs: number; endMs: number }[];
    } catch {
      return [];
    }
  },
});

export const transcodeTake = action({
  args: { audioStorageId: v.id("_storage"), mimeType: v.string() },
  returns: v.object({
    storageId: v.id("_storage"),
    transcript: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    await requireIdentity(ctx);
    const { url, token } = workerConfig();
    const sourceUrl = await ctx.storage.getUrl(args.audioStorageId);
    if (!sourceUrl) throw new Error("Recorded take not found in storage");
    let response: Response;
    try {
      response = await fetch(`${url}/transcode-commentary`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ audioUrl: sourceUrl, mimeType: args.mimeType }),
        signal: AbortSignal.timeout(WORKER_FETCH_TIMEOUT_MS),
      });
    } catch {
      throw new Error("Couldn't process that recording. Try again.");
    }
    if (!response.ok) {
      throw new Error("Couldn't process that recording. Try again.");
    }
    const body = (await response.json()) as {
      storageId?: string;
      transcript?: string | null;
    };
    if (typeof body.storageId !== "string") {
      throw new Error("Worker returned no storageId for the recorded take");
    }
    return {
      storageId: body.storageId as Id<"_storage">,
      transcript: body.transcript ?? null,
    };
  },
});

export const transcribeSource = action({
  args: { videoId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireIdentity(ctx);
    const { url, token } = workerConfig();
    // Fire-and-forget backfill: never surface a failure to the clipper.
    try {
      await fetch(`${url}/transcribe-youtube`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ videoId: args.videoId }),
        signal: AbortSignal.timeout(WORKER_FETCH_TIMEOUT_MS),
      });
    } catch {
      // intentionally ignored
    }
    return null;
  },
});
