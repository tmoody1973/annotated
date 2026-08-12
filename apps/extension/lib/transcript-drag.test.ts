import { describe, expect, it } from "vitest";
import {
  EMPTY_SELECTION,
  isWordSelected,
  selectionReducer,
  transcribeEstimateMs,
  formatSpanDuration,
  type WordSelection,
} from "./transcript-drag";

const empty: WordSelection = EMPTY_SELECTION;

describe("dragging across words", () => {
  it("anchors on the word the pointer went down on", () => {
    const s = selectionReducer(empty, { type: "pointerDown", index: 12 });
    expect(s.anchor).toBe(12);
    expect(s.focus).toBe(12);
    expect(s.dragging).toBe(true);
  });

  it("extends as the pointer crosses further words", () => {
    let s = selectionReducer(empty, { type: "pointerDown", index: 12 });
    s = selectionReducer(s, { type: "pointerEnter", index: 18 });
    expect(s.focus).toBe(18);
  });

  it("commits on release and stops extending", () => {
    let s = selectionReducer(empty, { type: "pointerDown", index: 12 });
    s = selectionReducer(s, { type: "pointerEnter", index: 18 });
    s = selectionReducer(s, { type: "pointerUp" });
    expect(s.dragging).toBe(false);
    s = selectionReducer(s, { type: "pointerEnter", index: 40 });
    expect(s.focus).toBe(18);
  });

  it("works dragged backwards", () => {
    let s = selectionReducer(empty, { type: "pointerDown", index: 30 });
    s = selectionReducer(s, { type: "pointerEnter", index: 25 });
    s = selectionReducer(s, { type: "pointerUp" });
    expect(isWordSelected(s, 27)).toBe(true);
    expect(isWordSelected(s, 31)).toBe(false);
  });

  it("a fresh pointer-down starts a new selection rather than extending the old one", () => {
    let s = selectionReducer(empty, { type: "pointerDown", index: 10 });
    s = selectionReducer(s, { type: "pointerEnter", index: 20 });
    s = selectionReducer(s, { type: "pointerUp" });
    s = selectionReducer(s, { type: "pointerDown", index: 50 });
    expect(s.anchor).toBe(50);
    expect(s.focus).toBe(50);
    expect(isWordSelected(s, 15)).toBe(false);
  });
});

describe("tapping, the touch and trackpad fallback", () => {
  it("a press and release on one word is a tap, not a one-word clip", () => {
    let s = selectionReducer(empty, { type: "pointerDown", index: 5 });
    s = selectionReducer(s, { type: "pointerUp" });
    expect(s.settled).toBe(false);
    s = selectionReducer(s, { type: "pointerDown", index: 9 });
    expect(s.settled).toBe(true);
    expect(isWordSelected(s, 7)).toBe(true);
  });

  it("closes the pair on release too, so the range does not keep following", () => {
    let s = selectionReducer(empty, { type: "pointerDown", index: 5 });
    s = selectionReducer(s, { type: "pointerUp" });
    s = selectionReducer(s, { type: "pointerDown", index: 9 });
    s = selectionReducer(s, { type: "pointerUp" });
    s = selectionReducer(s, { type: "pointerEnter", index: 40 });
    expect(s.focus).toBe(9);
  });

  it("first tap sets the start, second sets the end", () => {
    let s = selectionReducer(empty, { type: "tap", index: 5 });
    expect(s.focus).toBe(5);
    s = selectionReducer(s, { type: "tap", index: 9 });
    expect(isWordSelected(s, 7)).toBe(true);
  });

  it("a third tap starts over", () => {
    let s = selectionReducer(empty, { type: "tap", index: 5 });
    s = selectionReducer(s, { type: "tap", index: 9 });
    s = selectionReducer(s, { type: "tap", index: 20 });
    expect(s.anchor).toBe(20);
    expect(isWordSelected(s, 7)).toBe(false);
  });

  it("a tap after a drag starts a new selection, not a third point", () => {
    let s = selectionReducer(empty, { type: "pointerDown", index: 5 });
    s = selectionReducer(s, { type: "pointerEnter", index: 9 });
    s = selectionReducer(s, { type: "pointerUp" });
    s = selectionReducer(s, { type: "tap", index: 30 });
    expect(s.anchor).toBe(30);
    expect(isWordSelected(s, 7)).toBe(false);
  });
});

describe("keyboard", () => {
  it("Enter sets the start, Enter again sets the end", () => {
    let s = selectionReducer(empty, { type: "tap", index: 3 });
    s = selectionReducer(s, { type: "tap", index: 8 });
    expect(isWordSelected(s, 5)).toBe(true);
  });

  it("Escape clears everything", () => {
    let s = selectionReducer(empty, { type: "tap", index: 3 });
    s = selectionReducer(s, { type: "tap", index: 8 });
    s = selectionReducer(s, { type: "clear" });
    expect(s).toEqual(EMPTY_SELECTION);
  });
});

describe("isWordSelected", () => {
  it("selects nothing when nothing is anchored", () => {
    expect(isWordSelected(empty, 0)).toBe(false);
  });

  it("includes both ends of the range", () => {
    let s = selectionReducer(empty, { type: "pointerDown", index: 4 });
    s = selectionReducer(s, { type: "pointerEnter", index: 6 });
    expect(isWordSelected(s, 4)).toBe(true);
    expect(isWordSelected(s, 6)).toBe(true);
  });
});

describe("transcribeEstimateMs", () => {
  it("scales with the episode length — about 0.75s per minute of audio", () => {
    expect(transcribeEstimateMs(48 * 60_000)).toBe(36_000);
  });

  it("falls back to a flat estimate when the length is unknown", () => {
    expect(transcribeEstimateMs(null)).toBe(40_000);
    expect(transcribeEstimateMs(0)).toBe(40_000);
  });

  it("never promises an implausibly fast turnaround for a short clip", () => {
    expect(transcribeEstimateMs(60_000)).toBeGreaterThanOrEqual(10_000);
  });
});

describe("formatSpanDuration", () => {
  it("says a one-word selection is short rather than reporting zero", () => {
    expect(formatSpanDuration(480)).toBe("under a second");
  });

  it("formats anything a second or longer as a clock", () => {
    expect(formatSpanDuration(1_000)).toBe("0:01");
    expect(formatSpanDuration(64_000)).toBe("1:04");
  });
});
