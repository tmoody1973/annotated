# Annotated.com — Build Kit

Everything you need to go from empty folder to working scaffold.

---

## 1. Provision external services

Sign up for all of these before running scaffold commands. Collect the keys as you go.

| Service | Tier | What you need from it | Notes |
|---|---|---|---|
| Clerk | Free | Publishable + Secret key | Enable X (Twitter) and Google as the only social providers. Disable email/password and magic links to stay spec-compliant. |
| Convex | Free | Deployment URL + deploy key | `convex dev` creates the project on first run. |
| Vercel | Hobby | Connect later | Connect the GitHub repo when web app is deployable. |
| Fly.io | Hobby | API token | You already have this from Hermes Agent. |
| Deepgram | Free | API key | $200 free credit on signup. Use Nova-3 model. |
| Spotify Developer | Free | Client ID + Secret | developer.spotify.com → create app → Client Credentials only, no redirect URI needed. |
| YouTube Data API v3 | Free | API key | Google Cloud Console → new project → enable YouTube Data API v3 → credentials → API key. |
| Podcast Index | Free | API key + secret | api.podcastindex.org → sign up. Free tier is plenty for v1. |
| **HeroUI Pro** | Paid (license held) | Pro CLI access + MCP install command | heroui.pro dashboard → get the MCP install command for Claude Code; also grab the Pro CLI for installable blocks/templates. |
| **Resend** | Free | API key | resend.com → sign up → API Keys → create key. Used to email Tarik when a claim is submitted. |

---

## 2. Scaffold the monorepo

Run from your dev directory.

```bash
# 1. Create the workspace
pnpm dlx create-turbo@latest annotated
cd annotated

# 2. Strip the example apps + packages
rm -rf apps/web apps/docs packages/ui packages/eslint-config packages/typescript-config

# 3. Web app — Next.js 15
pnpm dlx create-next-app@latest apps/web \
  --typescript --tailwind --app --use-pnpm --no-git --no-import-alias

# 4. Extension — Plasmo
#    When prompted, name it "extension" and pick the sidepanel option
cd apps && pnpm create plasmo && cd ..
mv apps/my-plasmo-extension apps/extension   # rename if Plasmo defaulted

# 5. Worker — Node + Fastify on Fly.io
mkdir -p apps/worker/src && cd apps/worker
pnpm init
pnpm add fastify zod fluent-ffmpeg yt-dlp-exec @deepgram/sdk node-fetch fast-xml-parser
pnpm add -D typescript tsx @types/node @types/fluent-ffmpeg
cd ../..

# 6. Backend — Convex schema + functions
mkdir -p packages/backend && cd packages/backend
pnpm init
pnpm add convex
pnpm dlx convex@latest dev --once
# schema.ts is already at packages/backend/convex/schema.ts — push it in step 3
cd ../..

# 7. Shared package — types, Zod schemas, URL parsers
mkdir -p packages/shared/src && cd packages/shared
pnpm init
pnpm add zod
cd ../..

# 8. Install everything as a workspace
pnpm install

# 9. HeroUI in the web app
cd apps/web
pnpm add @heroui/react @heroui/styles next-themes
# @heroui/styles manages Tailwind CSS v4 configuration and takes precedence over
# the Tailwind setup injected by create-next-app's --tailwind flag. No separate
# tailwindcss install is needed — @heroui/styles brings it in as a dependency.
# Then from HeroUI Pro dashboard, run the Pro CLI to add brutalism-themed blocks/templates
cd ../..

# 10. HeroUI in the extension (same packages, separate install)
cd apps/extension
pnpm add @heroui/react @heroui/styles
cd ../..

# 11. Install the HeroUI Pro MCP into Claude Code
# Get the exact command from your heroui.pro dashboard. Will look something like:
# claude mcp add heroui-pro <command-from-dashboard>
```

Final structure:

```
annotated/
├── apps/
│   ├── web/           Next.js 15 — feed, profiles, annotation landings
│   ├── extension/     Plasmo MV3 side panel
│   └── worker/        Fly.io Node service — ffmpeg, yt-dlp, transcription
├── packages/
│   ├── backend/       Convex (schema, queries, mutations, actions)
│   └── shared/        Zod schemas, URL parsers, shared TS types
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

## 3. Drop in the schema

The schema is already at `packages/backend/convex/schema.ts` in this repo. Push it to Convex:

```bash
cd packages/backend
pnpm dlx convex@latest dev
```

Watch the terminal — Convex deploys the schema and prints the deployment URL. Save that URL.

---

## 4. Environment variables

`apps/web/.env.local`:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CONVEX_URL=
```

`apps/extension/.env`:

```
PLASMO_PUBLIC_CONVEX_URL=
PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY=
```

`apps/worker/.env`:

```
CONVEX_URL=
CONVEX_DEPLOY_KEY=
DEEPGRAM_API_KEY=
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
YOUTUBE_API_KEY=
PODCAST_INDEX_API_KEY=
PODCAST_INDEX_API_SECRET=
WORKER_AUTH_TOKEN=    # random string, shared with Convex
```

Convex env vars (set via the Convex dashboard or `pnpm dlx convex env set`):

```
CLERK_ISSUER_URL=     # from Clerk dashboard → JWT templates → Convex
WORKER_URL=           # Fly.io app URL once deployed
WORKER_AUTH_TOKEN=    # same as the worker's
RESEND_API_KEY=       # from resend.com — used by Convex action on claims insert
```

---

## 5. Build order (v1)

The dependency chain. Ship in this order — each step has a working demo at the end.

1. **Convex schema deployed.** Done after step 3 above.
2. **Auth end-to-end.** Clerk on web app, X + Google providers enabled, user record mirrored into the `users` table on first sign-in.
3. **Worker → Deepgram pipeline.** POST an MP3 URL, get a transcript with word timestamps written to Convex. Standalone testable.
4. **Sidebar detects YouTube + extracts video ID.** Simplest source. Verifies the extension shell + Convex connection from the extension.
5. **End-to-end YouTube clip.** Sidebar selects a clip → worker runs yt-dlp + ffmpeg → annotation lands in Convex → landing page renders.
6. **Podcast detection.** URL parsers for Apple Podcasts, Spotify, generic show sites.
7. **Podcast clip flow.** Most worker code reused from YouTube. Deepgram replaces yt-dlp VTT.
8. **Article path.** Mozilla Readability on the worker. Cheapest source type — text only.
9. **Public feed + follow + comment + like.** Convex real-time queries.
10. **File a claim form + email notification.** Spec-required.

Steps 1-3 are foundational and need to land first. Steps 4-8 are independent feature deliverables. Steps 9-10 close the spec.

**Phase 2 — Amplifiers (after spec is complete)**

11. **Speaker badges.** Add speaker grouping to transcript rendering in sidebar and landing page. No new APIs — uses Deepgram diarization already in the transcript payload.
12. **Smart clip suggestions.** Add heuristic scoring pass in the `transcriptReady` Convex action. Write top-3 spans to `transcripts.suggestedClips`. Render as tap-to-select highlights in the sidebar.
13. **Source-page badge.** Query `annotations` by `canonicalUrl` on sidebar open. Show badge count + inline list panel if annotations exist.
14. **Quote card export.** Add `/api/og/[annotationId]` Vercel edge route using `@vercel/og`. Render 1080×1080 card with quote, waveform, attribution, watermark. Add "Export card" button to annotation landing page.

---

## 6. Demo target

When step 5 ships, you can record a 30-second smoke demo: open the sidebar on a YouTube video, drag a clip, publish, see it in the feed. That's the moment to start building the proper hero demo.

When step 7 ships, record the actual hero demo on a podcast — the wedge. Aim for the 60-second beat sheet we sketched: open sidebar → drag across transcript → audio clip materializes → record voice annotation → publish → feed.
