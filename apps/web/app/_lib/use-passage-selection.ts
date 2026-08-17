"use client";

import { useEffect } from "react";

/**
 * Reads the current text selection's character offsets within the pre-wrap
 * passage container. Offsets map 1:1 to the extracted `textContent` because the
 * container holds a single text node — which is why the panel renders the text
 * raw rather than marked up.
 */
export function readSelectionOffsets(
  container: HTMLElement
): { a: number; b: number } | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return null;
  const before = range.cloneRange();
  before.selectNodeContents(container);
  before.setEnd(range.startContainer, range.startOffset);
  const a = before.toString().length;
  return { a, b: a + range.toString().length };
}

/**
 * Watches for a passage selection and reports its offsets. Returns a teardown.
 *
 * `selectionchange` is the load-bearing listener. The panel previously listened
 * for `mouseup` alone, which a finger never fires — so highlighting an article
 * was silently impossible on a phone, the only device where clipping is
 * possible at all (there is no mobile extension). `selectionchange` is fired by
 * every gesture: mouse drag, long-press, dragging the OS selection handles, and
 * keyboard. `mouseup` stays so a desktop drag still reports the instant it ends.
 */
export function wirePassageSelection(
  container: HTMLElement,
  onChange: (offsets: { a: number; b: number }) => void
): () => void {
  const report = (): void => {
    const offsets = readSelectionOffsets(container);
    if (offsets) onChange(offsets);
  };

  document.addEventListener("selectionchange", report);
  container.addEventListener("mouseup", report);
  return () => {
    document.removeEventListener("selectionchange", report);
    container.removeEventListener("mouseup", report);
  };
}

/** React binding for `wirePassageSelection`. Re-wires when the panel changes. */
export function usePassageSelection(
  ref: React.RefObject<HTMLElement | null>,
  onChange: (offsets: { a: number; b: number }) => void,
  enabled: boolean
): void {
  useEffect(() => {
    const container = ref.current;
    if (!enabled || !container) return;
    return wirePassageSelection(container, onChange);
    // onChange is re-created each render; the caller keeps it cheap and pure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, enabled]);
}
