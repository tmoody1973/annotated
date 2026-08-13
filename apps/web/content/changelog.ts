/**
 * Changelog entries, newest first. Add a release by adding one object here —
 * nothing else needs to change.
 *
 * Voice rules (read before adding an entry):
 * - Write for someone who doesn't read code. Say what changed for the user,
 *   not what was refactored. "Publishing is instant now" beats "optimistic
 *   publish via a scheduled Convex action."
 * - `title` is one plain-English headline naming the release's theme, not a
 *   feature list — "Clip pages update themselves," not "Implement reactive
 *   ClipMedia subscription."
 * - Be honest about limits. If a feature has a caveat, say it in a bullet.
 *   That honesty is more useful to readers than a polished feature tour.
 * - No "Added / Fixed / Changed" tags, no emoji, no invented metrics — only
 *   numbers we actually measured.
 */
export interface Release {
  /** e.g. "v0.3.0" */
  version: string;
  /** ISO date, e.g. "2026-08-12" — formatted for display at render time. */
  date: string;
  /** Plain-English headline naming the release's theme. */
  title: string;
  /** 1–3 sentences: what a user can now do. */
  lead: string;
  /** Concrete, user-facing bullets. */
  changes: string[];
}

export const CHANGELOG: Release[] = [
  {
    version: "v0.4.0",
    date: "2026-08-12",
    title: "The side panel became four screens",
    lead:
      "The panel used to be one long scroll that asked for everything at once. It's now four steps — pick the source, choose the clip, write your take, share the link — with a real scrubber you can drag, and a back button that never throws away what you typed.",
    changes: [
      "There's a proper scrubber for video now. Drag the middle of the yellow bar to move your clip, drag either end to make it longer or shorter, or type the times in by hand — all three stay in step with each other.",
      "The scrubber zooms to your clip instead of drawing the whole video. On an hour-long talk a 90-second clip used to be about eight pixels wide, with the drag handles sitting on top of it, so there was nothing to grab.",
      "Dragging past the end of the visible strip now scrolls along the video instead of jumping.",
      "The clip length can't go over 90 seconds, but the handles simply stop there rather than letting you overshoot and then telling you off.",
      "Podcast clips are made by dragging across the transcript, and that drag now gets the whole panel. Tapping the first and last word still works, and so does the keyboard.",
      "You can start clipping without signing in. You're only asked to sign in when you publish, and your clip and take are kept while you do.",
      "Publish is never greyed out because you haven't picked a topic — a likely topic is filled in for you and you can change or remove it.",
      "The panel has a dark mode. It follows whatever your computer is set to.",
      "Every step announces itself to screen readers, the scrubber handles work with arrow keys, and moving between steps puts your cursor in the right place.",
      "Going back a step keeps what you wrote. Switching browser tabs and coming back returns you to the step you were on, not just the text.",
      "When there's nothing to clip on a page, the panel says why and offers somewhere to go, instead of showing an empty box.",
      "Clips still take a minute or two to finish processing after you publish — the page and link work immediately, and the video fills in when it's ready.",
      "Clipping an article needs you signed in, because the page text is read on our side. Video and podcast clips don't.",
    ],
  },
  {
    version: "v0.3.0",
    date: "2026-08-12",
    title: "Clip pages update themselves",
    lead:
      "Publishing a clip used to mean waiting for it to finish before you got a link. Now the link exists in about two seconds, and the page fills in the clip on its own — no refresh, and closing the side panel early no longer cancels the job.",
    changes: [
      "Publishing is instant: the clip page and its shareable link exist while the clip is still processing in the background.",
      "Clip pages update themselves the moment the clip is ready — you don't need to reload.",
      "Closing the side panel right after you publish no longer kills the clip.",
      "YouTube clips are roughly three times faster to cut — about 9 seconds now, down from 24–32.",
      "The extension itself is much smaller to install and update: 3.5MB down to 156KB.",
      "The feed is wider — the \"who to follow\" suggestions moved under the left-hand menu instead of squeezing the feed.",
      "Follow suggestions only show people who have actually published a clip, instead of empty accounts.",
      "On a clip page, the source's headline now sits above the clip at full size, so you know what you're about to watch or hear before you press play.",
      "The audio waveform now fills its player instead of stopping partway across.",
      "The side panel's sign-in status now reflects reality — it used to say \"Sign in\" even when you already were.",
      "Every account now gets its own profile URL. A handful of accounts had ended up sharing the same one; that's fixed.",
    ],
  },
  {
    version: "v0.2.0",
    date: "2026-06-01",
    title: "The extension stopped losing your clips",
    lead:
      "A run of reliability fixes for the side panel and the podcast path: publishing no longer hangs, the panel only opens where you clicked, and podcast clips finally sound like the episode you selected.",
    changes: [
      "Podcast clip audio now matches the transcript you selected — it used to occasionally drift out of sync when an episode had ads inserted after publishing.",
      "The side panel now opens only on the tab you clicked it on, instead of popping up on every tab you have open.",
      "Publishing can no longer hang indefinitely — every step now has a timeout, so a slow network gives you an error instead of a stuck spinner.",
      "Added a direct-download install page for testers who can't use the Chrome Web Store yet.",
      "YouTube and podcast source titles now backfill correctly instead of showing blank or placeholder text on older clips.",
    ],
  },
  {
    version: "v0.1.0",
    date: "2026-05-29",
    title: "Topics, profiles, and a way to share what you clipped",
    lead:
      "The early foundation: a browsable topics directory, a real profile page for every account, and a way to turn a clip into something you can post elsewhere.",
    changes: [
      "Added a Topics page — browse clips by subject instead of only the main feed.",
      "Every account now has a shareable profile page at its own URL.",
      "Added a share-as-image option, so a clip can be posted as a card outside Annotated, not just linked.",
      "Added the About and Publishers pages explaining what Annotated is and how publishers can respond to clips of their work.",
      "The feed is now consistent across every page — same header, same navigation, wherever you are in the app.",
    ],
  },
];
