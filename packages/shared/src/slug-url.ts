const MAX_SLUG_WORDS = 8;

/**
 * Turns a human title into a URL slug: lowercase, diacritics stripped,
 * non-alphanumeric runs collapsed to single hyphens, trimmed, and capped to
 * ~8 words at a word boundary. Returns "" when nothing slug-worthy remains
 * (callers fall back to the bare id).
 */
export function slugify(text: string): string {
  const normalized = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // combining diacritical marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (normalized.length === 0) return "";
  return normalized.split("-").slice(0, MAX_SLUG_WORDS).join("-");
}

/**
 * Splits a hybrid `slug-id` route param into its parts. Convex ids contain no
 * hyphens, so the id is always the segment after the final hyphen; a param with
 * no hyphen is treated as a bare id (legacy/unslugged link).
 */
export function splitSlugId(param: string): { slug: string; id: string } {
  const lastHyphen = param.lastIndexOf("-");
  if (lastHyphen === -1) {
    return { slug: "", id: param };
  }
  return {
    slug: param.slice(0, lastHyphen),
    id: param.slice(lastHyphen + 1),
  };
}

/**
 * Builds the canonical `slug-id` path segment from a title + id. Falls back to
 * the bare id when the title yields no slug.
 */
export function slugId(title: string, id: string): string {
  const slug = slugify(title);
  return slug.length > 0 ? `${slug}-${id}` : id;
}
