/**
 * The side panel's entire stylesheet, derived from the shared brutalist tokens.
 *
 * The panel has no theme toggle of its own — it is a piece of browser chrome, so
 * it follows the OS via `prefers-color-scheme` rather than the web app's
 * `html.dark` class. Same palette, different switch.
 *
 * Weight rules from the 380px design review, applied once here instead of per
 * component: the hard offset shadow is 3px (was 6px), and only the primary
 * action on a screen carries one. Borders stay 2px, corners stay square.
 */
import { BRUTALIST_DARK, BRUTALIST_LIGHT, tokenVar, type TokenName } from "@annotated/shared";

export const SANS_STACK =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Arial, sans-serif';
export const MONO_STACK =
  'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

/** Flat status colours. The palette is one accent by design, so "recording" and
 * "signed in" borrow these two rather than diluting the acid. */
export const STATUS_OK = "#1a7a40";
export const STATUS_BAD = "#c0392b";

/** Acid at 20% — the selection wash. Kept as a literal because it is an alpha
 * variant of a token, not a token, and only the panel uses it. */
const ACID_WASH = "#e1ff0033";

function block(tokens: Record<TokenName, string>, indent: string): string {
  return (Object.keys(tokens) as TokenName[])
    .map((token) => `${indent}${tokenVar(token)}: ${tokens[token]};`)
    .join("\n");
}

/** The panel's entire stylesheet. Injected once by the router. */
export function panelCss(): string {
  return `
:root {
${block(BRUTALIST_LIGHT, "  ")}
  --b-acid-wash: ${ACID_WASH};
}
@media (prefers-color-scheme: dark) {
  :root {
${block(BRUTALIST_DARK, "    ")}
  }
}

html, body {
  margin: 0;
  background: var(--b-bg);
  color: var(--b-on-bg);
  font-family: ${SANS_STACK};
}
.ann-root { -webkit-font-smoothing: antialiased; }
.ann-root * { box-sizing: border-box; }

.ann-card {
  border: 2px solid var(--b-line);
  background: var(--b-card);
  color: var(--b-ink);
}
.ann-dim { color: var(--b-dim-on-bg); }
.ann-card .ann-dim { color: var(--b-dim); }
.ann-mono { font-family: ${MONO_STACK}; }

.ann-press { transition: transform 80ms ease, box-shadow 80ms ease, background 80ms ease; }
.ann-press:active { transform: translate(2px, 2px); }

.ann-capture {
  cursor: pointer;
  background: var(--b-card);
  border: 2px solid var(--b-line);
  color: var(--b-ink);
  font-family: ${SANS_STACK};
  font-weight: 800;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.ann-capture:hover { background: var(--b-acid-wash); }

.ann-field {
  border: 2px solid var(--b-line);
  background: var(--b-card);
  color: var(--b-ink);
  font-family: ${MONO_STACK};
  font-size: 15px;
  font-weight: 500;
  padding: 9px 11px;
  width: 100%;
  outline: none;
}
.ann-textarea {
  border: 2px solid var(--b-line);
  background: var(--b-card);
  color: var(--b-ink);
  font-family: ${SANS_STACK};
  font-size: 14px;
  line-height: 1.5;
  padding: 10px 11px;
  width: 100%;
  resize: vertical;
  min-height: 76px;
  outline: none;
}
.ann-field:focus, .ann-textarea:focus { background: var(--b-acid-wash); }

/* The only shadow in the panel. */
.ann-publish {
  cursor: pointer;
  width: 100%;
  border: 2px solid var(--b-line);
  background: var(--b-acid);
  color: var(--b-acid-ink);
  font-family: ${SANS_STACK};
  font-weight: 900;
  font-size: 13px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 13px;
  box-shadow: 3px 3px 0 0 var(--b-shadow);
}
.ann-publish:active:not(:disabled) { transform: translate(2px, 2px); box-shadow: 1px 1px 0 0 var(--b-shadow); }
.ann-publish:disabled { cursor: not-allowed; background: var(--b-card); color: var(--b-dim); box-shadow: none; }

.ann-link {
  color: var(--b-on-bg);
  font-weight: 800;
  text-decoration: underline;
  text-underline-offset: 3px;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-family: ${SANS_STACK};
  font-size: inherit;
}
.ann-card .ann-link { color: var(--b-ink); }

.ann-chrome {
  background: var(--b-chrome);
  color: #ffffff;
}

/* Screen-reader-only, for the live region and the step position. */
.ann-sr {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

:focus-visible { outline: 3px solid var(--b-acid); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  .ann-press, .ann-publish { transition: none; }
}
`;
}
