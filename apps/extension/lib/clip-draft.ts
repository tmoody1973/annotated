/**
 * Persists an in-progress clip per source to `chrome.storage.session`, so
 * switching browser tabs — which unmounts the panel bound to the active tab —
 * doesn't drop the span, the take, the topics or the anonymous toggle.
 *
 * Since the four-screen rebuild it also remembers *where* the user was, so
 * coming back restores position as well as content. Returning to a finished
 * clip is not a thing you can resume, so a restored draft always lands on a
 * screen it can be finished from.
 *
 * Session storage clears when the browser closes: a draft is a within-session
 * convenience, not durable state. The recorded audio blob is deliberately not
 * persisted (a Blob isn't JSON), so only the typed take survives a tab switch.
 */
import type { Draft, Screen } from "./use-panel-flow";

export interface StoredDraft {
  screen: Screen;
  spanMs: { startMs: number; endMs: number } | null;
  selectedText: string | null;
  textRange: { start: number; end: number } | null;
  sourceId: string | null;
  takeText: string;
  topicIds: string[];
  isAnonymous: boolean;
}

/** Nothing worth restoring: no evidence chosen, nothing written, nothing set. */
export function isEmptyDraft(draft: StoredDraft): boolean {
  return (
    draft.spanMs === null &&
    (draft.selectedText ?? "").trim() === "" &&
    draft.takeText.trim() === "" &&
    draft.topicIds.length === 0 &&
    !draft.isAnonymous
  );
}

/** A restored draft resumes where it can be finished — never on `published`. */
export function resumableScreen(screen: Screen): Screen {
  return screen === "published" || screen === "source" ? "clip" : screen;
}

export function toStored(screen: Screen, draft: Draft): StoredDraft {
  return {
    screen,
    spanMs: draft.spanMs,
    selectedText: draft.selectedText,
    textRange: draft.textRange,
    sourceId: draft.sourceId,
    takeText: draft.takeText,
    topicIds: draft.topicIds,
    isAnonymous: draft.isAnonymous,
  };
}

export function fromStored(stored: StoredDraft): Draft {
  return {
    spanMs: stored.spanMs,
    selectedText: stored.selectedText,
    textRange: stored.textRange,
    sourceId: stored.sourceId,
    takeText: stored.takeText,
    takeAudio: null,
    topicIds: stored.topicIds,
    isAnonymous: stored.isAnonymous,
  };
}

function draftKey(sourceKey: string): string {
  return `clip-draft:${sourceKey}`;
}

export async function loadDraft(sourceKey: string): Promise<StoredDraft | null> {
  try {
    const key = draftKey(sourceKey);
    const stored = await chrome.storage.session.get(key);
    return (stored[key] as StoredDraft | undefined) ?? null;
  } catch {
    return null;
  }
}

/** Saves the draft, or removes the key entirely when there is nothing in it. */
export async function saveDraft(sourceKey: string, draft: StoredDraft): Promise<void> {
  try {
    const key = draftKey(sourceKey);
    if (isEmptyDraft(draft)) await chrome.storage.session.remove(key);
    else await chrome.storage.session.set({ [key]: draft });
  } catch {
    // Persistence is best-effort — a storage failure must never block clipping.
  }
}

export async function clearDraft(sourceKey: string): Promise<void> {
  try {
    await chrome.storage.session.remove(draftKey(sourceKey));
  } catch {
    // Best-effort cleanup.
  }
}
