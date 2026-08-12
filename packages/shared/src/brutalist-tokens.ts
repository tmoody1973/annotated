/**
 * The brutalist palette, in one place.
 *
 * Previously duplicated by hand in apps/web/app/globals.css and
 * apps/extension/lib/clip-styles.ts. They drifted: the web gained a dark
 * variant and the panel never did, which is why the side panel glows cream
 * beside a dark YouTube page.
 *
 * Two things about the dark theme are deliberate and look like mistakes:
 * cards stay light paper on a near-black page, and the hard offset shadow
 * becomes acid instead of ink. Both come from the web app's shipped theme.
 */
export type TokenName =
  | "bg"
  | "onBg"
  | "card"
  | "ink"
  | "acid"
  | "acidInk"
  | "line"
  | "dim"
  | "dimOnBg"
  | "shadow"
  | "chrome";

export const BRUTALIST_LIGHT: Record<TokenName, string> = {
  bg: "#f4f1e8",
  onBg: "#0a0a0a",
  card: "#ffffff",
  ink: "#0a0a0a",
  acid: "#e1ff00",
  acidInk: "#0a0a0a",
  line: "#0a0a0a",
  dim: "#5f5f59",
  dimOnBg: "#555049",
  shadow: "#0a0a0a",
  chrome: "#000000",
};

export const BRUTALIST_DARK: Record<TokenName, string> = {
  bg: "#0b0b0c",
  onBg: "#fbfbf7",
  card: "#fbfbf7",
  ink: "#0a0a0a",
  acid: "#e1ff00",
  acidInk: "#0a0a0a",
  line: "#000000",
  dim: "#5f5f59",
  dimOnBg: "#a9a9a1",
  shadow: "#e1ff00",
  chrome: "#000000",
};

/**
 * The CSS custom-property name for a token — `dimOnBg` becomes `--b-dim-on-bg`.
 *
 * The web app's own names predate this and are not mechanical: it ships
 * `--b-onbg` and `--b-dim-onbg`. The panel injects its own stylesheet and never
 * shares a document with the web app, so the two naming schemes cannot collide.
 */
export function tokenVar(token: TokenName): string {
  return `--b-${token.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}
