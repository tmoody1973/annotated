/**
 * The side panel's flow: Source → Clip → Take → Published.
 *
 * The panel used to be one long scroll with no stages, which is why it had no
 * back button, no orientation and no finish line. Everything visual in the
 * four-screen rebuild hangs off this machine.
 *
 * The reducer is pure — it never touches chrome.storage. `usePanelFlow`
 * persists through `clip-draft.ts` in an effect, so the transitions stay
 * testable without a browser.
 */
import { useCallback, useMemo, useReducer } from "react";

export type Screen = "source" | "clip" | "take" | "published";

export interface SpanMs {
  startMs: number;
  endMs: number;
}

export interface TextRange {
  start: number;
  end: number;
}

export interface Draft {
  spanMs: SpanMs | null;
  selectedText: string | null;
  /**
   * Character offsets of `selectedText` within the extracted article text. The
   * publish path needs them verbatim — deriving them from the quote's length
   * would place every quote at the top of the article.
   */
  textRange: TextRange | null;
  /** The resolved podcast episode this clip came from, once known. */
  sourceId: string | null;
  takeText: string;
  takeAudio: Blob | null;
  topicIds: string[];
  isAnonymous: boolean;
}

export interface FlowState {
  screen: Screen;
  draft: Draft;
  annotationId: string | null;
}

export type FlowAction =
  | { type: "startClip"; spanMs: SpanMs | null }
  | { type: "setSpan"; spanMs: SpanMs | null }
  | { type: "setPodcastSelection"; quote: string; spanMs: SpanMs; sourceId: string }
  | { type: "setSelectedText"; selectedText: string | null; textRange?: TextRange | null }
  | { type: "confirmSpan" }
  | { type: "setTakeText"; text: string }
  | { type: "setTakeAudio"; audio: Blob | null }
  | { type: "setTopicIds"; topicIds: string[] }
  | { type: "setAnonymous"; isAnonymous: boolean }
  | { type: "published"; annotationId: string }
  | { type: "addAnotherClip" }
  | { type: "sourceChanged" }
  | { type: "restore"; screen: Screen; draft: Draft }
  | { type: "back" };

export const EMPTY_DRAFT: Draft = {
  spanMs: null,
  selectedText: null,
  textRange: null,
  sourceId: null,
  takeText: "",
  takeAudio: null,
  topicIds: [],
  isAnonymous: false,
};

export const INITIAL_FLOW: FlowState = {
  screen: "source",
  draft: EMPTY_DRAFT,
  annotationId: null,
};

/**
 * Back is deliberately asymmetric. Leaving the clip screen discards the span,
 * because going back there means "I picked the wrong evidence". Leaving the
 * take screen keeps every word, because nothing the user typed may ever be
 * destroyed by navigation. Published has no back — that clip is finished.
 */
function goBack(state: FlowState): FlowState {
  switch (state.screen) {
    case "clip":
      return { ...state, screen: "source", draft: { ...state.draft, spanMs: null } };
    case "take":
      return { ...state, screen: "clip" };
    case "source":
    case "published":
      return state;
  }
}

export function flowReducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case "startClip":
      return { ...state, screen: "clip", draft: { ...state.draft, spanMs: action.spanMs } };

    case "setSpan":
      return { ...state, draft: { ...state.draft, spanMs: action.spanMs } };

    case "setPodcastSelection":
      return {
        ...state,
        draft: {
          ...state.draft,
          selectedText: action.quote,
          spanMs: action.spanMs,
          sourceId: action.sourceId,
        },
      };

    case "setSelectedText":
      return {
        ...state,
        draft: {
          ...state.draft,
          selectedText: action.selectedText,
          textRange: action.textRange ?? null,
        },
      };

    case "confirmSpan":
      return state.screen === "clip" ? { ...state, screen: "take" } : state;

    case "setTakeText":
      return { ...state, draft: { ...state.draft, takeText: action.text } };

    case "setTakeAudio":
      return { ...state, draft: { ...state.draft, takeAudio: action.audio } };

    case "setTopicIds":
      return { ...state, draft: { ...state.draft, topicIds: action.topicIds } };

    case "setAnonymous":
      return { ...state, draft: { ...state.draft, isAnonymous: action.isAnonymous } };

    case "published":
      return { ...state, screen: "published", annotationId: action.annotationId };

    // The thread id lives outside this machine; the caller carries it forward.
    case "addAnotherClip":
      return { screen: "source", draft: EMPTY_DRAFT, annotationId: null };

    case "sourceChanged":
      return INITIAL_FLOW;

    // A persisted draft can only resume somewhere it can be finished from.
    case "restore":
      return {
        screen: action.screen === "published" ? "take" : action.screen,
        draft: action.draft,
        annotationId: null,
      };

    case "back":
      return goBack(state);
  }
}

export interface PanelFlow extends FlowState {
  dispatch: (action: FlowAction) => void;
  canGoBack: boolean;
}

export function usePanelFlow(initial: FlowState = INITIAL_FLOW): PanelFlow {
  const [state, rawDispatch] = useReducer(flowReducer, initial);
  const dispatch = useCallback((action: FlowAction) => rawDispatch(action), []);

  return useMemo(
    () => ({
      ...state,
      dispatch,
      canGoBack: state.screen === "clip" || state.screen === "take",
    }),
    [state, dispatch],
  );
}
