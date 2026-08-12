/**
 * Selecting a passage of transcript.
 *
 * Drag is the specified interaction and the one the product is built around:
 * pull across the words you want and let go. Tap-to-start / tap-to-end stays as
 * an equal fallback, because a drag is hostile on touch and awkward on a
 * trackpad, and the keyboard path (Enter, Enter, Escape) goes through the same
 * two actions — so all three produce identical state and none is a second-class
 * citizen with its own bugs.
 *
 * `anchor` is where the selection began; `focus` is its moving end. Neither is
 * ordered — a backwards drag is normal.
 */
import { formatClipTimestamp } from "@annotated/shared";

export interface WordSelection {
  anchor: number | null;
  focus: number | null;
  /** True between pointer-down and pointer-up, while the range still follows. */
  dragging: boolean;
  /** True once a range is settled, so the next tap starts over rather than extending. */
  settled: boolean;
}

export type SelectionAction =
  | { type: "pointerDown"; index: number }
  | { type: "pointerEnter"; index: number }
  | { type: "pointerUp" }
  | { type: "tap"; index: number }
  | { type: "clear" };

export const EMPTY_SELECTION: WordSelection = {
  anchor: null,
  focus: null,
  dragging: false,
  settled: false,
};

export function selectionReducer(state: WordSelection, action: SelectionAction): WordSelection {
  switch (action.type) {
    // A press is the second half of a tap-pair when one is pending; otherwise it
    // begins a new range. Drag and tap share these two events on purpose — a
    // click *is* a pointer-down and pointer-up on one word, so handling taps
    // separately made every click restart the selection at one word.
    case "pointerDown":
      if (state.anchor !== null && !state.settled && !state.dragging) {
        return { ...state, focus: action.index, settled: true };
      }
      return { anchor: action.index, focus: action.index, dragging: true, settled: false };

    case "pointerEnter":
      return state.dragging ? { ...state, focus: action.index } : state;

    // Released without ever leaving the first word: that was a tap, and the
    // range stays open for the tap that closes it.
    case "pointerUp":
      if (!state.dragging) return state;
      return { ...state, dragging: false, settled: state.focus !== state.anchor };

    // Tap one: anchor. Tap two: complete. Tap three: start over — including
    // after a drag, so the two interactions never interleave into a third point.
    case "tap":
      if (state.anchor === null || state.settled) {
        return { anchor: action.index, focus: action.index, dragging: false, settled: false };
      }
      return { ...state, focus: action.index, dragging: false, settled: true };

    case "clear":
      return EMPTY_SELECTION;
  }
}

export function isWordSelected(state: WordSelection, index: number): boolean {
  if (state.anchor === null || state.focus === null) return false;
  const low = Math.min(state.anchor, state.focus);
  const high = Math.max(state.anchor, state.focus);
  return index >= low && index <= high;
}

/** Deepgram runs at roughly 0.75 seconds per minute of audio, measured. */
const MS_PER_MINUTE_OF_AUDIO = 750;
const UNKNOWN_LENGTH_ESTIMATE_MS = 40_000;
const FLOOR_MS = 10_000;

/**
 * How long to tell the user the wait will be. An estimate scaled to the episode
 * is worth the arithmetic: a bare spinner on a 48-minute episode is the podcast
 * path's biggest threat to the 90-second target.
 */
export function transcribeEstimateMs(episodeDurationMs: number | null): number {
  if (!episodeDurationMs || episodeDurationMs <= 0) return UNKNOWN_LENGTH_ESTIMATE_MS;
  const minutes = episodeDurationMs / 60_000;
  return Math.max(FLOOR_MS, Math.round(minutes * MS_PER_MINUTE_OF_AUDIO));
}

/**
 * How long the selected passage reads as. `formatClipTimestamp` floors to whole
 * seconds, so a one-word selection renders as "0:00" — which sits next to a live
 * Next button and reads as broken rather than as short.
 */
export function formatSpanDuration(durationMs: number): string {
  if (durationMs < 1_000) return "under a second";
  return formatClipTimestamp(durationMs);
}
