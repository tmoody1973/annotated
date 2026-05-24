import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { isPubliclyFetchable } from "./extract-article-schema.js";

const execFileAsync = promisify(execFile);
const MAX_HTML_BYTES = 1024 * 1024 * 16;

/**
 * Option-A fallback: fetches the article HTML server-side via curl when the
 * content script could not supply it. Guarded against SSRF (rejects internal
 * hosts up front, restricts the redirect protocols to http(s), and caps the
 * redirect count and timeout). Returns null on a blocked host or any error so
 * the route answers with a clean 502 rather than leaking the failure.
 */
export async function fetchArticleHtml(url: string): Promise<string | null> {
  if (!isPubliclyFetchable(url)) return null;
  try {
    const { stdout } = await execFileAsync(
      "curl",
      [
        "-sL",
        // Force HTTP/1.1: some sites (e.g. NPR) abort the HTTP/2 stream (curl 92)
        // for non-browser clients. Restrict redirect protocols to http(s) so a
        // public URL can't bounce to file://gopher:// targets (SSRF hardening).
        "--http1.1",
        "--proto",
        "=http,https",
        "--proto-redir",
        "=http,https",
        "--max-redirs",
        "3",
        "-m",
        "15",
        // A realistic browser UA — servers serve the full article to browsers
        // but stream-error or block obvious bot agents.
        "-A",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        url,
      ],
      { maxBuffer: MAX_HTML_BYTES }
    );
    const html = stdout.trim();
    return html.length > 0 ? html : null;
  } catch {
    return null;
  }
}
