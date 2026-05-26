import type {
  GetArticlePageResponse,
  GetPodcastPageResponse,
} from "./messages";

// These two detectors run in the PAGE — either as the body of the declarative
// content scripts (contents/article.ts, contents/podcast-rss.ts) OR injected
// on-demand via chrome.scripting.executeScript when a tab was opened before the
// extension loaded (so its content script is absent). executeScript serializes
// the function with .toString() and runs it in the page with NO access to this
// module's scope — so each MUST be fully self-contained: every helper, regex,
// and constant lives inside the function body, and it references only DOM
// globals (document, location). Do not lift anything to module scope.

/**
 * Detects whether the active page looks like a news article and, if so, returns
 * its live outerHTML (so the worker runs Readability on exactly what the user
 * sees). Conservative — an `<article>` element or `og:type=article` — so it
 * doesn't hijack home pages or app shells.
 */
export function detectArticleInPage(): GetArticlePageResponse {
  const hasArticleElement = document.querySelector("article") !== null;
  const ogTypeMeta = document.querySelector('meta[property="og:type"]');
  const ogType = (ogTypeMeta?.getAttribute("content") ?? "").toLowerCase();
  const looksLikeArticle = hasArticleElement || ogType === "article";

  return {
    html: looksLikeArticle ? document.documentElement.outerHTML : null,
    title: document.title || null,
    url: location.href,
  };
}

/**
 * Detects a podcast on the active page: an advertised RSS feed link, and/or an
 * in-page episode enclosure (NPR/Snap Judgment publish episodes tagged like
 * articles with an in-page `<audio>` player). Returns the signals the sidepanel
 * resolver needs; all null when the page isn't a podcast.
 */
export function detectPodcastPageInfo(): GetPodcastPageResponse {
  const PODCAST_CDN =
    /(podtrac|simplecastaudio|megaphone\.fm|chrt\.fm|pdst\.fm|libsyn|chartable|byspotify|mgln\.ai|arttrk|pscrb\.fm|claritaspod|blubrry|backtracks|dcs\.megaphone)/i;
  const AUDIO_EXT = /\.(mp3|m4a|aac|ogg|oga|wav)(\?|#|$)/i;

  const isEpisodeAudio = (url: string | null | undefined): url is string =>
    typeof url === "string" && (PODCAST_CDN.test(url) || AUDIO_EXT.test(url));

  const findRssLink = (): string | null => {
    const link = document.querySelector<HTMLLinkElement>(
      'link[rel="alternate"][type="application/rss+xml"]'
    );
    return link?.href ?? null;
  };

  const findEpisodeEnclosure = (): string | null => {
    const audio = document.querySelector<HTMLAudioElement>("audio");
    if (audio) {
      if (isEpisodeAudio(audio.currentSrc)) return audio.currentSrc;
      if (isEpisodeAudio(audio.getAttribute("src"))) return audio.src;
      const source = audio.querySelector<HTMLSourceElement>("source[src]");
      if (source && isEpisodeAudio(source.getAttribute("src"))) return source.src;
    }

    const dataAudio = document
      .querySelector("[data-audio]")
      ?.getAttribute("data-audio");
    if (dataAudio) {
      try {
        const parsed = JSON.parse(dataAudio) as { audioUrl?: string };
        if (isEpisodeAudio(parsed?.audioUrl)) return parsed.audioUrl ?? null;
      } catch {
        // data-audio wasn't JSON — ignore.
      }
    }

    const ogAudio = document
      .querySelector<HTMLMetaElement>('meta[property="og:audio"]')
      ?.getAttribute("content");
    if (isEpisodeAudio(ogAudio)) return ogAudio;

    const anchors = document.querySelectorAll<HTMLAnchorElement>("a[href]");
    for (let i = 0; i < anchors.length; i += 1) {
      if (isEpisodeAudio(anchors[i]?.href)) return anchors[i]!.href;
    }
    return null;
  };

  const findShowName = (): string | null =>
    document
      .querySelector<HTMLMetaElement>('meta[property="og:site_name"]')
      ?.getAttribute("content") ?? null;

  return {
    rssUrl: findRssLink(),
    pageTitle: document.title || null,
    enclosureUrl: findEpisodeEnclosure(),
    showName: findShowName(),
  };
}
