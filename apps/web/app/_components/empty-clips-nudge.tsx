"use client";

import { useState } from "react";
import { ExtensionCta } from "./extension-cta";
import { ArticleClipModal } from "./article-clip-modal";
import { useBrowserInfo } from "../_lib/use-browser-info";

const primaryBtn =
  "border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-acid)] px-5 py-3 font-mono text-[13px] font-bold uppercase tracking-wide text-[color:var(--b-acid-ink)] shadow-[4px_4px_0_0_var(--b-shadow)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_0_var(--b-shadow)]";
const secondaryBtn =
  "border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] px-5 py-3 font-mono text-[13px] font-bold uppercase tracking-wide text-[color:var(--b-ink)] hover:bg-[color:var(--b-bg)]";

/** Empty "your clips" nudge: frames the extension as the fastest way to start,
 *  with the manual paste flow as the equal alternative. On mobile/Safari the
 *  extension button drops and paste becomes the primary action. */
export function EmptyClipsNudge() {
  const browser = useBrowserInfo();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] px-7 py-12 text-center text-[color:var(--b-ink)] shadow-[7px_7px_0_0_var(--b-shadow)]">
      <span className="mx-auto mb-5 flex h-[70px] w-[70px] items-center justify-center border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-chrome)] font-display text-3xl text-[color:var(--b-acid)]">
        A
      </span>
      <h3 className="font-display text-2xl tracking-tight">No clips yet.</h3>
      <p className="mx-auto mt-2 max-w-[46ch] text-[15px] leading-relaxed">
        Clip the web, add your take, publish the receipt.{" "}
        {browser.supported
          ? "The fastest way to start is straight from the page you're reading."
          : "Paste a link and we'll pull the page so you can highlight and annotate it."}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {browser.supported ? (
          <>
            <ExtensionCta href={browser.storeUrl} ariaLabel={browser.label} className={primaryBtn}>
              ⊕ Add the extension
            </ExtensionCta>
            <button onClick={() => setModalOpen(true)} className={secondaryBtn}>
              + Paste a link instead
            </button>
          </>
        ) : (
          <button onClick={() => setModalOpen(true)} className={primaryBtn}>
            + Paste a link to start
          </button>
        )}
      </div>
      {modalOpen && <ArticleClipModal onClose={() => setModalOpen(false)} />}
    </div>
  );
}
