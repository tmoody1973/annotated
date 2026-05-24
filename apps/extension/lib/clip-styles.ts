/**
 * Brutalism style layer for the sidepanel, matching the landing page (5c): warm
 * paper, near-black ink, hard borders, blocky offset shadows that collapse on
 * press. Monospace is reserved for timestamps only (CLAUDE.md discipline).
 */

export const ink = "#0A0A0A";
export const paper = "#FBFAF7";
export const accent = "#E5484D"; // signal red — the "clip/record" identity
export const valid = "#1B7F4B";
export const muted = "#6B6B66";

export const sansStack =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Helvetica Neue", sans-serif';
export const monoStack =
  'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace';

/** Injected once into the panel; drives hover/active/focus brutalist interactions. */
export const clipPanelCss = `
  html, body { margin: 0; background: ${paper}; }
  .ann-root * { box-sizing: border-box; }
  .ann-shadow { box-shadow: 4px 4px 0 ${ink}; }
  .ann-press {
    transition: transform 80ms ease, box-shadow 80ms ease;
  }
  .ann-press:active {
    transform: translate(4px, 4px);
    box-shadow: 0 0 0 ${ink};
  }
  .ann-capture {
    cursor: pointer;
    background: ${paper};
    border: 2px solid ${ink};
    color: ${ink};
    font-family: ${sansStack};
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .ann-capture:hover { background: ${ink}; color: ${paper}; }
  .ann-field {
    border: 2px solid ${ink};
    background: ${paper};
    color: ${ink};
    font-family: ${monoStack};
    font-size: 16px;
    font-weight: 700;
    padding: 8px 10px;
    width: 100%;
    outline: none;
  }
  .ann-field:focus { background: #FFF7C2; }
  .ann-textarea {
    border: 2px solid ${ink};
    background: ${paper};
    color: ${ink};
    font-family: ${sansStack};
    font-size: 14px;
    line-height: 1.4;
    padding: 10px;
    width: 100%;
    resize: vertical;
    min-height: 76px;
    outline: none;
  }
  .ann-textarea:focus { background: #FFF7C2; }
  .ann-publish {
    cursor: pointer;
    width: 100%;
    border: 3px solid ${ink};
    background: ${accent};
    color: ${paper};
    font-family: ${sansStack};
    font-weight: 900;
    font-size: 16px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    padding: 14px;
  }
  .ann-publish:hover:not(:disabled) { background: ${ink}; }
  .ann-publish:disabled { cursor: not-allowed; background: ${muted}; opacity: 0.55; }
  .ann-link { color: ${ink}; font-weight: 800; text-decoration: underline; text-underline-offset: 3px; }
`;
