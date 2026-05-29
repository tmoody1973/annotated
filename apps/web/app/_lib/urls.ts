import { slugId } from "@annotated/shared";

/** Absolute site origin for canonical + Open Graph URLs (no trailing slash). */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://annotated.sh"
).replace(/\/+$/, "");

/** Canonical path for a standalone clip: /a/[slug]-[id]. */
export function clipPath(title: string, id: string): string {
  return `/a/${slugId(title, id)}`;
}

/** Canonical path for a thread: /t/[slug]-[id]. */
export function threadPath(title: string, id: string): string {
  return `/t/${slugId(title, id)}`;
}

/** Turns a site-relative path into an absolute URL. */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Canonical path for a topic feed page: /topics/[slug]. */
export function topicPath(slug: string): string {
  return `/topics/${slug}`;
}
