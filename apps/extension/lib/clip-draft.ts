/**
 * Persists an in-progress YouTube clip per video to `chrome.storage.session`, so
 * switching browser tabs (which unmounts the composer bound to the active tab)
 * doesn't drop the in/out points, the take, topics, or the anonymous toggle.
 *
 * Session storage is cleared when the browser closes — a draft is a within-session
 * convenience, not durable state. The recorded-audio blob is intentionally not
 * persisted (Blobs aren't JSON-serializable); only the typed take survives a
 * tab switch.
 */

export interface ClipDraft {
  startInput: string;
  endInput: string;
  commentary: string;
  topicIds: string[];
  isAnonymous: boolean;
}

export const EMPTY_CLIP_DRAFT: ClipDraft = {
  startInput: "",
  endInput: "",
  commentary: "",
  topicIds: [],
  isAnonymous: false,
};

/** A draft worth persisting has at least one field the user actually set. */
export function isEmptyClipDraft(draft: ClipDraft): boolean {
  return (
    draft.startInput.trim() === "" &&
    draft.endInput.trim() === "" &&
    draft.commentary.trim() === "" &&
    draft.topicIds.length === 0 &&
    !draft.isAnonymous
  );
}

function draftKey(videoId: string): string {
  return `clip-draft:${videoId}`;
}

export async function loadClipDraft(videoId: string): Promise<ClipDraft | null> {
  const key = draftKey(videoId);
  try {
    const stored = await chrome.storage.session.get(key);
    return (stored[key] as ClipDraft | undefined) ?? null;
  } catch {
    return null;
  }
}

/** Saves the draft, or removes the key entirely when the draft is empty. */
export async function saveClipDraft(videoId: string, draft: ClipDraft): Promise<void> {
  const key = draftKey(videoId);
  try {
    if (isEmptyClipDraft(draft)) {
      await chrome.storage.session.remove(key);
    } else {
      await chrome.storage.session.set({ [key]: draft });
    }
  } catch {
    // Persistence is best-effort — a storage failure must never block clipping.
  }
}

export async function clearClipDraft(videoId: string): Promise<void> {
  try {
    await chrome.storage.session.remove(draftKey(videoId));
  } catch {
    // Best-effort cleanup.
  }
}
