import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseArticle } from "./parse-article.js";

const fixtureHtml = readFileSync(
  new URL("./__fixtures__/npr-article.html", import.meta.url),
  "utf8"
);

describe("parseArticle", () => {
  it("extracts the title from a real NPR article", () => {
    const result = parseArticle(fixtureHtml);
    expect(result).not.toBeNull();
    expect(result?.title.toLowerCase()).toContain("ebola");
  });

  it("extracts cleaned body text, free of nav/script noise", () => {
    const result = parseArticle(fixtureHtml);
    expect(result?.textContent.length).toBeGreaterThan(500);
    expect(result?.textContent.toLowerCase()).toContain("ebola");
    expect(result?.textContent).not.toContain("<script");
  });

  it("extracts the site name from Open Graph metadata", () => {
    const result = parseArticle(fixtureHtml);
    expect(result?.siteName).toBe("NPR");
  });

  it("extracts a byline when the page provides one", () => {
    const result = parseArticle(fixtureHtml);
    expect(result?.byline).toBeTruthy();
  });

  it("extracts the og:image as the citation visual", () => {
    const result = parseArticle(fixtureHtml);
    expect(result?.imageUrl).toMatch(/^https:\/\/npr\.brightspotcdn\.com\//);
  });

  it("returns null on HTML with no extractable article", () => {
    const result = parseArticle(
      "<html><head><title>x</title></head><body><nav>menu</nav></body></html>"
    );
    expect(result).toBeNull();
  });
});
