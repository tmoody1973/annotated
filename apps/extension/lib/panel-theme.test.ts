import { describe, expect, it } from "vitest";
import { BRUTALIST_DARK, BRUTALIST_LIGHT } from "@annotated/shared";
import { panelCss } from "./panel-theme";

const css = panelCss();

describe("panelCss", () => {
  it("declares every light token on :root", () => {
    for (const [token, value] of Object.entries(BRUTALIST_LIGHT)) {
      expect(css, `missing light token ${token}`).toContain(value);
    }
  });

  it("redefines the palette under prefers-color-scheme: dark", () => {
    expect(css).toContain("@media (prefers-color-scheme: dark)");
    expect(css).toContain(BRUTALIST_DARK.bg);
    expect(css).toContain(`--b-shadow: ${BRUTALIST_DARK.shadow}`);
  });

  it("uses the dialed-back 3px shadow, never the old 6px", () => {
    expect(css).toContain("3px 3px 0 0");
    expect(css).not.toContain("6px 6px");
  });

  it("gives a shadow to the primary action and to nothing else", () => {
    // Split into rule blocks so a `box-shadow` line is judged by the selector
    // it actually sits under, not by whatever text shares its line.
    const rules = css.split("}").filter((rule) => /box-shadow:\s*\d/.test(rule));
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(rule, `unexpected shadow in: ${rule.trim()}`).toContain("ann-publish");
    }
  });

  it("never hard-codes a colour outside the token blocks", () => {
    // The body of the stylesheet must speak in var(--b-*). Literal hex is only
    // allowed inside the two :root blocks and for the chrome bar's white text.
    const body = css.slice(css.indexOf("html, body"));
    const literals = body.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(literals).toEqual(["#ffffff"]);
  });
});
