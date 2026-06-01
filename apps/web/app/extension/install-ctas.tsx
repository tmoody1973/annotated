"use client";

import { useBrowserInfo } from "../_lib/use-browser-info";
import { ExtensionCta } from "../_components/extension-cta";

/** The sideload package served from /public (the with-key build, so the
 *  unpacked extension id matches the one whitelisted in Clerk). */
export const DOWNLOAD_URL = "/annotated-extension-chrome.zip";

const ctaClass =
  "inline-flex items-center gap-2 border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-chrome)] px-6 py-4 font-display text-[15px] uppercase tracking-wide text-[color:var(--b-acid)] shadow-[6px_6px_0_0_var(--b-acid)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[3px_3px_0_0_var(--b-acid)]";

/** True once the real Chrome Web Store link is configured (NEXT_PUBLIC_EXTENSION_URL). */
function hasRealStore(storeUrl: string): boolean {
  return /^https?:\/\//.test(storeUrl);
}

/** Chrome-focused hero install CTA. On a Chromium desktop browser it offers the
 *  download (or the Web Store link once published); elsewhere it explains the
 *  extension is Chrome-only and points to the in-app paste fallback. */
export function ExtensionHeroCta() {
  const { kind, storeUrl, isMobile } = useBrowserInfo();
  const isChromium = kind === "chrome" || kind === "edge" || kind === "brave";
  const canInstall = !isMobile && isChromium;

  if (!canInstall) {
    return (
      <div className="border-l-[5px] border-[color:var(--b-acid)] bg-[color:var(--b-card)] px-4 py-3 text-[color:var(--b-ink)] shadow-[5px_5px_0_0_var(--b-shadow)]">
        <p className="font-display text-base">
          {isMobile ? "No extension needed on mobile." : "Annotated's extension is built for Chrome."}
        </p>
        <p className="mt-1 font-mono text-[12px] text-[color:var(--b-dim)]">
          {isMobile
            ? "Tap + New clip anywhere and paste a link — same clip, same receipt."
            : "Open this page in Chrome to install — or tap + New clip and paste a link to clip without the extension."}
        </p>
      </div>
    );
  }

  const store = hasRealStore(storeUrl);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-4">
        {store ? (
          <ExtensionCta href={storeUrl} ariaLabel="Add to Chrome" className={ctaClass}>
            ⊕ Add to Chrome — Free
          </ExtensionCta>
        ) : (
          <a href={DOWNLOAD_URL} download className={ctaClass} aria-label="Download Annotated for Chrome">
            ⬇ Download for Chrome — Free
          </a>
        )}
        <a
          href="#install"
          className="font-mono text-[12px] underline underline-offset-2 hover:text-[color:var(--b-acid)]"
        >
          How to install ↓
        </a>
      </div>
      <p className="mt-4 font-mono text-[11px] text-[color:var(--b-dim-onbg)]">
        {store
          ? "One-click install from the Chrome Web Store"
          : "In Chrome Web Store review · install it yourself in about a minute (steps below)"}
      </p>
    </div>
  );
}

/** The download button reused inside the install-instructions section. Mirrors
 *  the hero: real store link once published, otherwise the sideload package. */
export function InstallDownloadButton() {
  const { storeUrl } = useBrowserInfo();
  if (hasRealStore(storeUrl)) {
    return (
      <ExtensionCta href={storeUrl} ariaLabel="Add to Chrome" className={ctaClass}>
        ⊕ Add to Chrome — Free
      </ExtensionCta>
    );
  }
  return (
    <a href={DOWNLOAD_URL} download className={ctaClass} aria-label="Download Annotated for Chrome">
      ⬇ Download the extension (.zip)
    </a>
  );
}
