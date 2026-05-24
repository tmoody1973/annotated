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
 * Asks the active tab's content script for the player's current time in ms.
 * Returns null when the tab has no content script (not a watch page) or no
 * player was found — the caller treats null as "couldn't read playback".
 */
export async function requestPlayerTimeMs(): Promise<number | null> {
  const tab = await getActiveTab();
  if (!tab?.id) return null;

  try {
    const response = (await chrome.tabs.sendMessage(tab.id, {
      type: GET_PLAYER_TIME,
    })) as GetPlayerTimeResponse | undefined;
    return typeof response?.currentTimeMs === "number"
      ? response.currentTimeMs
      : null;
  } catch {
    return null;
  }
}

/** Active tab title cleaned of YouTube's badge/suffix chrome, for source attribution. */
export async function getActiveVideoTitle(): Promise<string> {
  const tab = await getActiveTab();
  return cleanYoutubeTitle(tab?.title ?? "YouTube video");
}
