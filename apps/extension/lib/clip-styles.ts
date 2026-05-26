/**
 * Calm editorial style layer for the sidepanel — matches the web app's §10
 * "type-forward news-app" direction (see docs/prototypes/sidebar-calm.html):
 * ink on warm paper, hairline borders, soft shadows, one restrained editorial
 * blue accent, generous radius. Replaces the earlier brutalism (hard borders,
 * blocky offset shadows, signal red). Monospace is reserved for timestamps; a
 * serif is used for quotes, echoing the web's Newsreader.
 */

export const ink = "#1b1a17";
export const paper = "#f3f1ea";
export const panel = "#fdfcf9";
export const surface = "#f6f4ee";
export const surface2 = "#ece9e0";
export const hair = "#e4e0d6";
export const accent = "#2f5d8a"; // editorial blue — clip/record identity, used sparingly
export const accentTint = "#2f5d8a1f"; // selection/focus wash
export const accentDeep = "#25496c"; // hover
export const valid = "#3f7a5a"; // calm green for success
export const danger = "#9a3b2f"; // calm editorial red for errors
export const muted = "#6c6962"; // ink-2
export const faint = "#9c988e"; // ink-3

export const sansStack =
  '"IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
export const serifStack = 'Newsreader, Georgia, "Times New Roman", serif';
export const monoStack =
  '"IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace';

export const radius = 10;
export const radiusSm = 7;

/** Injected once into the panel; drives the calm hover/focus/press interactions. */
export const clipPanelCss = `
  html, body { margin: 0; background: ${paper}; color: ${ink}; }
  .ann-root * { box-sizing: border-box; }
  .ann-root { -webkit-font-smoothing: antialiased; }
  .ann-shadow { box-shadow: 0 1px 2px #1b1a1710, 0 18px 40px -28px #1b1a1738; }
  .ann-press { transition: transform 120ms ease, box-shadow 120ms ease, background 120ms ease, border-color 120ms ease; }
  .ann-press:active { transform: translateY(1px); }
  .ann-capture {
    cursor: pointer;
    background: ${panel};
    border: 1px solid ${hair};
    border-radius: ${radiusSm}px;
    color: ${ink};
    font-family: ${sansStack};
    font-weight: 600;
    letter-spacing: 0.01em;
  }
  .ann-capture:hover { background: ${surface}; border-color: ${faint}; }
  .ann-field {
    border: 1px solid ${hair};
    border-radius: ${radiusSm}px;
    background: ${panel};
    color: ${ink};
    font-family: ${monoStack};
    font-size: 15px;
    font-weight: 500;
    padding: 9px 11px;
    width: 100%;
    outline: none;
  }
  .ann-field:focus { border-color: ${accent}; background: ${accentTint}; }
  .ann-textarea {
    border: 1px solid ${hair};
    border-radius: ${radiusSm}px;
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
  .ann-textarea:focus { border-color: ${accent}; background: ${accentTint}; }
  .ann-publish {
    cursor: pointer;
    width: 100%;
    border: none;
    border-radius: 8px;
    background: ${accent};
    color: ${panel};
    font-family: ${sansStack};
    font-weight: 600;
    font-size: 15px;
    letter-spacing: 0.01em;
    padding: 12px;
  }
  .ann-publish:hover:not(:disabled) { background: ${accentDeep}; }
  .ann-publish:disabled { cursor: not-allowed; background: ${surface2}; color: ${faint}; }
  .ann-link { color: ${accent}; font-weight: 600; text-decoration: none; }
  .ann-link:hover { text-decoration: underline; text-underline-offset: 3px; }
`;
