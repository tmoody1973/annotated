import type { PlasmoCSConfig } from "plasmo";
import {
  GET_PLAYER_TIME,
  type GetPlayerTimeResponse,
} from "../lib/messages";

export const config: PlasmoCSConfig = {
  matches: ["*://*.youtube.com/watch*"],
};

const MS_PER_SECOND = 1_000;

/** The main player video, excluding the ad/preview <video> elements YouTube also mounts. */
function findPlayerVideo(): HTMLVideoElement | null {
  return document.querySelector<HTMLVideoElement>("video.html5-main-video");
}

/**
 * Replies to the sidepanel's playback-time requests with the main player's
 * current position in ms, so "Set in / Set out" can capture live timestamps
 * without the sidepanel having direct access to the page's video element.
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== GET_PLAYER_TIME) return undefined;

  const video = findPlayerVideo();
  const response: GetPlayerTimeResponse = {
    currentTimeMs: video ? Math.round(video.currentTime * MS_PER_SECOND) : null,
  };
  sendResponse(response);
  return undefined;
});
