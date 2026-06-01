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

export interface ActiveVideoMeta {
  title: string | null;
  channelName: string | null;
  channelUrl: string | null;
}

/**
 * Reads the video title, channel name, and absolute channel URL from the active
 * YouTube watch page — the attribution a clip points at.
 *
 * All three come from YouTube's own embedded player data
 * (`#movie_player.getPlayerResponse().videoDetails`, falling back to the
 * `ytInitialPlayerResponse` global), which carries the exact `title`, `author`,
 * and `channelId`. This avoids the rendered DOM, which changes shape and isn't
 * present until the watch page hydrates.
 *
 * Crucially the reader **polls** for that data: when a video is first detected
 * (especially on YouTube's SPA video→video navigation) the player response and
 * even `document.title` lag behind, so reading once too early yields the bare
 * page chrome. We poll ~2s, then fall back to the owner-link DOM + document
 * title as a last resort. Page globals live in the MAIN world, so the reader is
 * injected with `world: "MAIN"`.
 */
export async function getActiveVideoMeta(): Promise<ActiveVideoMeta> {
  const empty: ActiveVideoMeta = { title: null, channelName: null, channelUrl: null };
  const tab = await getActiveTab();
  if (!tab?.id) return empty;
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: async () => {
        type VideoDetails = { title?: string; author?: string; channelId?: string };
        type PlayerResponse = { videoDetails?: VideoDetails };

        const fromDetails = (): {
          title: string | null;
          channelName: string | null;
          channelUrl: string | null;
        } | null => {
          const player = document.querySelector("#movie_player") as
            | (Element & { getPlayerResponse?: () => PlayerResponse })
            | null;
          const live =
            typeof player?.getPlayerResponse === "function"
              ? player.getPlayerResponse()
              : null;
          const initial = (
            window as unknown as { ytInitialPlayerResponse?: PlayerResponse }
          ).ytInitialPlayerResponse;
          const details = live?.videoDetails ?? initial?.videoDetails;
          if (!details) return null;
          const channelName = details.author?.trim() || null;
          const title = details.title?.trim() || null;
          if (!channelName && !title) return null;
          return {
            title,
            channelName,
            channelUrl: details.channelId
              ? `https://www.youtube.com/channel/${details.channelId}`
              : null,
          };
        };

        let meta = fromDetails();
        for (let i = 0; i < 20 && !meta; i++) {
          await new Promise((r) => setTimeout(r, 100));
          meta = fromDetails();
        }
        if (meta) return meta;

        // Last resort: the rendered owner link (channel @handle, not /channel/id)
        // and the document title with YouTube's suffix stripped.
        const anchor = document.querySelector<HTMLAnchorElement>(
          "ytd-video-owner-renderer a.yt-simple-endpoint, #owner #channel-name a, ytd-channel-name a"
        );
        const name = anchor?.textContent?.trim() || null;
        const href = anchor?.getAttribute("href") || null;
        const url = href ? new URL(href, location.origin).href : null;
        const docTitle =
          document.title?.replace(/\s*-\s*YouTube\s*$/, "").trim() || null;
        return { title: docTitle, channelName: name, channelUrl: url };
      },
    });
    return injection?.result ?? empty;
  } catch {
    return empty;
  }
}
