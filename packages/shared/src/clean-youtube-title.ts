/**
 * Normalizes a YouTube browser-tab title into a clean source title: drops the
 * leading `(N)` unread-notification badge YouTube prepends and the trailing
 * ` - YouTube` suffix. A non-numeric parenthetical (e.g. "(Official Video)") is
 * left intact since only the numeric badge is browser chrome.
 */
export function cleanYoutubeTitle(raw: string): string {
  return raw
    .replace(/^\(\d+\)\s*/, "")
    .replace(/ - YouTube$/, "")
    .trim();
}
