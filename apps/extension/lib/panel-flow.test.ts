import { describe, expect, it } from "vitest";
import { EMPTY_DRAFT, flowReducer, type FlowState } from "./use-panel-flow";

const initial: FlowState = { screen: "source", draft: EMPTY_DRAFT, annotationId: null };

describe("flowReducer", () => {
  it("starts a clip with a seeded span and advances to the clip screen", () => {
    const next = flowReducer(initial, {
      type: "startClip",
      spanMs: { startMs: 240_000, endMs: 300_000 },
    });
    expect(next.screen).toBe("clip");
    expect(next.draft.spanMs).toEqual({ startMs: 240_000, endMs: 300_000 });
  });

  it("starts a clip with no seed for the paths that select afterwards", () => {
    const next = flowReducer(initial, { type: "startClip", spanMs: null });
    expect(next.screen).toBe("clip");
    expect(next.draft.spanMs).toBeNull();
  });

  it("going back from take to clip keeps the take text", () => {
    let s = flowReducer(initial, { type: "startClip", spanMs: { startMs: 0, endMs: 60_000 } });
    s = flowReducer(s, { type: "confirmSpan" });
    s = flowReducer(s, { type: "setTakeText", text: "This is exactly backwards" });
    s = flowReducer(s, { type: "back" });
    expect(s.screen).toBe("clip");
    expect(s.draft.takeText).toBe("This is exactly backwards");
  });

  it("going back from take keeps a recorded take too", () => {
    const audio = new Blob(["fake-opus"], { type: "audio/webm" });
    let s = flowReducer(initial, { type: "startClip", spanMs: { startMs: 0, endMs: 60_000 } });
    s = flowReducer(s, { type: "confirmSpan" });
    s = flowReducer(s, { type: "setTakeAudio", audio });
    s = flowReducer(s, { type: "back" });
    expect(s.draft.takeAudio).toBe(audio);
  });

  it("back from the clip screen returns to source and discards the span", () => {
    let s = flowReducer(initial, { type: "startClip", spanMs: { startMs: 0, endMs: 60_000 } });
    s = flowReducer(s, { type: "back" });
    expect(s.screen).toBe("source");
    expect(s.draft.spanMs).toBeNull();
  });

  it("never goes back from published — that clip is finished", () => {
    let s = flowReducer(initial, { type: "published", annotationId: "k9f2" });
    s = flowReducer(s, { type: "back" });
    expect(s.screen).toBe("published");
    expect(s.annotationId).toBe("k9f2");
  });

  it("confirmSpan does nothing from a screen that has no span to confirm", () => {
    const s = flowReducer(initial, { type: "confirmSpan" });
    expect(s).toEqual(initial);
  });

  it("continuing a thread returns to source with an empty draft and nothing stale", () => {
    let s = flowReducer(initial, { type: "startClip", spanMs: { startMs: 0, endMs: 60_000 } });
    s = flowReducer(s, { type: "setTakeText", text: "first take" });
    s = flowReducer(s, { type: "published", annotationId: "k9f2" });
    s = flowReducer(s, { type: "addAnotherClip" });
    expect(s.screen).toBe("source");
    expect(s.draft).toEqual(EMPTY_DRAFT);
    expect(s.annotationId).toBeNull();
  });

  it("a source change resets everything — you are on a different page now", () => {
    let s = flowReducer(initial, { type: "startClip", spanMs: { startMs: 0, endMs: 60_000 } });
    s = flowReducer(s, { type: "setTakeText", text: "about the old page" });
    s = flowReducer(s, { type: "sourceChanged" });
    expect(s).toEqual(initial);
  });

  it("keeps topics and the anonymous toggle across a back step", () => {
    let s = flowReducer(initial, { type: "startClip", spanMs: { startMs: 0, endMs: 60_000 } });
    s = flowReducer(s, { type: "confirmSpan" });
    s = flowReducer(s, { type: "setTopicIds", topicIds: ["t1"] });
    s = flowReducer(s, { type: "setAnonymous", isAnonymous: true });
    s = flowReducer(s, { type: "back" });
    expect(s.draft.topicIds).toEqual(["t1"]);
    expect(s.draft.isAnonymous).toBe(true);
  });

  it("restoring a persisted draft never resumes on published", () => {
    const s = flowReducer(initial, {
      type: "restore",
      screen: "published",
      draft: { ...EMPTY_DRAFT, takeText: "restored" },
    });
    expect(s.screen).toBe("take");
    expect(s.draft.takeText).toBe("restored");
  });

  it("does not mutate the state it is given", () => {
    const before: FlowState = { screen: "source", draft: EMPTY_DRAFT, annotationId: null };
    flowReducer(before, { type: "startClip", spanMs: { startMs: 0, endMs: 1_000 } });
    expect(before).toEqual(initial);
  });
});
