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
    version: "v0.4.3",
    date: "2026-08-17",
    title: "The video tells you where its good parts are",
    lead:
      "If a video has chapters, the panel lists them and you can tap one instead of hunting for the moment yourself. It also stopped asking you to sign in for something that was never private.",
    changes: [
      "Chapters are back. A video with chapters shows them on the clip screen — tap one and your clip becomes that chapter, trimmed to 90 seconds if it runs longer.",
      "Tapping a chapter also titles your take, so you start writing from a labelled point instead of an empty box. Change your mind and pick another one and the title follows; once you've written anything of your own, it stays put.",
      "Chapters work before you sign in. Clipping never needed an account, and chapters are how you decide what to clip — asking you to log in first was withholding help at the moment you needed it.",
      "Honest note: chapters went missing in the four-screen redesign, and were broken underneath it too — the server had stopped converting YouTube's timings into the shape the app expects, so even a video that had chapters came back empty. Both are fixed. Nobody reported either one; they were found by being asked where the feature went.",
    ],
  },
  {
    // Web only — it shipped no extension build, and numbering it v0.4.3
    // collided with the extension release that followed it.
    version: "v0.4.2.1",
    date: "2026-08-16",
    title: "The things that quietly didn't work",
    lead:
      "Two gaps that never announced themselves. There was no way to report a clip unless you were claiming copyright on it, and any podcast episode longer than about an hour couldn't be clipped at all.",
    changes: [
      "Long episodes work now. Anything past roughly 70 minutes used to fail without saying why — the transcript was too big to store. It now takes about a quarter of the room it did, so a three-hour show fits with space to spare. Every podcast on the site so far has been a 15–30 minute segment, which is why nobody had hit this.",
      "Every clip page has a Report a problem button. You pick what's wrong — misleading, missing context, wrong person credited, harassment, spam, or something else — and say what we should know.",
      "You don't have to say who you are. An email address is optional, and it's only used if you want a reply.",
      "File a Claim is still there and unchanged. It's for copyright and rights matters; reports are for everything else.",
      "Reports go straight to a person and are read by hand. There is still no moderation queue, so there's no status page to watch and no automatic action on the clip.",
    ],
  },
  {
    version: "v0.4.2",
    date: "2026-08-16",
    title: "What you publish is yours to manage",
    lead:
      "Publishing used to be one-way. A clip that failed stayed broken, a typo in your take stayed there, and there was no way to take anything down. All three are yours now.",
    changes: [
      "Annotated is on the Chrome Web Store. Installing is one click now, and the extension keeps itself up to date. You can still install it by hand from the .zip if you'd rather — it's the same build, it just never updates itself.",
      "A clip that failed to process has a Try again button, and it rebuilds in place — same link, same votes, same replies. Before, the only way forward was publishing a second clip at a new address and leaving the broken one up for anyone holding the old link.",
      "Fewer clips fail in the first place. When the fast way of cutting a video doesn't work, we now fall back to a slower, more careful way instead of giving up, and a one-off hiccup is retried rather than treated as final.",
      "You can remove a clip you published. The link keeps working and says it was taken down, instead of becoming a dead page for anyone who saved or shared it — but the clip, your take, and the preview that shows up when the link is pasted into a chat are all gone.",
      "Removing can't be undone. The video file is deleted, so bringing a clip back means clipping it again.",
      "You can fix your take right up until the first vote or reply, and then it's fixed for good. Rewriting it later would change what people had already agreed with.",
      "You can delete a note you left on someone's clip. The reply keeps its place so the conversation still reads in order, but the text is gone and the note count matches what you can actually see.",
      "Only you can remove your own work. There is no way to remove someone else's and no moderation queue yet.",
    ],
  },
  {
    version: "v0.4.1",
    date: "2026-08-13",
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
      "The extension no longer runs on pages you haven't asked it to. It used to load a small piece of itself into every website you visited, whether or not you ever opened the panel. Now nothing runs until you open it and pick something to clip.",
      "Some YouTube clips were failing to process and there was no useful reason given — the page would say the clip couldn't be made and suggest trying again, which would fail the same way. Two separate causes, both fixed: the tool we use to fetch video had gone stale, and clips that were downloading perfectly well were being cut off after 60 seconds.",
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
