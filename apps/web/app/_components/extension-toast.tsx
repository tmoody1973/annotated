"use client";

import { useCallback, useEffect, useState } from "react";
import { ExtensionCta } from "./extension-cta";
import { useBrowserInfo } from "../_lib/use-browser-info";
import {
  consumeToastPending,
  dismissExtensionToast,
  EXTENSION_TOAST_EVENT,
} from "../_lib/extension-nudge";

const AUTO_DISMISS_MS = 12_000;

/** Non-blocking toast shown bottom-right right after a user's first manual clip:
 *  peak intent to pitch the extension. Softens off on mobile/Safari, auto-
 *  dismisses, and "Not now" suppresses it for good. Mounted once in AppShell. */
export function ExtensionToast() {
  const browser = useBrowserInfo();
  const [armed, setArmed] = useState(false);
  const [visible, setVisible] = useState(false);

  // Consume the pending flag into component state immediately (mount + event),
  // but defer the actual reveal until browser detection has resolved — reading
  // `supported` too early would discard the toast before we know the browser.
  const check = useCallback(() => {
    if (consumeToastPending()) setArmed(true);
  }, []);

  useEffect(() => {
    check();
    window.addEventListener(EXTENSION_TOAST_EVENT, check);
    return () => window.removeEventListener(EXTENSION_TOAST_EVENT, check);
  }, [check]);

  useEffect(() => {
    // Once detection is in, show only on installable browsers (soften on
    // mobile/Safari by staying armed-but-hidden).
    if (armed && browser.detected && browser.supported) setVisible(true);
  }, [armed, browser.detected, browser.supported]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  function dismissForGood() {
    dismissExtensionToast();
    setVisible(false);
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 right-5 z-[120] flex max-w-[420px] items-start gap-3.5 border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-chrome)] p-4 text-[color:var(--b-card)] shadow-[7px_7px_0_0_var(--b-shadow)]"
    >
      <span className="flex h-10 w-10 flex-none items-center justify-center border-2 border-[color:var(--b-line)] bg-[color:var(--b-acid)] font-display text-xl text-[color:var(--b-acid-ink)]">
        A
      </span>
      <div className="min-w-0">
        <h4 className="font-display text-[15px] leading-tight">Nice — first clip published.</h4>
        <p className="mt-1 text-[13px] leading-snug text-[color:var(--b-dim-onbg)]">
          Next time, skip the paste. Clip straight from any page with the extension.
        </p>
        <div className="mt-3 flex items-center gap-2.5">
          <ExtensionCta
            href={browser.storeUrl}
            ariaLabel={browser.label}
            className="bg-[color:var(--b-acid)] px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wide text-[color:var(--b-acid-ink)]"
          >
            ⊕ {browser.label}
          </ExtensionCta>
          <button
            onClick={dismissForGood}
            className="px-2 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wide text-[color:var(--b-dim-onbg)] hover:text-[color:var(--b-card)]"
          >
            Not now
          </button>
        </div>
      </div>
      <button
        onClick={() => setVisible(false)}
        aria-label="Dismiss"
        className="ml-1 flex-none text-lg font-black leading-none text-[color:var(--b-dim-onbg)] hover:text-[color:var(--b-card)]"
      >
        ×
      </button>
    </div>
  );
}
