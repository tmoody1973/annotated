/**
 * Screen 1's words and its one rule, kept out of the JSX so they can be tested
 * without a renderer — and so the copy is diffable as copy.
 *
 * The dead-end wording is product voice, not filler. Change it in the spec
 * first (docs/superpowers/specs/2026-08-11-extension-experience-design.md).
 */
import type { DetectedSource } from "./use-detected-source";
import { formatClipTimestamp } from "@annotated/shared";
import type { SpanMs } from "./use-panel-flow";
import type { AuthState } from "./use-auth-state";

const SEED_WINDOW_MS = 60_000;
const WEB_URL = process.env.PLASMO_PUBLIC_WEB_URL ?? "";

export interface DeadEnd {
  body: string;
  bullets?: readonly string[];
  link?: { label: string; href: string };
}

export const DEAD_ENDS = {
  firstRun: {
    body:
      "Grab up to 90 seconds from any video, podcast or article — add your take — get a page you can paste anywhere.",
    bullets: ["Fair use, always linked back"],
  },
  detecting: {
    body: "Works on YouTube, podcast pages and articles.",
  },
  unsupported: {
    body: "This looks like a plain web page — no video, audio or article body.",
    bullets: ["YouTube videos", "Podcast episode pages", "Articles"],
    link: { label: "See what others clipped ⟶", href: `${WEB_URL}/` },
  },
  spotify: {
    body:
      "Spotify-exclusive shows don't publish an audio feed, so there's no file to clip from.",
    link: { label: "Find it on Apple Podcasts ⟶", href: "https://podcasts.apple.com/" },
  },
} as const satisfies Record<string, DeadEnd>;

/**
 * One action, pre-seeded. A playhead we could not read is never a reason to
 * disable the button — it only changes which 60 seconds we open on.
 */
export function primaryAction(
  detected: DetectedSource,
  playheadMs: number | null,
): { label: string; spanMs: SpanMs | null } {
  if (detected.kind !== "youtube") {
    return {
      label: detected.kind === "article" ? "Highlight on the page" : "Clip from the transcript",
      spanMs: null,
    };
  }
  // You cannot clip the last sixty seconds of a video you are ten seconds into.
  // Seeding from the playhead regardless produced a ten-second clip — or, if the
  // panel opened the instant playback began, a *fraction of a second* one.
  if (playheadMs === null || playheadMs < SEED_WINDOW_MS) {
    return { label: "Clip the first minute", spanMs: { startMs: 0, endMs: SEED_WINDOW_MS } };
  }
  // Name the span rather than the rule. "Clip last 60s" read as a decision made
  // on the user's behalf; "Clip 26:06–27:06" reads as a starting point they can
  // see — and the line under the button says it is adjustable.
  const spanMs = { startMs: Math.max(0, playheadMs - SEED_WINDOW_MS), endMs: playheadMs };
  return {
    label: `Clip ${formatClipTimestamp(spanMs.startMs)}–${formatClipTimestamp(spanMs.endMs)}`,
    spanMs,
  };
}

/**
 * Screen 1's heading. It lives here rather than in the router so the title and
 * the body below it are decided by one rule — they used to be able to disagree,
 * announcing "Nothing to clip on this page" over the welcome copy.
 */
export function sourceHeading(
  detected: DetectedSource,
  auth: AuthState["status"],
): string {
  if (detected.kind === "detecting") return "Looking at this page\u2026";
  if (detected.kind === "podcast" && detected.podcast.kind === "spotify") {
    return "This episode can't be clipped";
  }
  if (detected.kind === "unsupported") {
    // The auth relay answers late; until it does, neither the welcome nor the
    // dead end is known to be the right thing to say.
    if (auth === "loading") return "Looking at this page\u2026";
    return auth === "signed-out"
      ? "Clip it. Say why. Share the link."
      : "Nothing to clip on this page";
  }
  return "Choose the evidence";
}
