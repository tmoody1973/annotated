# Annotated

> Clip and annotate media from anywhere on the web — then publish it to a source-linked, social feed.

**Live:** [annotated.sh](https://annotated.sh)

## Overview

Annotated is a Chrome side-panel extension plus a web app that lets you capture a short clip from a **YouTube video, podcast, or news article** on any site, add text or recorded-audio commentary, and publish it to a public landing page and feed with follow, comments, and voting.

The differentiator is the **podcast path**: transcript-anchored audio clipping. Drag across the words in a transcript and get the matching audio segment back — no scrubbing a waveform. Every annotation links back to the original and carries a visible "File a claim" button for fair-use disputes, so Annotated *points at* creators rather than replacing them.

## Tech Stack

| Layer | Technology |
|---|---|
| Web app | Next.js 16 (App Router) on Vercel |
| Extension | Plasmo MV3 side panel (React + TypeScript) |
| Worker | Fastify + Node on Fly.io (ffmpeg, yt-dlp, Deepgram) |
| Backend | Convex (real-time data, file storage, scheduled fns) |
| Auth | Clerk (X + Google OAuth only) |
| UI | HeroUI v3 + Tailwind CSS v4, `brutalism` theme |
| Transcription | Deepgram Nova-3 (podcasts), yt-dlp VTT (YouTube) |
| Email | Resend (claim notifications) |
| Tooling | pnpm workspaces + Turborepo |

## Monorepo Structure

```
annotated/
├── apps/
│   ├── web/         # Next.js feed, profiles, landing pages, web composer
│   ├── extension/   # Plasmo MV3 side panel (clip + annotate + publish)
│   └── worker/      # Fastify service: ffmpeg, yt-dlp, Deepgram webhook
└── packages/
    ├── backend/     # Convex schema + functions (@annotated/backend)
    └── shared/      # Shared TS utils + Zod schemas (@annotated/shared)
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 10+
- Accounts: [Convex](https://convex.dev), [Clerk](https://clerk.com), [Deepgram](https://deepgram.com), [Resend](https://resend.com)
- `ffmpeg` and `yt-dlp` on the machine running the worker

### Installation

```bash
git clone https://github.com/tmoody1973/annotated.git
cd annotated
pnpm install

# Copy the env templates and fill them in (see Environment Variables)
cp apps/extension/.env.example apps/extension/.env
cp apps/worker/.env.example apps/worker/.env
# apps/web env vars are set in Vercel / a local .env.local (see below)
```

### Development

```bash
# Everything in parallel (Turborepo)
pnpm dev

# Or per package:
pnpm --filter @annotated/backend dev   # convex dev
pnpm --filter web dev                   # next dev → http://localhost:3000
pnpm --filter worker dev                # fastify → http://localhost:8080
pnpm --filter extension dev             # plasmo dev → load apps/extension/build/chrome-mv3-dev in chrome://extensions
```

### Root scripts

```bash
pnpm dev         # turbo run dev
pnpm build       # turbo run build
pnpm lint        # turbo run lint
pnpm typecheck   # turbo run typecheck
```

## Environment Variables

### Web app (`apps/web` — set in Vercel or `.env.local`)

| Variable | Description | Required |
|---|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | Convex deployment URL | Yes |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key | Yes |
| `CLERK_SECRET_KEY` | Clerk secret key | Yes |
| `NEXT_PUBLIC_SITE_URL` | Canonical site origin (defaults to `https://annotated.sh`) | No |
| `NEXT_PUBLIC_EXTENSION_URL` | Chrome Web Store listing; reveals the "Get the extension" CTA when set | No |

### Extension (`apps/extension/.env`)

| Variable | Description | Required |
|---|---|---|
| `PLASMO_PUBLIC_CONVEX_URL` | Convex deployment URL | Yes |
| `PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key | Yes |
| `PLASMO_PUBLIC_WORKER_URL` | Worker base URL (`http://localhost:8080` in dev) | Yes |
| `PLASMO_PUBLIC_WORKER_TOKEN` | Matches the worker's `WORKER_AUTH_TOKEN` (**dev only** — bundled) | Yes |
| `PLASMO_PUBLIC_WEB_URL` | Web app base URL | Yes |

### Worker (`apps/worker/.env`)

| Variable | Description | Required |
|---|---|---|
| `CONVEX_URL`, `CONVEX_DEPLOY_KEY` | Convex access | Yes |
| `DEEPGRAM_API_KEY` | Podcast transcription | Yes |
| `WORKER_AUTH_TOKEN` | Shared secret with Convex/extension | Yes |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | Podcast metadata (falls back to RSS) | No |
| `YOUTUBE_API_KEY` | YouTube metadata | No |
| `PODCAST_INDEX_API_KEY` / `_SECRET` | RSS feed lookup fallback | No |
| `PORT` | Worker listen port (default `8080`) | No |

> Convex-side secrets (Resend API key, the worker URL/token used by server actions, Clerk issuer) are set in the **Convex dashboard**, not in a repo `.env` file.

## Features

- **Three source types** — YouTube (yt-dlp + ffmpeg, ≤90s clips), podcasts (transcript-anchored audio clipping via Deepgram), and articles (Mozilla Readability extraction + highlight)
- **Web composer** — paste an article URL and clip it without the extension
- **Commentary** — text or recorded-audio notes (transcribed)
- **Source-linked landing pages** — every clip cites and links the original, with an `og:image` / screenshot citation visual and a Satori share card
- **Social feed** — real-time feed, follow, threaded comments (with per-comment likes), and up/down voting
- **Prominent creator attribution** — type-aware byline: journalist + publication, podcast show, or YouTube channel
- **Profiles** — clean `/@username` URLs, avatars, verified badge, bio + social links (editable at `/settings`)
- **Save as image** — Story / Grid share PNGs, downloadable from the feed (••• menu) or clip page
- **Fair-use claims** — visible "File a claim" button writes a dispute and emails the owner via Resend

## Verification

```bash
pnpm typecheck                                   # all packages
pnpm --filter @annotated/shared exec vitest run  # shared unit tests
pnpm --filter @annotated/backend exec vitest run # convex-test suite
pnpm --filter worker exec vitest run             # worker tests
```

## Deployment

- **Web** → Vercel (`vercel --prod` from the repo root)
- **Backend** → Convex (`convex dev --once` / `convex deploy` from `packages/backend`)
- **Worker** → Fly.io (Docker, deployed from the repo root)

## Documentation

| Doc | Purpose |
|---|---|
| [SPEC.md](./SPEC.md) | Hard requirements (non-negotiable) |
| [BUILD-INTENT.md](./BUILD-INTENT.md) | Differentiation thesis, scope cuts, non-goals |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System diagram + the podcast audio pipeline |
| [SETUP.md](./SETUP.md) | Services, env vars, build order |
| [CLAUDE.md](./CLAUDE.md) | Conventions + current build state |

## License

Released under the [MIT License](./LICENSE) © 2026 Tarik Moody.
