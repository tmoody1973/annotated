"use client";

import { useEffect, useRef, useState } from "react";
import { SaveImageModal } from "../a/[id]/save-image-dialog";

interface CardShareMenuProps {
  // Slug for the share-card route (/a/{cardSlug}/card) — always the annotation
  // id form, even for thread cards, since the card image is per-annotation.
  cardSlug: string;
  // Canonical clip path (relative), e.g. /a/…-id or /t/…-id. Made absolute with
  // the runtime origin for copy/share — this is the share→traffic-loop URL.
  detailPath: string;
  quote: string;
  sourceUrl?: string | null;
}

const X_INTENT = "https://twitter.com/intent/tweet";

/** The ••• overflow menu on a feed card: Save as image (inline modal), Copy
 *  link, Share on X, View original. Replaces the old footer "Share" link, which
 *  misleadingly opened the source (already linked elsewhere on the card). */
export function CardShareMenu({ cardSlug, detailPath, quote, sourceUrl }: CardShareMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  function absoluteUrl(): string {
    if (typeof window === "undefined") return detailPath;
    return `${window.location.origin}${detailPath}`;
  }

  async function copyLink() {
    setMenuOpen(false);
    try {
      await navigator.clipboard?.writeText(absoluteUrl());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (insecure context / older browser) — fail quietly.
    }
  }

  function shareOnX() {
    setMenuOpen(false);
    const text = quote ? `“${quote.slice(0, 100)}”` : "A clip on Annotated";
    const intent = `${X_INTENT}?text=${encodeURIComponent(text)}&url=${encodeURIComponent(absoluteUrl())}`;
    window.open(intent, "_blank", "noopener,noreferrer");
  }

  const itemClass =
    "block w-full px-3 py-2 text-left text-[13px] font-bold hover:bg-[color:var(--b-acid)] hover:text-[color:var(--b-acid-ink)]";

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="Share options"
        onClick={() => setMenuOpen((open) => !open)}
        className="px-2.5 py-1.5 text-[15px] font-extrabold leading-none hover:bg-[color:var(--b-acid)]"
      >
        {copied ? (
          <span className="text-[12px] uppercase tracking-wide">Copied ✓</span>
        ) : (
          "•••"
        )}
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute bottom-full right-0 z-50 mb-1 w-44 divide-y-2 divide-[color:var(--b-line)] border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] text-[color:var(--b-ink)] shadow-[5px_5px_0_0_var(--b-shadow)]"
        >
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => {
              setMenuOpen(false);
              setSaveOpen(true);
            }}
          >
            Save as image
          </button>
          <button type="button" role="menuitem" className={itemClass} onClick={copyLink}>
            Copy link
          </button>
          <button type="button" role="menuitem" className={itemClass} onClick={shareOnX}>
            Share on X
          </button>
          {sourceUrl && (
            <a
              role="menuitem"
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={itemClass}
              onClick={() => setMenuOpen(false)}
            >
              View original ↗
            </a>
          )}
        </div>
      )}

      <SaveImageModal slug={cardSlug} open={saveOpen} onClose={() => setSaveOpen(false)} />
    </div>
  );
}
