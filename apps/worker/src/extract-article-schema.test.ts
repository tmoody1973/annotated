import { describe, expect, it } from "vitest";
import {
  extractArticleBodySchema,
  isPubliclyFetchable,
} from "./extract-article-schema.js";

describe("extractArticleBodySchema", () => {
  it("accepts an http(s) url with html present", () => {
    const parsed = extractArticleBodySchema.safeParse({
      url: "https://example.com/post",
      html: "<html></html>",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts an http(s) url with no html (fallback fetch path)", () => {
    const parsed = extractArticleBodySchema.safeParse({
      url: "https://example.com/post",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a non-http(s) url", () => {
    const parsed = extractArticleBodySchema.safeParse({ url: "file:///etc/passwd" });
    expect(parsed.success).toBe(false);
  });

  it("rejects empty html when the field is present", () => {
    const parsed = extractArticleBodySchema.safeParse({
      url: "https://example.com/post",
      html: "",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("isPubliclyFetchable (SSRF guard)", () => {
  it("allows a normal public https url", () => {
    expect(isPubliclyFetchable("https://www.npr.org/story")).toBe(true);
  });

  it("blocks loopback and localhost", () => {
    expect(isPubliclyFetchable("http://localhost:8080/")).toBe(false);
    expect(isPubliclyFetchable("http://127.0.0.1/")).toBe(false);
  });

  it("blocks the cloud metadata link-local address", () => {
    expect(isPubliclyFetchable("http://169.254.169.254/latest/meta-data")).toBe(false);
  });

  it("blocks private network ranges", () => {
    expect(isPubliclyFetchable("http://10.0.0.5/")).toBe(false);
    expect(isPubliclyFetchable("http://192.168.1.1/")).toBe(false);
    expect(isPubliclyFetchable("http://172.16.4.4/")).toBe(false);
  });

  it("blocks non-http(s) protocols", () => {
    expect(isPubliclyFetchable("file:///etc/passwd")).toBe(false);
  });

  it("blocks obfuscated decimal and hex IPv4 forms of loopback", () => {
    expect(isPubliclyFetchable("http://2130706433/")).toBe(false); // 127.0.0.1
    expect(isPubliclyFetchable("http://0x7f000001/")).toBe(false); // 127.0.0.1
  });

  it("blocks IPv6 loopback, ULA, link-local, and IPv4-mapped metadata", () => {
    expect(isPubliclyFetchable("http://[::1]/")).toBe(false);
    expect(isPubliclyFetchable("http://[fd00::1]/")).toBe(false);
    expect(isPubliclyFetchable("http://[fe80::1]/")).toBe(false);
    expect(isPubliclyFetchable("http://[::ffff:169.254.169.254]/")).toBe(false);
  });

  it("still allows a public IPv6 host", () => {
    expect(isPubliclyFetchable("http://[2606:4700:4700::1111]/")).toBe(true);
  });
});
