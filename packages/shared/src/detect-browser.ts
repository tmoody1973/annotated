/** Browsers we can name a tailored install CTA for. Brave shares Chrome's UA
 *  and can only be told apart at runtime via `navigator.brave`, so the pure
 *  UA classifier never returns it — the client hook upgrades chrome → brave. */
export type BrowserKind = "chrome" | "edge" | "firefox" | "brave" | "safari" | "other";

export interface DetectedBrowser {
  kind: BrowserKind;
  /** Phone or tablet — no desktop extension applies, so CTAs soften. */
  isMobile: boolean;
  /** Whether the extension is installable here (desktop, non-Safari, known UA). */
  supported: boolean;
  /** The install CTA verb+target, e.g. "Add to Chrome" / "Get for Brave". */
  label: string;
}

const MOBILE_PATTERN = /Mobi|Android|iPhone|iPad|iPod/i;

/** Maps a browser kind to its install CTA label. */
export function browserLabel(kind: BrowserKind): string {
  switch (kind) {
    case "chrome":
      return "Add to Chrome";
    case "edge":
      return "Add to Edge";
    case "firefox":
      return "Add to Firefox";
    case "brave":
      return "Get for Brave";
    default:
      return "Get the extension";
  }
}

/** Order matters: Edge and Opera UAs both contain "Chrome", and Chrome's UA
 *  contains "Safari" — so the more specific tokens are tested first. */
function classifyKind(userAgent: string): BrowserKind {
  if (/Edg[A-Z]*\//.test(userAgent)) return "edge";
  if (/Firefox\//.test(userAgent) && !/Seamonkey\//.test(userAgent)) return "firefox";
  if (/OPR\//.test(userAgent) || /\bOpera\b/.test(userAgent)) return "other";
  if (/Chrome\//.test(userAgent) || /Chromium\//.test(userAgent)) return "chrome";
  if (/Safari\//.test(userAgent) && /Version\//.test(userAgent)) return "safari";
  return "other";
}

/** Classifies a user-agent string into an install-CTA decision. Pure — the
 *  client hook layers on `navigator.brave` and the env-driven store URL. */
export function classifyBrowser(userAgent: string): DetectedBrowser {
  const kind = classifyKind(userAgent);
  const isMobile = MOBILE_PATTERN.test(userAgent);
  const supported = userAgent.length > 0 && !isMobile && kind !== "safari";
  return { kind, isMobile, supported, label: browserLabel(kind) };
}
