# Annotated.com — Claude Code instructions

This repo is a build for a $5,000 bounty from Jason Calacanis: a Chrome sidebar extension that lets users clip and annotate media (YouTube, podcasts, articles) from any website. The judging criterion, in the bounty's own words: *"the cleanest and most complete execution wins."*

Before making any non-trivial decision, read:

- `BUILD-INTENT.md` — the differentiation thesis, scope cuts, non-goals
- `SPEC.md` — the bounty's hard requirements (non-negotiable)
- `ARCHITECTURE.md` — system architecture, data flow, the audio pipeline
- `SETUP.md` — services, env vars, scaffold commands, build order
- `packages/backend/convex/schema.ts` — the data model

## What we're building (one paragraph)

A Chrome sidebar that captures 90-second clips from YouTube, podcasts, or news articles, lets the user add text or recorded-audio commentary, publishes to a source-linked landing page, and surfaces in a public feed with follow + comment. Auth is Clerk-mediated X or Google OAuth. Every annotation has a visible "File a claim" button for fair-use disputes. The differentiation is the **podcast path**: transcript-anchored audio clipping — drag across transcript words, get the matching 90-second audio segment. See BUILD-INTENT.md for the full thesis.

## Stack

| Layer | Tech | Notes |
|---|---|---|
| Web app | Next.js 15 App Router, Vercel | Feed, profiles, annotation landing pages |
| Extension | Plasmo MV3 side panel | React + TypeScript + Tailwind out of the box |
| Worker | Fastify + Node, Fly.io | ffmpeg, yt-dlp, Deepgram webhook handler |
| Backend | Convex | Real-time data, file storage, scheduled functions |
| Auth | Clerk | X + Google providers only; email/password disabled |
| UI library | **HeroUI v3 + HeroUI Pro** (license held) | Shared across web app and extension sidepanel |
| Theme | **`brutalism-light`** (HeroUI v3 official theme) | Brutalism-dark for system dark mode via `next-themes` |
| CSS framework | Tailwind CSS v4 | Required by HeroUI v3; install via `@heroui/styles` |
| Transcription | Deepgram Nova-3 | Podcasts; word-level timestamps + speaker diarization |
| Transcription | yt-dlp VTT | YouTube; no extra service needed |
| Email | Resend | Claim dispute notifications to Tarik; triggered by Convex action on claims insert |
| Package mgr | pnpm workspaces | Turborepo for task orchestration |

### UI conventions (HeroUI-specific)

- Use HeroUI components as the default; only drop to raw Tailwind when no component fits
- Theme is set on `<html>` via `data-theme="brutalism-light"` (or `"brutalism-dark"`) — flip via `next-themes`
- Compound API: `<Card><Card.Header>...</Card.Header></Card>`, not deeply nested prop blocks
- Brutalism discipline: monospace runs are reserved for timestamps and code only — never body text. Audio waveforms read as data viz, not decoration. The brutalism is the *frame*; content stays readable.
- HeroUI Pro MCP is installed in Claude Code — use it to look up component APIs and theme tokens rather than guessing

## Spec requirements (non-negotiable)

Read SPEC.md. Hit every checkbox. The bounty rewards spec-perfect execution. Do not deviate to be clever — the differentiation is in *how well we hit the spec*, not in adding extras.

## Non-goals (v1)

If a feature isn't in SPEC.md or BUILD-INTENT.md's "four amplifiers" section, default to not building it. Explicit non-goals:

- No transcript editing — Deepgram output is what ships
- No support for Spotify-exclusive shows with no RSS feed (graceful "this episode can't be clipped" message instead)
- No claim moderation queue — claims write to the DB and email Tarik; manual review
- No multi-clip threads, AI summarization of clips, cross-source annotations, bookmark folders, or transcript translation

When tempted to add a feature, re-read this section first.

## Code conventions

- TypeScript strict mode everywhere; no `any`
- ESM only in source code
- pnpm for all package operations
- File names: kebab-case (`source-resolver.ts`)
- React components: PascalCase
- Convex functions: organized by table (`convex/annotations.ts`, `convex/sources.ts`); use camelCase
- Zod for runtime validation at every trust boundary (HTTP, Convex args, env)
- Imports order: external → `@annotated/*` workspace → relative
- One responsibility per file; split when a file exceeds ~200 lines

## Build order

Follow SETUP.md section 5 ("Build order"). Each step has a working demo at the end. Don't skip ahead — finish step N before starting step N+1. Update the marker below as we progress.

**Current step: 0 (pre-scaffold)**

## Architecture orientation

Three tiers: **client** (extension + web app) → **services** (Clerk, Convex, Fly worker) → **external APIs** (iTunes Lookup, Podcast Index, Spotify, YouTube Data API, Deepgram).

The Fly.io worker is the heavy-lift service — ffmpeg, yt-dlp, and Deepgram calls all run there. The extension and web app talk to Convex; Convex calls the worker over HTTP for heavy operations and the worker writes results back via the Convex HTTP API. The worker is stateless and horizontally scalable.

See ARCHITECTURE.md for the full diagram and the podcast audio pipeline walkthrough.

## Teaching mode: Socratic Building

Default to the Socratic method when helping me build, design, or debug anything non-trivial. The win condition for a session is *I understand more*, not just *more code shipped*. Full methodology in the `socratic-builder` skill — read it before our first non-trivial move in a session.

**Non-negotiable moves:**
- Before coding a new concept: ask what I think the approach should be and why, before you write anything.
- When I propose something: probe it — edge cases, assumptions, what alternatives I considered.
- When I'm stuck: give the smallest hint that unblocks me, not the whole answer.
- After a concept lands: verify it stuck — "tell me back why X works" or "what breaks if we change Y?"
- End of a meaningful chunk: one-line reflection — what did I learn, what's still fuzzy.

**Bypass — drop Socratic and just do it — when:**
- I say "just do it", "ship it", "no socratic", "just write it", "skip the questions", "I'm in a hurry"
- Trivial work: typo, rename, formatting, mechanical refactor, repetitive boilerplate
- I've already shown mastery of the concept earlier in this session
- I'm in flow asking for the next concrete step

**Escape valve:** if I've struggled past ~2 question rounds on the same point, stop Socratic mode, explain directly, then circle back with one check-for-understanding question. Never let me thrash.

When ambiguous: ask once — "Walk this through Socratically, or just ship it?"
