import { z } from "zod";

/**
 * Body of a POST /extract-article request. `html` is the page's outerHTML grabbed
 * by the content script (option B — what the user actually sees, paywalls/JS
 * resolved). When absent the worker falls back to fetching `url` server-side
 * (option A). `url` is always required for the canonical source + the fallback.
 */
export const extractArticleBodySchema = z.object({
  url: z
    .string()
    .url()
    .refine((u) => /^https?:\/\//i.test(u), "url must be http(s)"),
  html: z.string().min(1).optional(),
});

export type ExtractArticleBody = z.infer<typeof extractArticleBodySchema>;

/** Whether a dotted-quad IPv4 string is a public (non-private/loopback) address. */
function isPublicIpv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return false;
  }
  const a = parts[0] as number;
  const b = parts[1] as number;
  if (a === 0 || a === 127 || a === 10) return false;
  if (a === 192 && b === 168) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 169 && b === 254) return false; // link-local + cloud metadata
  return true;
}

/**
 * SSRF guard for the option-A fallback fetch: rejects non-http(s) protocols and
 * hosts that resolve to loopback, link-local (incl. the 169.254.169.254 cloud
 * metadata endpoint), or private ranges. Covers the obfuscated forms attackers
 * reach for — decimal/hex integer IPv4, IPv6 loopback/ULA/link-local, and
 * IPv4-mapped IPv6. Best-effort host-string check; the fetch additionally caps
 * the redirect protocols and count so a public URL can't bounce internal.
 */
export function isPubliclyFetchable(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost")) return false;

  // IPv6: block loopback/unspecified, ULA (fc00::/7), link-local (fe80::/10),
  // and the whole IPv4-mapped range (::ffff:* — the URL parser normalizes the
  // embedded IPv4 to hex, e.g. ::ffff:169.254.169.254 → ::ffff:a9fe:a9fe, so a
  // dotted-quad check would miss it; no real article uses a mapped literal).
  if (host.includes(":")) {
    if (host === "::1" || host === "::") return false;
    if (/^f[cd]/.test(host) || /^fe[89ab]/.test(host)) return false;
    if (/^::ffff:/i.test(host)) return false;
    return true;
  }

  // A bare integer (2130706433) or hex (0x7f000001) host is an obfuscated IP —
  // no legitimate article is served from one, so reject outright.
  if (/^\d+$/.test(host) || /^0x[0-9a-f]+$/.test(host)) return false;

  const v4 = host.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
  if (v4) return isPublicIpv4(host);

  return true;
}
