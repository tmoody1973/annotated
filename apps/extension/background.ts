// Open the side panel when the user clicks the Annotated toolbar icon.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error: unknown) => console.error(error));

const webUrl = process.env.PLASMO_PUBLIC_WEB_URL ?? "";

/**
 * Mints a Convex-templated Clerk JWT by asking an open web-app tab for it.
 *
 * Why not mint it in the extension directly: from a `chrome-extension://` origin
 * the Clerk session cookie can't be sent cross-site to the production Frontend
 * API, so clerk-js falls back to an `Authorization` header — and the browser also
 * forces an `Origin` header — and prod Clerk rejects requests carrying both
 * ("clerk_offline" in a service worker, a 400 in a page). The web app runs
 * same-site with clerk.annotated.sh, so its cookie flows and `getToken` succeeds
 * with no Authorization header and no conflict. (Clerk *dev* instances don't
 * enforce that rule and use a cross-origin dev-browser token, which is why the
 * extension could mint tokens itself before the production cutover.)
 *
 * So we run `getToken({ template: "convex" })` inside the page's MAIN world via
 * chrome.scripting and relay the result back. Every open annotated.sh tab is
 * tried; clerk-js is given a moment to finish loading the session. This also
 * keeps the Clerk SDK out of the service-worker bundle entirely.
 *
 * Returns null when no signed-in web tab can produce a token (caller prompts
 * sign-in); throws an actionable error when no annotated.sh tab is open at all.
 */
async function fetchConvexToken(): Promise<string | null> {
  if (!webUrl) throw new Error("Missing PLASMO_PUBLIC_WEB_URL");
  const origin = new URL(webUrl).origin;

  const tabs = (await chrome.tabs.query({ url: `${origin}/*` })).filter((t) => t.id != null);
  if (tabs.length === 0) {
    throw new Error(`Open ${origin} in a tab (you're signed in there), then publish.`);
  }

  for (const tab of tabs) {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id! },
      world: "MAIN",
      func: async () => {
        const clerk = (window as unknown as { Clerk?: any }).Clerk;
        if (!clerk) return null;
        try {
          await clerk.load?.();
        } catch {
          /* already loaded */
        }
        // clerk.session can lag right after load — poll briefly, and fall back to
        // the active session on the client if the convenience getter is null.
        const findSession = () =>
          clerk.session ??
          clerk.client?.activeSessions?.[0] ??
          clerk.client?.sessions?.find((s: any) => s?.status === "active") ??
          null;
        let session = findSession();
        for (let i = 0; i < 20 && !session; i++) {
          await new Promise((r) => setTimeout(r, 100));
          session = findSession();
        }
        if (!session) return null;
        return (await session.getToken({ template: "convex" })) ?? null;
      },
    });

    const token = injection?.result as string | null | undefined;
    if (token) return token;
  }

  return null;
}

// `return true` keeps the message channel open for the async response.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "GET_CONVEX_TOKEN") return;
  fetchConvexToken()
    .then((token) => sendResponse({ token }))
    .catch((error: unknown) =>
      sendResponse({ token: null, error: error instanceof Error ? error.message : String(error) })
    );
  return true;
});
