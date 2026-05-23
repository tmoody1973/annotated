# Annotated, with audio

There's a $5K bounty going around for a Chrome sidebar that lets you clip and annotate media from anywhere on the web. Jason Calacanis put it up. The spec is tight: ship a Chrome sidebar extension, support YouTube, articles, and podcasts, cap clips at 90 seconds, downscale video to 240p, public feed with follow and comment, X or Google auth only, "File a claim" button on every annotation page. Sixteen entries in so far. The judging criterion, in J-Cal's own words: *"the cleanest and most complete execution wins."*

I'm building one. Here's what I'm doing differently.

## The field's blind spot is audio

Every entry I've reviewed treats the three source types — YouTube, articles, podcasts — as equal-weight checkboxes. The serious ones lead with YouTube, treat articles as a free win, and bolt on podcasts as an afterthought. The top-scoring landing pages claim all three; the actual product evidence lives almost entirely in YouTube-land.

That's the gap.

I've spent two decades in public radio — hosting Rhythm Lab Radio since the mid-2000s, co-hosting the This Bites food podcast with Ann Christenson, launching HYFIN on Juneteenth 2022. Clipping audio is muscle memory at this point. If everyone else is going to treat podcasts as a checkbox, I'm going to ship the version where the *podcast* path is the hero.

## The wedge: transcript-anchored audio clipping

When the sidebar opens on a podcast page — Apple Podcasts, Spotify, or any show site with an RSS feed — it auto-transcribes the episode and surfaces the full transcript inline. You drag-highlight a paragraph. A 90-second audio clip materializes, exactly matching the highlighted words, waveform rendered. You record voice commentary or type one. You publish. The annotation appears in the public feed, source-linked back to the original episode.

Nobody else in the field has shipped that flow. It's fully spec-compliant — every requirement is met — but the *podcast experience* is visibly better than what's on the entries page. That's the entire bet.

## The stack, briefly

Next.js 16 on Vercel for the web app, feed, and landing pages. Plasmo for the MV3 sidepanel because writing vanilla Chrome extensions in 2026 is unserious. Clerk for X + Google auth. Convex for real-time data. Deepgram Nova-3 for transcription — word-level timestamps and speaker diarization, which buys us free speaker badges on landing pages. A Fly.io worker handles ffmpeg, yt-dlp, and Deepgram callbacks. The iTunes Lookup API and Podcast Index resolve podcast page URLs to RSS feeds; the Spotify Web API handles metadata when users are on Spotify pages (we bounce to RSS for the actual audio, since Spotify's API only exposes 30-second previews). YouTube Data API for metadata, yt-dlp for video and captions.

The whole architecture exists to make one moment fast: drag across transcript words, see the audio clip appear.

## What I'm not building

The spec is the spec. Scope cuts make the cleanest execution possible:

- No transcript editing. Deepgram's output is the transcript you see.
- No support for Spotify-exclusive shows with no RSS feed. Sidebar shows a graceful "this episode can't be clipped" message.
- No claim moderation queue in v1. Claims go to the database and email me; I handle them by hand.
- No multi-clip threads, no AI summarization, no cross-source annotations, no bookmark folders. All interesting; all wrong for a "cleanest execution" bounty.

## Four amplifiers, no more

The base spec is the spec. These four additions compound the audio thesis without scope-creeping into a different product.

1. **Smart clip suggestions.** When the sidebar opens an episode, surface three auto-detected "interesting moments" from the transcript — speaker-change density, named-entity mentions, sentiment shifts. Tap one, clip is pre-populated. Changes the product from "I knew what I wanted to clip" to "annotated showed me what was worth clipping."
2. **Quote card export.** Every annotation page generates a 1080×1080 PNG — quote, source attribution, waveform, watermark. Shareable on X. Distribution engine.
3. **Speaker badges.** "Chamath: '…'" on multi-host shows. Free output from Deepgram diarization.
4. **Source-page badge.** When the sidebar opens a piece of media that already has annotations on it, show them. Discovery without forcing users to the feed.

## Real vs faked for the demo

The live product is all real. The 60-second demo video is where I cache strategically — never to fake functionality, only to remove dead air.

| Element | Real or staged | Why |
|---|---|---|
| Transcript | Real, but pre-warmed for the demo episode | Avoids a 60-second Deepgram wait on camera |
| ffmpeg slice | Real | Sub-2 seconds, no need to stage |
| Feed annotations | 8-10 real annotations I seeded | Empty feed reads as a broken product |
| Voice commentary | Recorded live in the demo | This is the hero moment |
| Landing page | Real | This is also the hero moment |

## The 60-second hero

1. Open the sidebar on a podcast episode page.
2. Drag across transcript words.
3. Audio clip materializes with waveform.
4. Record 15-second voice commentary.
5. Publish.
6. Cut to the public feed — annotation is the first post. Someone has already replied.

If those 60 seconds feel inevitable, I win. Everything else is plumbing.

## Ship date

When it's clean. J-Cal hasn't published a deadline; the entries page suggests submissions are still flowing. Building in public on LinkedIn and Substack as I go. The first working build of the YouTube path is the first demo I post.

---

*Annotated.com is a $5,000 bounty from Jason Calacanis to build a Chrome sidebar extension for clipping and annotating web media. Spec at [annotated.lovable.app](https://annotated.lovable.app/). I'm building it audio-first.*
