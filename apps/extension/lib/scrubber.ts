/**
 * How the clip handles move.
 *
 * The rule behind all of it: a drag can never build an invalid clip. Rather
 * than letting someone pull a handle past the 90-second ceiling and then
 * telling them off, the handle simply stops there — so Next is live the whole
 * time and the ceiling is felt rather than reported.
 *
 * Kept apart from the component because this is the part that can be wrong in
 * ways a screenshot won't show.
 */
import { MAX_CLIP_MS } from "@annotated/shared";

export interface Span {
  startMs: number;
  endMs: number;
}

export type Handle = "start" | "end";

/** Shorter than this isn't a clip, it's a mis-drag. */
export const MIN_SPAN_MS = 1_000;

export const NUDGE_MS = 1_000;
export const NUDGE_COARSE_MS = 10_000;

/** Handles land on whole seconds so the drag and the mm:ss readout agree. */
function toWholeSecond(ms: number): number {
  return Math.round(ms / 1000) * 1000;
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

/**
 * Put one handle at `toMs`, holding the other still. The moving handle is
 * bounded by the video, by the minimum clip length, and by the 90-second
 * ceiling — whichever it reaches first.
 */
export function moveHandle(span: Span, handle: Handle, toMs: number, durationMs: number): Span {
  const target = toWholeSecond(clamp(toMs, 0, durationMs));

  if (handle === "start") {
    return {
      startMs: clamp(target, Math.max(0, span.endMs - MAX_CLIP_MS), span.endMs - MIN_SPAN_MS),
      endMs: span.endMs,
    };
  }

  return {
    startMs: span.startMs,
    endMs: clamp(
      target,
      span.startMs + MIN_SPAN_MS,
      Math.min(durationMs, span.startMs + MAX_CLIP_MS),
    ),
  };
}

/** Keyboard movement — the same rules as a drag, by a fixed step. */
export function nudgeHandle(span: Span, handle: Handle, deltaMs: number, durationMs: number): Span {
  const from = handle === "start" ? span.startMs : span.endMs;
  return moveHandle(span, handle, from + deltaMs, durationMs);
}

/** Where along the video a pointer at `fraction` of the track is pointing. */
export function spanAtFraction(fraction: number, durationMs: number): number {
  if (durationMs <= 0) return 0;
  return Math.round(clamp(fraction, 0, 1) * durationMs);
}

/**
 * Slide the whole window without changing how long it is.
 *
 * This is the gesture the first build was missing: only the two handles
 * responded, so a clip could be stretched but never moved, and "grab sixty
 * seconds from over there" meant dragging both ends one at a time. Grabbing
 * the band itself now moves it, and the duration is preserved even when the
 * window runs into either end of the video.
 */
export function moveSpan(span: Span, toStartMs: number, durationMs: number): Span {
  const length = span.endMs - span.startMs;
  const latestStart = Math.max(0, durationMs - length);
  const startMs = toWholeSecond(clamp(toStartMs, 0, latestStart));
  return { startMs, endMs: startMs + length };
}

/**
 * The slice of the video the track draws.
 *
 * Drawing the whole video was unusable the moment a video got long: a 90-second
 * clip inside a 64-minute talk is 2.3% of the track — about eight pixels — and
 * the two handles sat centred on its edges, covering it completely. There was
 * no band left to grab, and one pixel of track meant eleven seconds, so no
 * precision either.
 *
 * The track now shows a window around the clip instead, sized so the clip fills
 * about a third of it. Same gestures, usable scale.
 */
export interface View {
  startMs: number;
  endMs: number;
}

/** The clip occupies roughly 1/VIEW_ZOOM of the track. */
const VIEW_ZOOM = 3;
const MIN_VIEW_MS = 30_000;

export function viewFor(span: Span, durationMs: number): View {
  const clipMs = Math.max(1_000, span.endMs - span.startMs);
  const wanted = Math.max(MIN_VIEW_MS, clipMs * VIEW_ZOOM);
  const bound = durationMs > 0 ? durationMs : wanted;
  const length = Math.min(wanted, bound);
  const centre = (span.startMs + span.endMs) / 2;
  const startMs = Math.round(clamp(centre - length / 2, 0, Math.max(0, bound - length)));
  return { startMs, endMs: startMs + length };
}

/**
 * Re-centre only once the clip reaches the edge of the window.
 *
 * Recomputing the window on every change would keep the clip permanently
 * centred — so dragging it would move the *scenery* and the band would appear
 * nailed in place. It has to stay still while the clip moves within it.
 */
export function keepInView(view: View, span: Span, durationMs: number): View {
  const margin = (view.endMs - view.startMs) * 0.1;
  const inside = span.startMs >= view.startMs + margin && span.endMs <= view.endMs - margin;
  return inside ? view : viewFor(span, durationMs);
}
