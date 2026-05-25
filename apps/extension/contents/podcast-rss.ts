import type { PlasmoCSConfig } from "plasmo";
import {
  GET_PODCAST_PAGE,
  type GetPodcastPageResponse,
} from "../lib/messages";

// Runs on any page so the sidepanel can detect podcast feeds on generic sites
// (NPR, show homepages). Apple/Spotify are detected from the URL alone and
// never reach here. YouTube has its own content script.
export const config: PlasmoCSConfig = {
  matches: ["https://*/*", "http://*/*"],
  exclude_matches: [
    "*://*.youtube.com/*",
    "*://podcasts.apple.com/*",
    "*://open.spotify.com/*",
  ],
};

/** The first RSS feed link the page advertises, or null. */
function findRssLink(): string | null {
  const link = document.querySelector<HTMLLinkElement>(
    'link[rel="alternate"][type="application/rss+xml"]'
  );
  return link?.href ?? null;
}

// Hosts that only ever serve podcast episode audio, and bare audio extensions.
// Either signal marks a URL as a clippable episode enclosure.
const PODCAST_CDN =
  /(podtrac|simplecastaudio|megaphone\.fm|chrt\.fm|pdst\.fm|libsyn|chartable|byspotify|mgln\.ai|arttrk|pscrb\.fm|claritaspod|blubrry|backtracks|dcs\.megaphone)/i;
const AUDIO_EXT = /\.(mp3|m4a|aac|ogg|oga|wav)(\?|#|$)/i;

function isEpisodeAudio(url: string | null | undefined): url is string {
  return typeof url === "string" && (PODCAST_CDN.test(url) || AUDIO_EXT.test(url));
}

/**
 * Finds a podcast episode's audio URL embedded directly in the page — the case
 * NPR/Snap Judgment/Audible publish: an episode tagged like an article but with
 * an in-page `<audio>` player. Checks the audio element, NPR's `data-audio`
 * JSON, and any podcast-CDN link. Returns null when no episode audio is present.
 */
function findEpisodeEnclosure(): string | null {
  const audio = document.querySelector<HTMLAudioElement>("audio");
  if (audio) {
    if (isEpisodeAudio(audio.currentSrc)) return audio.currentSrc;
    if (isEpisodeAudio(audio.getAttribute("src"))) return audio.src;
    const source = audio.querySelector<HTMLSourceElement>("source[src]");
    if (isEpisodeAudio(source?.src)) return source!.src;
  }

  const dataAudio = document.querySelector("[data-audio]")?.getAttribute("data-audio");
  if (dataAudio) {
    try {
      const parsed = JSON.parse(dataAudio) as { audioUrl?: string };
      if (isEpisodeAudio(parsed.audioUrl)) return parsed.audioUrl ?? null;
    } catch {
      // data-audio wasn't JSON — ignore.
    }
  }

  const ogAudio = document
    .querySelector<HTMLMetaElement>('meta[property="og:audio"]')
    ?.content;
  if (isEpisodeAudio(ogAudio)) return ogAudio;

  for (const anchor of document.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    if (isEpisodeAudio(anchor.href)) return anchor.href;
  }
  return null;
}

/** Best-effort show name from Open Graph site metadata. */
function findShowName(): string | null {
  return (
    document.querySelector<HTMLMetaElement>('meta[property="og:site_name"]')
      ?.content ?? null
  );
}

/**
 * Replies to the sidepanel's podcast-detection request with the page's RSS
 * feed link and title, so the panel can resolve a generic show page to a
 * clippable episode without the sidepanel reaching into the page's DOM.
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== GET_PODCAST_PAGE) return undefined;

  const response: GetPodcastPageResponse = {
    rssUrl: findRssLink(),
    pageTitle: document.title || null,
    enclosureUrl: findEpisodeEnclosure(),
    showName: findShowName(),
  };
  sendResponse(response);
  return undefined;
});
