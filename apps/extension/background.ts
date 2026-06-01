// The side panel opens only on the tab where the user clicks the Annotated
// toolbar icon (like Claude) — not one global panel that follows every tab. We
// turn off the global open-on-click behavior and manage panel availability per
// tab: a tab is "opted in" when its icon is clicked, and the panel is enabled
// only on opted-in tabs (disabled elsewhere, so it closes when you switch away).
// The opted-in set lives in chrome.storage.session so it survives the service
// worker being torn down between events.
const PANEL_PATH = "sidepanel.html";
const OPEN_TABS_KEY = "panel-open-tabs";

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: false })
  .catch((error: unknown) => console.error(error));

async function readOpenTabs(): Promise<number[]> {
  try {
    const stored = await chrome.storage.session.get(OPEN_TABS_KEY);
    const ids = stored[OPEN_TABS_KEY];
    return Array.isArray(ids) ? (ids as number[]) : [];
  } catch {
    return [];
  }
}

async function setTabOpen(tabId: number, open: boolean): Promise<void> {
  const ids = new Set(await readOpenTabs());
  if (open) ids.add(tabId);
  else ids.delete(tabId);
  await chrome.storage.session.set({ [OPEN_TABS_KEY]: [...ids] }).catch(() => {});
}

// Open the panel for the clicked tab. open() must run inside the user gesture,
// so it goes first — before any awaited work that would expire the gesture.
chrome.action.onClicked.addListener((tab) => {
  if (tab.id == null) return;
  const tabId = tab.id;
  chrome.sidePanel.open({ tabId }).catch((error: unknown) => console.error(error));
  void (async () => {
    await chrome.sidePanel
      .setOptions({ tabId, path: PANEL_PATH, enabled: true })
      .catch(() => {});
    await setTabOpen(tabId, true);
  })();
});

// On tab switch, the panel is available only where the user opened it.
chrome.tabs.onActivated.addListener(({ tabId }) => {
  void (async () => {
    const enabled = (await readOpenTabs()).includes(tabId);
    await chrome.sidePanel
      .setOptions(
        enabled
          ? { tabId, path: PANEL_PATH, enabled: true }
          : { tabId, enabled: false }
      )
      .catch(() => {});
  })();
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void setTabOpen(tabId, false);
});

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
 * chrome.scripting and relay the result back. Open annotated.sh tabs are tried
 * first (no flicker); if none is open we open one in the *background*, let
 * clerk-js hydrate, mint the token, and close it again — so publish works
 * without the user having to keep a tab open. This also keeps the Clerk SDK out
 * of the service-worker bundle entirely.
 *
 * Returns null when no signed-in web context can produce a token (caller prompts
 * sign-in).
 */
async function mintTokenInTab(tabId: number): Promise<string | null> {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: async () => {
      const clerk = (window as unknown as { Clerk?: any }).Clerk;
      if (!clerk) return null;
      try {
        await clerk.load?.();
      } catch {
        /* already loaded */
      }
      // clerk.session can lag right after load — poll (longer for a freshly
      // opened tab whose session is still hydrating), and fall back to the
      // active session on the client if the convenience getter is null.
      const findSession = () =>
        clerk.session ??
        clerk.client?.activeSessions?.[0] ??
        clerk.client?.sessions?.find((s: any) => s?.status === "active") ??
        null;
      let session = findSession();
      for (let i = 0; i < 50 && !session; i++) {
        await new Promise((r) => setTimeout(r, 100));
        session = findSession();
      }
      if (!session) return null;
      return (await session.getToken({ template: "convex" })) ?? null;
    },
  });
  return (injection?.result as string | null | undefined) ?? null;
}

/** Resolves once the tab finishes loading (or a timeout elapses). */
function waitForTabComplete(tabId: number, timeoutMs = 15000): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      chrome.tabs.onUpdated.removeListener(listener);
      clearTimeout(timer);
      resolve();
    };
    const listener = (
      changedTabId: number,
      changeInfo: chrome.tabs.TabChangeInfo
    ): void => {
      if (changedTabId === tabId && changeInfo.status === "complete") finish();
    };
    chrome.tabs.onUpdated.addListener(listener);
    const timer = setTimeout(finish, timeoutMs);
    // Guard against the tab having already finished before we attached.
    chrome.tabs
      .get(tabId)
      .then((tab) => {
        if (tab.status === "complete") finish();
      })
      .catch(() => finish());
  });
}

async function fetchConvexToken(): Promise<string | null> {
  if (!webUrl) throw new Error("Missing PLASMO_PUBLIC_WEB_URL");
  const origin = new URL(webUrl).origin;

  const tabs = (await chrome.tabs.query({ url: `${origin}/*` })).filter((t) => t.id != null);
  for (const tab of tabs) {
    const token = await mintTokenInTab(tab.id!);
    if (token) return token;
  }

  // No open tab could mint a token — open a background one, wait for clerk-js to
  // hydrate the session, mint, then close the tab we created.
  const created = await chrome.tabs.create({ url: webUrl, active: false });
  if (created.id == null) return null;
  try {
    await waitForTabComplete(created.id);
    return await mintTokenInTab(created.id);
  } finally {
    await chrome.tabs.remove(created.id).catch(() => {});
  }
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
