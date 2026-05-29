/**
 * Brutalist design system for the sidepanel — mirrors the web app's design.
 * Acid-yellow accent, hard offset shadows, square corners, near-black ink.
 */

export const ink = "#0a0a0a";
export const paper = "#f4f1e8";
export const panel = "#ffffff";
export const surface = "#f4f1e8";
export const surface2 = "#e8e5dc";
export const hair = "#0a0a0a"; // hard black borders — no hairlines in brutalism
export const accent = "#e1ff00"; // acid yellow
export const accentTint = "#e1ff0033"; // selection wash
export const accentDeep = "#c8e600"; // accent hover
export const valid = "#1a7a40"; // flat green
export const danger = "#c0392b"; // flat red
export const muted = "#5f5f59";
export const faint = "#9c988e";

export const sansStack =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Arial, sans-serif';
// serifStack kept for any lingering imports; redirected to sans (no web fonts loaded)
export const serifStack =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Arial, sans-serif';
export const monoStack =
  'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

export const radius = 0;
export const radiusSm = 0;

/** Injected once into the panel; drives brutalist hover/focus/press interactions. */
export const clipPanelCss = `
  html, body { margin: 0; background: ${paper}; color: ${ink}; }
  .ann-root * { box-sizing: border-box; }
  .ann-root { -webkit-font-smoothing: antialiased; }
  .ann-shadow { box-shadow: 6px 6px 0 0 ${ink}; }
  .ann-press { transition: transform 80ms ease, box-shadow 80ms ease, background 80ms ease, border-color 80ms ease; }
  .ann-press:active { transform: translate(2px, 2px); box-shadow: 4px 4px 0 0 ${ink}; }
  .ann-capture {
    cursor: pointer;
    background: ${panel};
    border: 2px solid ${ink};
    border-radius: 0;
    color: ${ink};
    font-family: ${sansStack};
    font-weight: 800;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .ann-capture:hover { background: ${paper}; }
  .ann-field {
    border: 2px solid ${ink};
    border-radius: 0;
    background: ${panel};
    color: ${ink};
    font-family: ${monoStack};
    font-size: 15px;
    font-weight: 500;
    padding: 9px 11px;
    width: 100%;
    outline: none;
  }
  .ann-field:focus { border-color: ${ink}; background: ${accentTint}; outline: 2px solid ${accent}; outline-offset: 0; }
  .ann-textarea {
    border: 2px solid ${ink};
    border-radius: 0;
    background: ${panel};
    color: ${ink};
    font-family: ${sansStack};
    font-size: 14px;
    line-height: 1.5;
    padding: 10px 11px;
    width: 100%;
    resize: vertical;
    min-height: 76px;
    outline: none;
  }
  .ann-textarea:focus { outline: 2px solid ${accent}; outline-offset: 0; background: ${accentTint}; }
  .ann-publish {
    cursor: pointer;
    width: 100%;
    border: 2px solid ${ink};
    border-radius: 0;
    background: ${accent};
    color: ${ink};
    font-family: ${sansStack};
    font-weight: 900;
    font-size: 13px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 13px;
    box-shadow: 4px 4px 0 0 ${ink};
  }
  .ann-publish:hover:not(:disabled) { background: ${accentDeep}; }
  .ann-publish:active:not(:disabled) { transform: translate(2px, 2px); box-shadow: 2px 2px 0 0 ${ink}; }
  .ann-publish:disabled { cursor: not-allowed; background: ${surface2}; color: ${muted}; box-shadow: none; }
  .ann-link { color: ${ink}; font-weight: 800; text-decoration: underline; text-underline-offset: 3px; }
  .ann-link:hover { color: ${muted}; }
`;
