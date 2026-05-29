import { v } from "convex/values";
import { action } from "./_generated/server";

const extractedArticleValidator = v.object({
  title: v.string(),
  textContent: v.string(),
  byline: v.union(v.string(), v.null()),
  siteName: v.union(v.string(), v.null()),
  imageUrl: v.union(v.string(), v.null()),
});

/**
 * Server-side article extraction for the web composer: fetches the worker's
 * Readability endpoint with the worker token held server-side (the web must not
 * ship that token). The worker fetches the page itself when no HTML is supplied.
 * Throws a friendly message on 422 ("not a readable article").
 */
export const extractArticle = action({
  args: { url: v.string() },
  returns: extractedArticleValidator,
  handler: async (_ctx, args) => {
    const workerUrl = process.env.WORKER_URL;
    const workerToken = process.env.WORKER_AUTH_TOKEN;
    if (!workerUrl || !workerToken) {
      throw new Error("Worker is not configured");
    }
    if (!/^https?:\/\//.test(args.url)) {
      throw new Error("Enter a valid http(s) URL");
    }
    const response = await fetch(`${workerUrl}/extract-article`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${workerToken}` },
      body: JSON.stringify({ url: args.url }),
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
