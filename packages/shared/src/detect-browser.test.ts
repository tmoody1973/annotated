import { describe, expect, it } from "vitest";
import { classifyBrowser, browserLabel } from "./detect-browser";

// Real-world user-agent strings (trimmed) for each target browser.
const UA = {
  chrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  edge:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
  firefox:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:125.0) Gecko/20100101 Firefox/125.0",
  opera:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 OPR/110.0.0.0",
  safari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
} as const;

describe("classifyBrowser", () => {
  it("detects desktop Chrome as installable", () => {
    const result = classifyBrowser(UA.chrome);
    expect(result.kind).toBe("chrome");
    expect(result.isMobile).toBe(false);
    expect(result.supported).toBe(true);
    expect(result.label).toBe("Add to Chrome");
  });

  it("detects Edge before Chrome (Edge UA contains 'Chrome')", () => {
    expect(classifyBrowser(UA.edge).kind).toBe("edge");
    expect(classifyBrowser(UA.edge).label).toBe("Add to Edge");
  });

  it("detects Firefox", () => {
    expect(classifyBrowser(UA.firefox).kind).toBe("firefox");
    expect(classifyBrowser(UA.firefox).supported).toBe(true);
  });

  it("classifies Opera as 'other' but still installable on desktop", () => {
    const result = classifyBrowser(UA.opera);
    expect(result.kind).toBe("other");
    expect(result.supported).toBe(true);
    expect(result.label).toBe("Get the extension");
  });

  it("detects desktop Safari and marks it unsupported", () => {
    const result = classifyBrowser(UA.safari);
    expect(result.kind).toBe("safari");
    expect(result.supported).toBe(false);
  });

  it("marks iPhone Safari as mobile and unsupported", () => {
    const result = classifyBrowser(UA.iphone);
    expect(result.kind).toBe("safari");
    expect(result.isMobile).toBe(true);
    expect(result.supported).toBe(false);
  });

  it("marks Android Chrome as mobile and unsupported (no desktop extension)", () => {
    const result = classifyBrowser(UA.androidChrome);
    expect(result.kind).toBe("chrome");
    expect(result.isMobile).toBe(true);
    expect(result.supported).toBe(false);
  });

  it("falls back to 'other' / unsupported for an empty UA (SSR default)", () => {
    const result = classifyBrowser("");
    expect(result.kind).toBe("other");
    expect(result.supported).toBe(false);
    expect(result.label).toBe("Get the extension");
  });
});

describe("browserLabel", () => {
  it("gives Brave its own verb", () => {
    expect(browserLabel("brave")).toBe("Get for Brave");
  });
});
