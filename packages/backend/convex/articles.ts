import { v } from "convex/values";
import { action } from "./_generated/server";
import { requireIdentity } from "./media";

const extractedArticleValidator = v.object({
  title: v.string(),
  textContent: v.string(),
  byline: v.union(v.string(), v.null()),
  siteName: v.union(v.string(), v.null()),
  imageUrl: v.union(v.string(), v.null()),
});

/**
 * Server-side article extraction. `htmlStorageId` points at the content
 * script's live `outerHTML` (option B — what the user actually sees,
 * paywalls/JS resolved, no SSRF surface), pre-uploaded to Convex storage by
 * the caller — a real article page's outerHTML can exceed 1MB (NPR measured
 * 1.11MB), Convex's per-value size cap, so it can't travel as a plain string
 * action argument. When omitted, the worker fetches `url` itself (option A).
 * The worker token is held server-side (no client ships it). Throws a
 * friendly message on 422 ("not a readable article").
 */
export const extractArticle = action({
  args: { url: v.string(), htmlStorageId: v.optional(v.id("_storage")) },
  returns: extractedArticleValidator,
  handler: async (ctx, args) => {
    await requireIdentity(ctx);
    const workerUrl = process.env.WORKER_URL;
    const workerToken = process.env.WORKER_AUTH_TOKEN;
    if (!workerUrl || !workerToken) {
      throw new Error("Worker is not configured");
    }
    if (!/^https?:\/\//.test(args.url)) {
      throw new Error("Enter a valid http(s) URL");
    }

    // Pull the uploaded HTML back out of storage server-side, then delete the
    // blob — it has no purpose beyond this one extraction. Best-effort: a
    // failure here just falls through to the worker's own url-fetch (option A).
    let html: string | undefined;
    if (args.htmlStorageId) {
      try {
        const htmlUrl = await ctx.storage.getUrl(args.htmlStorageId);
        if (htmlUrl) {
          const htmlResponse = await fetch(htmlUrl);
          if (htmlResponse.ok) html = await htmlResponse.text();
        }
      } catch {
        // Swallow: html stays undefined and the worker falls back to its own
        // url-fetch (option A).
      } finally {
        await ctx.storage.delete(args.htmlStorageId);
      }
    }

    const response = await fetch(`${workerUrl}/extract-article`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${workerToken}` },
      body: JSON.stringify({ url: args.url, html }),
    });
    if (!response.ok) {
      if (response.status === 422) {
        throw new Error(
          "This page doesn't have a clippable article. Try a news story or blog post."
        );
      }
      throw new Error("Couldn't read this article. Please try again in a moment.");
    }
    const body = (await response.json()) as Partial<{
      title: string; textContent: string; byline: string | null;
      siteName: string | null; imageUrl: string | null;
    }>;
    if (typeof body.title !== "string" || typeof body.textContent !== "string") {
      throw new Error("Worker returned an unexpected article response");
    }
    return {
      title: body.title,
      textContent: body.textContent,
      byline: body.byline ?? null,
      siteName: body.siteName ?? null,
      imageUrl: body.imageUrl ?? null,
    };
  },
});
