import { cleanYoutubeTitle } from "@annotated/shared";
import {
  GET_PLAYER_TIME,
  type GetPlayerTimeResponse,
} from "./messages";

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/**
 * Reads the active tab's player position in ms. First asks the declarative
 * content script; if the tab was opened before the extension loaded that script
 * isn't present and `sendMessage` rejects, so we fall back to injecting a one-off
 * reader via `chrome.scripting` — which works without a page reload. Returns null
 * only when there is genuinely no player (not a watch page).
 */
export async function requestPlayerTimeMs(): Promise<number | null> {
  const tab = await getActiveTab();
  if (!tab?.id) return null;

  try {
    const response = (await chrome.tabs.sendMessage(tab.id, {
      type: GET_PLAYER_TIME,
    })) as GetPlayerTimeResponse | undefined;
    if (typeof response?.currentTimeMs === "number") {
      return response.currentTimeMs;
    }
  } catch {
    // No content script in this tab yet — fall through to programmatic injection.
  }

  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const video =
          document.querySelector<HTMLVideoElement>("video.html5-main-video");
        return video ? Math.round(video.currentTime * 1000) : null;
      },
    });
    return typeof injection?.result === "number" ? injection.result : null;
  } catch {
    return null;
  }
}

/** Active tab title cleaned of YouTube's badge/suffix chrome, for source attribution. */
export async function getActiveVideoTitle(): Promise<string> {
  const tab = await getActiveTab();
  return cleanYoutubeTitle(tab?.title ?? "YouTube video");
}
