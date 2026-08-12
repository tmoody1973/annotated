import { describe, expect, it } from "vitest";
import { BRUTALIST_DARK, BRUTALIST_LIGHT, tokenVar } from "./brutalist-tokens";

describe("brutalist tokens", () => {
  it("defines the same token names in both themes", () => {
    expect(Object.keys(BRUTALIST_LIGHT).sort()).toEqual(Object.keys(BRUTALIST_DARK).sort());
  });

  it("matches the web app's light values exactly", () => {
    // Sourced from apps/web/app/globals.css :root — these must not drift.
    expect(BRUTALIST_LIGHT.bg).toBe("#f4f1e8");
    expect(BRUTALIST_LIGHT.card).toBe("#ffffff");
    expect(BRUTALIST_LIGHT.ink).toBe("#0a0a0a");
    expect(BRUTALIST_LIGHT.acid).toBe("#e1ff00");
    expect(BRUTALIST_LIGHT.shadow).toBe("#0a0a0a");
  });

  it("matches the web app's dark values exactly", () => {
    // Sourced from apps/web/app/globals.css html.dark. Note the two surprises
    // that make this theme work: cards stay LIGHT in dark mode, and the shadow
    // becomes acid rather than ink.
    expect(BRUTALIST_DARK.bg).toBe("#0b0b0c");
    expect(BRUTALIST_DARK.card).toBe("#fbfbf7");
    expect(BRUTALIST_DARK.ink).toBe("#0a0a0a");
    expect(BRUTALIST_DARK.shadow).toBe("#e1ff00");
  });

  it("keeps dim text legible against its own background in both themes", () => {
    expect(BRUTALIST_LIGHT.dimOnBg).toBe("#555049");
    expect(BRUTALIST_DARK.dimOnBg).toBe("#a9a9a1");
  });

  it("kebab-cases camelCase token names into custom properties", () => {
    expect(tokenVar("bg")).toBe("--b-bg");
    expect(tokenVar("onBg")).toBe("--b-on-bg");
    expect(tokenVar("dimOnBg")).toBe("--b-dim-on-bg");
    expect(tokenVar("acidInk")).toBe("--b-acid-ink");
  });

  it("gives every token a distinct custom property", () => {
    const names = (Object.keys(BRUTALIST_LIGHT) as Array<keyof typeof BRUTALIST_LIGHT>).map(
      tokenVar,
    );
    expect(new Set(names).size).toBe(names.length);
  });
});
