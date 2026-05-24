import type { FastifyInstance } from "fastify";
import { extractArticleBodySchema } from "../extract-article-schema.js";
import { parseArticle } from "../parse-article.js";
import { fetchArticleHtml } from "../article-fetcher.js";

export interface ExtractArticleDeps {
  workerToken: string;
}

function extractBearerToken(authorization: string | undefined): string | undefined {
  if (!authorization?.startsWith("Bearer ")) return undefined;
  return authorization.slice("Bearer ".length);
}

/**
 * POST /extract-article — authorize, validate, then run Mozilla Readability over
 * the page HTML. Prefers the content-script-supplied `html` (option B: the page
 * the user actually sees, paywalls/JS resolved); falls back to an SSRF-guarded
 * server fetch of `url` (option A) when no html is given. Returns the cleaned
 * title/text/byline/siteName, or 422 when the page has no extractable article.
 */
export function registerExtractArticleRoute(
  app: FastifyInstance,
  deps: ExtractArticleDeps
): void {
  app.post("/extract-article", async (request, reply) => {
    const token = extractBearerToken(request.headers.authorization);
    if (!token || token !== deps.workerToken) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const parsed = extractArticleBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "Invalid request body", issues: parsed.error.issues });
    }

    const { url, html } = parsed.data;

    let pageHtml = html ?? null;
    if (!pageHtml) {
      pageHtml = await fetchArticleHtml(url);
      if (!pageHtml) {
        return reply.code(502).send({ error: "Could not fetch the article URL" });
      }
    }

    const article = parseArticle(pageHtml);
    if (!article) {
      return reply.code(422).send({ error: "No extractable article on this page" });
    }
    return reply.code(200).send(article);
  });
}
