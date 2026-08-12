import { describe, expect, it } from "vitest";
import { EMPTY_DRAFT } from "./use-panel-flow";
import { fromStored, isEmptyDraft, resumableScreen, toStored } from "./clip-draft";

describe("resumableScreen", () => {
  it("never resumes on published — that clip is finished", () => {
    expect(resumableScreen("published")).toBe("clip");
  });

  it("resumes the clip and take screens where they were left", () => {
    expect(resumableScreen("clip")).toBe("clip");
    expect(resumableScreen("take")).toBe("take");
  });

  it("sends a source-screen draft to the clip screen — there is work to resume", () => {
    expect(resumableScreen("source")).toBe("clip");
  });
});

describe("round-tripping a draft", () => {
  it("keeps the span, the quote, its offsets and the take", () => {
    const draft = {
      ...EMPTY_DRAFT,
      spanMs: { startMs: 4_000, endMs: 64_000 },
      selectedText: "a quote",
      textRange: { start: 120, end: 127 },
      sourceId: "src_1",
      takeText: "the take",
      topicIds: ["t1"],
      isAnonymous: true,
    };
    expect(fromStored(toStored("take", draft))).toEqual(draft);
  });

  it("drops the recorded blob, which cannot survive JSON", () => {
    const withAudio = { ...EMPTY_DRAFT, takeAudio: new Blob(["x"]), takeText: "kept" };
    const restored = fromStored(toStored("take", withAudio));
    expect(restored.takeAudio).toBeNull();
    expect(restored.takeText).toBe("kept");
  });
});

describe("isEmptyDraft", () => {
  it("treats an untouched draft as not worth storing", () => {
    expect(isEmptyDraft(toStored("clip", EMPTY_DRAFT))).toBe(true);
  });

  it("stores a draft with only a span", () => {
    const spanOnly = { ...EMPTY_DRAFT, spanMs: { startMs: 0, endMs: 1_000 } };
    expect(isEmptyDraft(toStored("clip", spanOnly))).toBe(false);
  });

  it("stores a draft with only whitespace-free typed text", () => {
    expect(isEmptyDraft(toStored("take", { ...EMPTY_DRAFT, takeText: "  " }))).toBe(true);
    expect(isEmptyDraft(toStored("take", { ...EMPTY_DRAFT, takeText: "x" }))).toBe(false);
  });
});
