import { describe, expect, it, vi } from "vitest";
import { readSelectionOffsets } from "./use-passage-selection";

/** Builds a container holding one text node, as the composer's passage panel does. */
function panel(text: string): HTMLDivElement {
  const el = document.createElement("div");
  el.textContent = text;
  document.body.appendChild(el);
  return el;
}

function select(node: Node, start: number, end: number): void {
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
}

describe("readSelectionOffsets", () => {
  it("reads the offsets of a selection inside the container", () => {
    const el = panel("The board approved the site plans on Monday night.");
    select(el.firstChild!, 4, 20);
    expect(readSelectionOffsets(el)).toEqual({ a: 4, b: 20 });
  });

  it("ignores a collapsed selection", () => {
    const el = panel("The board approved the site plans.");
    select(el.firstChild!, 8, 8);
    expect(readSelectionOffsets(el)).toBeNull();
  });

  it("ignores a selection made outside the container", () => {
    const el = panel("Inside the panel.");
    const other = panel("Somewhere else on the page.");
    select(other.firstChild!, 0, 9);
    expect(readSelectionOffsets(el)).toBeNull();
  });

  it("survives a selection with no ranges at all", () => {
    const el = panel("Nothing selected.");
    window.getSelection()!.removeAllRanges();
    expect(readSelectionOffsets(el)).toBeNull();
  });
});

describe("touch selection", () => {
  it("is seen by selectionchange, which is the only event a finger fires", async () => {
    // The bug this replaces: the panel listened for mouseup only, so a phone
    // selection — which produces no mouseup — was invisible and the quote never
    // registered. selectionchange is what the OS fires for every gesture.
    const { wirePassageSelection } = await import("./use-passage-selection");
    const el = panel("The village board unanimously approved the site plans.");
    const seen: { a: number; b: number }[] = [];
    const teardown = wirePassageSelection(el, (offsets) => seen.push(offsets));

    select(el.firstChild!, 12, 17);
    document.dispatchEvent(new Event("selectionchange"));

    expect(seen).toEqual([{ a: 12, b: 17 }]);
    teardown();

    // After teardown the page stops listening, so a later selection is ignored.
    select(el.firstChild!, 0, 3);
    document.dispatchEvent(new Event("selectionchange"));
    expect(seen).toHaveLength(1);
  });

  it("does not fire for a selection that isn't in the panel", async () => {
    const { wirePassageSelection } = await import("./use-passage-selection");
    const el = panel("The panel.");
    const other = panel("A comment box.");
    const onChange = vi.fn();
    const teardown = wirePassageSelection(el, onChange);

    select(other.firstChild!, 2, 9);
    document.dispatchEvent(new Event("selectionchange"));

    expect(onChange).not.toHaveBeenCalled();
    teardown();
  });
});
