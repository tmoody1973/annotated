import { describe, expect, it } from "vitest";
import { MAX_CLIP_MS } from "@annotated/shared";
import { MIN_SPAN_MS, NUDGE_MS, NUDGE_COARSE_MS, moveHandle, nudgeHandle, spanAtFraction } from "./scrubber";

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
