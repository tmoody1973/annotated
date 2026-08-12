import { describe, expect, it } from "vitest";
import { MAX_CLIP_MS } from "@annotated/shared";
import { MIN_SPAN_MS, NUDGE_MS, NUDGE_COARSE_MS, moveHandle, moveSpan, nudgeHandle, spanAtFraction, viewFor, keepInView } from "./scrubber";

const DURATION = 600_000; // a ten-minute video
const span = { startMs: 120_000, endMs: 180_000 };

describe("moveHandle", () => {
  it("moves the start handle to where it was dropped", () => {
    expect(moveHandle(span, "start", 90_000, DURATION)).toEqual({
      startMs: 90_000,
      endMs: 180_000,
    });
  });

  it("moves the end handle to where it was dropped", () => {
    expect(moveHandle(span, "end", 200_000, DURATION)).toEqual({
      startMs: 120_000,
      endMs: 200_000,
    });
  });

  it("never lets the handles cross", () => {
    const crossed = moveHandle(span, "start", 500_000, DURATION);
    expect(crossed.startMs).toBeLessThan(crossed.endMs);
    expect(crossed.endMs).toBe(180_000);
  });

  it("keeps at least a one-second clip", () => {
    const tight = moveHandle(span, "end", 0, DURATION);
    expect(tight.endMs - tight.startMs).toBe(MIN_SPAN_MS);
  });

  it("stops the start handle at the 90-second ceiling instead of allowing it past", () => {
    const wide = moveHandle(span, "start", 0, DURATION);
    expect(wide.endMs - wide.startMs).toBe(MAX_CLIP_MS);
    expect(wide.startMs).toBe(180_000 - MAX_CLIP_MS);
  });

  it("stops the end handle at the 90-second ceiling too", () => {
    const wide = moveHandle(span, "end", DURATION, DURATION);
    expect(wide.endMs - wide.startMs).toBe(MAX_CLIP_MS);
  });

  it("never runs off either end of the video", () => {
    const early = moveHandle({ startMs: 0, endMs: 30_000 }, "start", -50_000, DURATION);
    expect(early.startMs).toBe(0);
    // Start late enough that the video's end binds before the 90s ceiling does.
    const late = moveHandle({ startMs: 560_000, endMs: 570_000 }, "end", DURATION + 9_000, DURATION);
    expect(late.endMs).toBe(DURATION);
  });

  it("stops at the 90-second ceiling when it binds before the video's end", () => {
    const capped = moveHandle({ startMs: 500_000, endMs: 540_000 }, "end", DURATION, DURATION);
    expect(capped.endMs).toBe(500_000 + MAX_CLIP_MS);
  });

  it("snaps to whole seconds, so the readout and the handle agree", () => {
    const snapped = moveHandle(span, "start", 90_400, DURATION);
    expect(snapped.startMs % 1000).toBe(0);
  });
});

describe("nudgeHandle", () => {
  it("moves a second per arrow key", () => {
    expect(nudgeHandle(span, "start", NUDGE_MS, DURATION).startMs).toBe(121_000);
    expect(nudgeHandle(span, "start", -NUDGE_MS, DURATION).startMs).toBe(119_000);
  });

  it("moves ten seconds with shift held", () => {
    expect(nudgeHandle(span, "end", NUDGE_COARSE_MS, DURATION).endMs).toBe(190_000);
  });

  it("obeys the same ceilings as a drag", () => {
    const atCeiling = { startMs: 100_000, endMs: 100_000 + MAX_CLIP_MS };
    expect(nudgeHandle(atCeiling, "start", -NUDGE_COARSE_MS, DURATION)).toEqual(atCeiling);
  });
});

describe("spanAtFraction", () => {
  it("maps a click halfway along the track to halfway through the video", () => {
    expect(spanAtFraction(0.5, DURATION)).toBe(300_000);
  });

  it("tolerates a pointer dragged outside the track", () => {
    expect(spanAtFraction(-0.4, DURATION)).toBe(0);
    expect(spanAtFraction(1.9, DURATION)).toBe(DURATION);
  });

  it("returns zero for a video whose duration is not known yet", () => {
    expect(spanAtFraction(0.5, 0)).toBe(0);
  });
});

describe("moveSpan", () => {
  const sixty = { startMs: 120_000, endMs: 180_000 };

  it("slides the window without resizing it", () => {
    const moved = moveSpan(sixty, 300_000, DURATION);
    expect(moved).toEqual({ startMs: 300_000, endMs: 360_000 });
  });

  it("keeps the duration when it runs into the start of the video", () => {
    const moved = moveSpan(sixty, -40_000, DURATION);
    expect(moved.startMs).toBe(0);
    expect(moved.endMs - moved.startMs).toBe(60_000);
  });

  it("keeps the duration when it runs into the end of the video", () => {
    const moved = moveSpan(sixty, DURATION, DURATION);
    expect(moved.endMs).toBe(DURATION);
    expect(moved.endMs - moved.startMs).toBe(60_000);
  });

  it("does not resize a window longer than the video itself", () => {
    const moved = moveSpan({ startMs: 0, endMs: 90_000 }, 10_000, 45_000);
    expect(moved.endMs - moved.startMs).toBe(90_000);
    expect(moved.startMs).toBe(0);
  });

  it("snaps to whole seconds like every other movement", () => {
    expect(moveSpan(sixty, 300_400, DURATION).startMs % 1000).toBe(0);
  });
});

describe("viewFor", () => {
  it("zooms so the clip fills about a third of the track", () => {
    const view = viewFor({ startMs: 1_084_000, endMs: 1_174_000 }, 3_860_000);
    const clipShare = 90_000 / (view.endMs - view.startMs);
    expect(clipShare).toBeGreaterThan(0.25);
    expect(clipShare).toBeLessThan(0.4);
  });

  it("centres the window on the clip", () => {
    const view = viewFor({ startMs: 1_084_000, endMs: 1_174_000 }, 3_860_000);
    const clipCentre = (1_084_000 + 1_174_000) / 2;
    const viewCentre = (view.startMs + view.endMs) / 2;
    expect(Math.abs(clipCentre - viewCentre)).toBeLessThan(1_000);
  });

  it("never runs off the front of the video", () => {
    const view = viewFor({ startMs: 0, endMs: 90_000 }, 3_860_000);
    expect(view.startMs).toBe(0);
  });

  it("never runs off the end of the video", () => {
    const view = viewFor({ startMs: 3_770_000, endMs: 3_860_000 }, 3_860_000);
    expect(view.endMs).toBeLessThanOrEqual(3_860_000);
  });

  it("shows the whole of a video shorter than the window", () => {
    const view = viewFor({ startMs: 0, endMs: 20_000 }, 25_000);
    expect(view).toEqual({ startMs: 0, endMs: 25_000 });
  });

  it("keeps the clip inside the window it produces", () => {
    for (const start of [0, 60_000, 1_800_000, 3_770_000]) {
      const span = { startMs: start, endMs: start + 90_000 };
      const view = viewFor(span, 3_860_000);
      expect(span.startMs, `start ${start}`).toBeGreaterThanOrEqual(view.startMs);
      expect(span.endMs, `start ${start}`).toBeLessThanOrEqual(view.endMs);
    }
  });
});

describe("keepInView", () => {
  const duration = 3_860_000;

  it("holds the window still while the clip moves within it", () => {
    const span = { startMs: 1_084_000, endMs: 1_174_000 };
    const view = viewFor(span, duration);
    const nudged = { startMs: span.startMs + 5_000, endMs: span.endMs + 5_000 };
    expect(keepInView(view, nudged, duration)).toEqual(view);
  });

  it("re-centres once the clip reaches the edge", () => {
    const span = { startMs: 1_084_000, endMs: 1_174_000 };
    const view = viewFor(span, duration);
    const far = { startMs: view.endMs - 10_000, endMs: view.endMs + 80_000 };
    const moved = keepInView(view, far, duration);
    expect(moved).not.toEqual(view);
    expect(far.endMs).toBeLessThanOrEqual(moved.endMs);
  });
});
