"use client";

// Client-only signals (localStorage) coordinating the post-first-clip extension
// toast across a route change: the modal publishes then navigates to /a/[id],
// where the global toast reads the pending flag.
const HAS_PUBLISHED = "annotated:has-published";
const TOAST_PENDING = "annotated:ext-toast-pending";
const TOAST_DISMISSED = "annotated:ext-toast-dismissed";
const SHOW_EVENT = "annotated:show-ext-toast";

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* localStorage unavailable (private mode / SSR) — degrade silently */
  }
}

/** Call right after a manual (paste) publish. On the user's first one — and only
 *  if they haven't permanently dismissed the toast — it arms the toast and
 *  signals any mounted listener to show it. No-op on every publish after. */
export function markManualPublish(): void {
  if (safeGet(HAS_PUBLISHED)) return;
  safeSet(HAS_PUBLISHED, "1");
  if (safeGet(TOAST_DISMISSED)) return;
  safeSet(TOAST_PENDING, "1");
  try {
    window.dispatchEvent(new Event(SHOW_EVENT));
  } catch {
    /* no window — ignore */
  }
}

/** Reads and clears the pending flag; true only if the toast should show now. */
export function consumeToastPending(): boolean {
  if (safeGet(TOAST_DISMISSED)) return false;
  if (safeGet(TOAST_PENDING) !== "1") return false;
  try {
    localStorage.removeItem(TOAST_PENDING);
  } catch {
    /* ignore */
  }
  return true;
}

/** Permanently suppress the toast (the user chose "Not now"). */
export function dismissExtensionToast(): void {
  safeSet(TOAST_DISMISSED, "1");
}

export const EXTENSION_TOAST_EVENT = SHOW_EVENT;
