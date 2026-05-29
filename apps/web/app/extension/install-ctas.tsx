"use client";

import type { BrowserKind } from "@annotated/shared";
import { useBrowserInfo } from "../_lib/use-browser-info";
import { ExtensionCta } from "../_components/extension-cta";

const BROWSER_CARDS: { kind: BrowserKind; name: string; icon: string; label: string }[] = [
  { kind: "chrome", name: "Chrome", icon: "C", label: "Add to Chrome" },
  { kind: "edge", name: "Edge", icon: "E", label: "Add to Edge" },
  { kind: "firefox", name: "Firefox", icon: "◭", label: "Add to Firefox" },
  { kind: "brave", name: "Brave", icon: "B", label: "Get for Brave" },
];

const OTHER_NAMES: Record<string, string> = {
  chrome: "Chrome",
  edge: "Edge",
  firefox: "Firefox",
  brave: "Brave",
};

/** Hero install block: the browser-detected primary CTA + a jump to the grid,
 *  softening to the manual-paste note on Safari and mobile. */
export function ExtensionHeroCta() {
  const { kind, label, storeUrl, supported, isMobile, detected } = useBrowserInfo();

  const others = Object.entries(OTHER_NAMES)
    .filter(([k]) => k !== kind)
    .map(([, name]) => name)
    .join(", ");

  return (
    <div>
      {supported ? (
        <div className="flex flex-wrap items-center gap-4">
          <ExtensionCta
            href={storeUrl}
            ariaLabel={label}
            className="inline-flex items-center gap-2 border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-chrome)] px-6 py-4 font-display text-[15px] uppercase tracking-wide text-[color:var(--b-acid)] shadow-[6px_6px_0_0_var(--b-acid)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[3px_3px_0_0_var(--b-acid)]"
          >
            ⊕ {label} — Free
          </ExtensionCta>
          <a
            href="#browsers"
            className="font-mono text-[12px] underline underline-offset-2 hover:text-[color:var(--b-acid)]"
          >
            See all browsers ↓
          </a>
        </div>
      ) : (
        <div className="border-l-[5px] border-[color:var(--b-acid)] bg-[color:var(--b-card)] px-4 py-3 text-[color:var(--b-ink)] shadow-[5px_5px_0_0_var(--b-shadow)]">
          <p className="font-display text-base">
            {isMobile ? "No extension needed on mobile." : "Not available on this browser yet."}
          </p>
          <p className="mt-1 font-mono text-[12px] text-[color:var(--b-dim)]">
            Tap <span className="font-bold">+ New clip</span> anywhere and paste a link — same clip,
            same receipt. See the note below.
          </p>
        </div>
      )}
      <p className="mt-4 font-mono text-[11px] text-[color:var(--b-dim-onbg)]">
        {!detected
          ? "Available on Chrome, Edge, Firefox & Brave · ~10-second install"
          : supported
            ? `Detected: ${OTHER_NAMES[kind] ?? "your browser"} · also on ${others} · ~10-second install`
            : "Supported on Chrome, Edge, Firefox & Brave (desktop)"}
      </p>
    </div>
  );
}

/** Per-browser install grid; the detected browser gets an acid outline + tag. */
export function BrowserGrid() {
  const { kind, storeUrl } = useBrowserInfo();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {BROWSER_CARDS.map((card) => {
        const isDetected = card.kind === kind;
        return (
          <div
            key={card.kind}
            className={`border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] p-5 text-center text-[color:var(--b-ink)] shadow-[5px_5px_0_0_var(--b-shadow)] ${
              isDetected ? "outline outline-[3px] outline-offset-[3px] outline-[color:var(--b-acid)]" : ""
            }`}
          >
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center border-2 border-[color:var(--b-line)] bg-[color:var(--b-bg)] font-display text-2xl text-[color:var(--b-onbg)]">
              {card.icon}
            </div>
            <div className="mb-3 font-display text-base">{card.name}</div>
            <ExtensionCta
              href={storeUrl}
              ariaLabel={card.label}
              className="block w-full border-2 border-[color:var(--b-line)] bg-[color:var(--b-acid)] px-3 py-2 font-mono text-[12px] font-bold uppercase tracking-wide text-[color:var(--b-acid-ink)]"
            >
              {card.label}
            </ExtensionCta>
            {isDetected && (
              <div className="mt-2 font-mono text-[10px] text-[color:var(--b-dim)]">
                detected — recommended
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
