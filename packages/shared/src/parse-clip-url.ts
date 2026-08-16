import { splitSlugId } from "./slug-url";

/** Convex ids are lowercase base32-ish; enough of a shape check to reject slugs. */
const CONVEX_ID = /^[a-z0-9]{20,64}$/;

/**
 * Pulls the annotation id out of a link to a clip page, or returns null.
 *
 * This is what lets the reply composer take one input instead of two. A person
 * attaching a receipt pastes a link; if it points at a clip on Annotated the
 * reply carries that clip and can play it inline, and if it points anywhere
 * else it is kept as an ordinary outside source. They never have to say which
 * kind it is.
 *
 * The host is deliberately not checked — the same paste has to work from a
 * preview deploy, from localhost, and from a shortened link that has already
 * been followed — and the server validates the id it is handed regardless.
 * Only `/a/…` counts: `/t/…` is a thread, whose id is not an annotation.
 */
export function parseAnnotatedClipUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length !== 2 || segments[0] !== "a") return null;

  const { id } = splitSlugId(segments[1]);
  return CONVEX_ID.test(id) ? id : null;
}
