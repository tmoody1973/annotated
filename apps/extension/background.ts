// The side panel opens only on the tab where the user clicks the Annotated
// toolbar icon (like Claude) — not one global panel that follows every tab.
//
// The manifest's `side_panel.default_path` registers the panel as enabled on
// EVERY tab, which is why it used to follow you everywhere. The fix is to flip
// the global default to disabled (`setOptions` with no tabId) so the panel is
// hidden by default, then enable it only on tabs the user opted into by clicking
// the icon. Disabled tabs hide the panel; enabled tabs auto-show it on return.
// The opted-in set lives in chrome.storage.session so it survives the service
// worker being torn down between events.
const PANEL_PATH = "sidepanel.html";
const OPEN_TABS_KEY = "panel-open-tabs";

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: false })
  .catch((error: unknown) => console.error(error));

// Hidden on every tab by default — only opted-in tabs (below) re-enable it.
chrome.sidePanel
  .setOptions({ path: PANEL_PATH, enabled: false })
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

// Open the panel for the clicked tab. Enable this tab first, then open — both
// fired synchronously (no await between) so the user gesture that open() requires
// isn't consumed, and so the tab is enabled before/as it opens despite the
// disabled global default.
chrome.action.onClicked.addListener((tab) => {
  if (tab.id == null) return;
  const tabId = tab.id;
  void chrome.sidePanel
    .setOptions({ tabId, path: PANEL_PATH, enabled: true })
    .catch(() => {});
  void chrome.sidePanel.open({ tabId }).catch((error: unknown) => console.error(error));
  void setTabOpen(tabId, true);
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
      // Never await a Clerk call unbounded — on a tab whose session is degraded
      // (e.g. token-refresh failing), load()/getToken() can hang forever, which
      // would leave a publish spinning indefinitely. Race every hop to a timeout.
      const withTimeout = (value: unknown, ms: number): Promise<unknown> =>
        Promise.race([
          Promise.resolve(value).catch(() => null),
          new Promise((resolve) => setTimeout(() => resolve(null), ms)),
        ]);

      const readClerk = () => (window as unknown as { Clerk?: any }).Clerk;
      // A freshly opened tab hasn't attached window.Clerk yet — wait for it
      // (this is why a cold relay tab returned null too early before).
      let clerk = readClerk();
      for (let i = 0; i < 50 && !clerk; i++) {
        await new Promise((r) => setTimeout(r, 100));
        clerk = readClerk();
      }
      if (!clerk) return null;

      await withTimeout(clerk.load?.(), 4000);

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

      return (await withTimeout(session.getToken({ template: "convex" }), 6000)) ?? null;
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

/** Belt-and-suspenders: even if executeScript itself stalls on an unresponsive
 *  tab, the mint can't hang the publish — it resolves to null after `ms`. */
function mintWithTimeout(tabId: number, ms = 12000): Promise<string | null> {
  return Promise.race([
    mintTokenInTab(tabId).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

async function fetchConvexToken(): Promise<string | null> {
  if (!webUrl) throw new Error("Missing PLASMO_PUBLIC_WEB_URL");
  const origin = new URL(webUrl).origin;

  const tabs = (await chrome.tabs.query({ url: `${origin}/*` })).filter((t) => t.id != null);
  for (const tab of tabs) {
    const token = await mintWithTimeout(tab.id!);
    if (token) return token;
  }

  // No open tab could mint a token — open a background one, wait for clerk-js to
  // hydrate the session, mint, then close the tab we created.
  const created = await chrome.tabs.create({ url: webUrl, active: false });
  if (created.id == null) return null;
  try {
    await waitForTabComplete(created.id);
    return await mintWithTimeout(created.id);
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
