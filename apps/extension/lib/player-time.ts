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

/**
 * Reads the channel name + absolute channel URL from the active YouTube watch
 * page (the creator the clip points at).
 *
 * Primary source is YouTube's own embedded player data —
 * `#movie_player.getPlayerResponse().videoDetails` (live on SPA navigation),
 * falling back to the page's `ytInitialPlayerResponse` global. These give the
 * exact `author` + `channelId` YouTube uses, so we don't depend on the rendered
 * DOM, which changes shape often and isn't present until the watch page hydrates.
 * The owner-link CSS selectors remain a last-resort fallback.
 *
 * Page globals live in the MAIN world, not the extension's isolated content
 * world, so the reader is injected with `world: "MAIN"`. Returns nulls when not a
 * watch page or nothing resolves, so publish degrades gracefully.
 *
 * Capture this when the video is *detected* (the active tab is reliably the video
 * then), not at publish time — by publish the active tab may be elsewhere.
 */
export async function getActiveVideoChannel(): Promise<{
  name: string | null;
  url: string | null;
}> {
  const tab = await getActiveTab();
  if (!tab?.id) return { name: null, url: null };
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: () => {
        type VideoDetails = { author?: string; channelId?: string };
        type PlayerResponse = { videoDetails?: VideoDetails };

        const fromDetails = (
          response: PlayerResponse | null | undefined
        ): { name: string | null; url: string | null } | null => {
          const details = response?.videoDetails;
          if (!details?.author && !details?.channelId) return null;
          return {
            name: details.author?.trim() || null,
            url: details.channelId
              ? `https://www.youtube.com/channel/${details.channelId}`
              : null,
          };
        };

        const player = document.querySelector("#movie_player") as
          | (Element & { getPlayerResponse?: () => PlayerResponse })
          | null;
        const live =
          typeof player?.getPlayerResponse === "function"
            ? player.getPlayerResponse()
            : null;
        const fromLive = fromDetails(live);
        if (fromLive) return fromLive;

        const initial = (
          window as unknown as { ytInitialPlayerResponse?: PlayerResponse }
        ).ytInitialPlayerResponse;
        const fromInitial = fromDetails(initial);
        if (fromInitial) return fromInitial;

        const anchor = document.querySelector<HTMLAnchorElement>(
          "ytd-video-owner-renderer a.yt-simple-endpoint, #owner #channel-name a, ytd-channel-name a"
        );
        const name = anchor?.textContent?.trim() || null;
        const href = anchor?.getAttribute("href") || null;
        const url = href ? new URL(href, location.origin).href : null;
        return { name, url };
      },
    });
    return injection?.result ?? { name: null, url: null };
  } catch {
    return { name: null, url: null };
  }
}
