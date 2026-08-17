# Pending changelog entry — extension v0.4.3

**Do not publish until 0.4.3 is live on the Chrome Web Store.** Until then it
is a false entry, which is the mistake the v0.4.2 "delete a note" line already
made once. When the store shows 0.4.3, paste this at the top of
`apps/web/content/changelog.ts` and deploy.

```ts
{
  version: "v0.4.3",
  date: "TODO — the date the store approves it",
  title: "The video tells you where its good parts are",
  lead:
    "If a video has chapters, the panel lists them and you can tap one instead of hunting for the moment yourself. It also stopped asking you to sign in for something that was never private.",
  changes: [
    "Chapters are back. A video with chapters shows them on the clip screen — tap one and your clip becomes that chapter, trimmed to 90 seconds if it runs longer.",
    "Tapping a chapter also titles your take, so you start writing from a labelled point instead of an empty box. Change your mind and pick another one and the title follows; once you've written anything of your own, it stays put.",
    "Chapters work before you sign in. Clipping never needed an account, and chapters are how you decide what to clip — asking you to log in first was withholding help at the moment you needed it.",
    "Honest note: this went missing in the four-screen redesign and shipped broken in 0.4.1 and 0.4.2. Nobody reported it; it was found by being asked where it went.",
  ],
},
```
