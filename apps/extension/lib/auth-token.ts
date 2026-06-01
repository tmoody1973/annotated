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
  const response = (await chrome.runtime.sendMessage({ type: "GET_CONVEX_TOKEN" })) as
    | { token: string | null; error?: string }
    | undefined;
  if (response?.error) throw new Error(response.error);
  return response?.token ?? null;
}
