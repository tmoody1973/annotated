/**
 * Fetches a Convex-templated Clerk JWT for the signed-in user, or null when
 * signed out. The actual Clerk Frontend API call runs in the **background
 * service worker** (see `background.ts`) — the only context that can mint a token
 * against the production instance without the Origin/Authorization header
 * conflict. The panel just message-passes.
 *
 * A null result means signed-out (caller prompts sign-in); a thrown error
 * (e.g. a missing JWT template) is intentionally NOT swallowed so the real cause
 * shows instead of a misleading "sign in" message.
 */
export async function getConvexToken(): Promise<string | null> {
  // The background relay is internally bounded, but guard the round-trip too so
  // a wedged service worker can never leave a publish spinning forever.
  const response = (await Promise.race([
    chrome.runtime.sendMessage({ type: "GET_CONVEX_TOKEN" }),
    new Promise((resolve) => setTimeout(() => resolve({ timedOut: true }), 40000)),
  ])) as { token?: string | null; error?: string; timedOut?: boolean } | undefined;

  if (response?.timedOut) {
    throw new Error(
      "Timed out getting your sign-in token. Make sure you're signed in at annotated.sh, then try again."
    );
  }
  if (response?.error) throw new Error(response.error);
  return response?.token ?? null;
}
