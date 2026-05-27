import { Readability, isProbablyReaderable } from "@mozilla/readability";
import { parseHTML } from "linkedom";

/** Cleaned article extracted from raw page HTML by Mozilla Readability. */
export interface ParsedArticle {
  title: string;
  textContent: string;
  byline: string | null;
  siteName: string | null;
  /** The page's social-card image (og:image / twitter:image), if present — a
   *  reliable, curated citation visual when a viewport screenshot isn't captured. */
  imageUrl: string | null;
}

/** Reads the social-card image URL from page metadata (absolute http(s) only). */
function readSocialImage(document: {
  querySelector(selector: string): { getAttribute(name: string): string | null } | null;
}): string | null {
  const content = (selector: string): string | null =>
    document.querySelector(selector)?.getAttribute("content")?.trim() || null;
  const url =
    content('meta[property="og:image"]') ??
    content('meta[name="twitter:image"]') ??
    content('meta[name="twitter:image:src"]');
  return url && /^https?:\/\//i.test(url) ? url : null;
}

/**
 * Runs Mozilla Readability over raw page HTML and returns the cleaned title,
 * body text, byline, and site name — or null when the page has no extractable
 * article. Pure and deterministic on a fixed HTML string, so it is tested
 * directly against a saved real-article fixture. The DOM is built with linkedom
 * (lighter than jsdom, no native deps) which keeps the stateless worker slim.
 */
export function parseArticle(html: string): ParsedArticle | null {
  const { document } = parseHTML(html);
  // Read the social-card image before Readability runs (it mutates the doc).
  const imageUrl = readSocialImage(document);
  // linkedom's Document is structurally compatible but isn't the DOM lib's
  // global `Document` (this Node worker has no "dom" lib), so cast to the exact
  // types Readability's own API expects rather than naming the global.
  const doc = document as unknown as Parameters<typeof isProbablyReaderable>[0];

  // Readability is lenient and will return scraps (a nav label, a caption) for
  // pages with no real article. Gate on its own readerability heuristic first so
  // thin/non-article pages return null instead of garbage.
  if (!isProbablyReaderable(doc)) {
    return null;
  }

  let article;
  try {
    article = new Readability(
      doc as unknown as ConstructorParameters<typeof Readability>[0]
    ).parse();
  } catch {
    return null;
  }

  const textContent = article?.textContent?.trim() ?? "";
  if (!article || textContent.length === 0) {
    return null;
  }

  return {
    title: article.title?.trim() ?? "",
    textContent,
    byline: article.byline?.trim() || null,
    siteName: article.siteName?.trim() || null,
    imageUrl,
  };
}
