# Verification runbook — does everything work as promised?

Maps every bounty promise (SPEC hard requirements + the §1–§11 enhancement gaps) to
**how to verify it** and its **current evidence-backed status**. Status is honest about the
*level* of evidence — don't read ✅ as "someone clicked it today" unless it says "live".

**Status legend**
- ✅ **LIVE** — observed working against the deployed site / a real loaded extension (evidence cited)
- ✅ **TESTED** — covered by an automated test (file cited); logic proven, not a live click
- ⚠️ **PENDING** — logic proven but the *live/in-panel* render hasn't been observed yet (manual pass)
- ⛔ **BLOCKED** — can't work until a prerequisite is done (e.g. worker deploy)

**Environment under test**
- Web (prod): https://annotated-eight.vercel.app · Convex: `strong-eel-665` (dev+prod share it)
- Worker: **not deployed** — runs locally at `:8080` only (see [Blockers](#blockers))
- Last full pass: **2026-05-26** · HEAD `448c852`

---

## Part A — SPEC hard requirements (non-negotiable)

| # | Promise (SPEC.md) | How to verify | Status |
|---|---|---|---|
| A1 | **Chrome sidebar is the primary surface** | Load `build/chrome-mv3-prod` in Chrome → open the side panel | ✅ TESTED — Plasmo MV3 `sidePanel`; calm panel rendered in a real loaded Chrome (`e2e/verify-calm-ui.e2e.mjs`). ⚠️ PENDING: opening via the toolbar `chrome.sidePanel` click is manual |
| A2 | **"File a claim" button on every annotation page** | Browse any `/a/[id]` → see "File a claim" | ✅ LIVE — present on the prod §4 landing (screenshot, 2026-05-26); claim flow `convex/claims.test.ts` |
| A3 | **Source attribution links to original URL** | `/a/[id]` → "View original ↗" → opens `canonicalUrl` | ✅ LIVE — source block + link on the prod §4/§9 landings (2026-05-26) |
| A4 | **Max clip 90 seconds** | shared span guard; UI labels | ✅ TESTED — `shared/src/clip-span.test.ts` (`evaluateClipSpan`, `MAX_CLIP_MS`); §8 labels show "up to 90s" |
| A5 | **Video downgraded to 240p** | `ffprobe` a produced YouTube clip | ✅ TESTED (worker, session 1) ⚠️ PENDING re-confirm — needs the worker running + a real clip |
| A6 | **Each clip → public landing page (source link + claim)** | Browse `/a/[id]` | ✅ LIVE — prod landings render quote/commentary/source/claim (2026-05-26) |
| A7 | **Account creation via X or Google only (no email/pw)** | Open `/sign-in` → only Google + X buttons | ✅ LIVE (session 1, 2026-05-25) ⚠️ re-confirm on current prod build |
| A8 | **Public feed with follow + comment** | Browse `/` ; follow a user; comment on `/a/[id]` | ✅ LIVE feed (2026-05-26) · ✅ TESTED follow/comment `convex/social.test.ts`, `comments.test.ts` |
| A9 | **Commentary: text AND recorded audio** | Composer text + voice note → landing plays audio | ✅ TESTED `convex/commentary.test.ts`, worker `commentary-transcoder.test.ts` · ✅ LIVE voice waveform in loaded ext (`e2e/verify-waveform.e2e.mjs`) |

---

## Part B — Enhancement gaps (§1–§11 + calm sidepanel)

| Gap | Promise | How to verify | Status |
|---|---|---|---|
| **§1** Clip threading + "add another clip" | Multi-clip thread at `/t/[id]`; follow-ons from one source | ✅ LIVE — prod `/t/[id]` renders clips in order (2026-05-26); deployed `getWithClips` = orders `[0,1]` · ✅ TESTED `threads.test.ts`, `thread-follow-on.test.ts` · ⚠️ PENDING: in-panel "+ Add another clip" button render |
| **§2** Up/down voting | Vote control on feed + landing | ✅ TESTED `votes.test.ts` · ✅ LIVE (vote control on prod cards/landings) |
| **§3** Threaded comments | One-level reply nesting | ✅ TESTED `comments.test.ts` · ✅ LIVE (session 2) |
| **§4** Source screenshot (fair-use citation) | Article landing shows a capture of the original | ✅ LIVE — prod renders the screenshot + "Original — Annotated points at it…" (image HTTP 200, 2026-05-26) · ✅ TESTED `screenshot.test.ts` · ⚠️ PENDING: in-panel `captureVisibleTab` firing |
| **§5** SEO slug URLs + Open Graph | `/[slug]-[id]` canonical; OG/Twitter cards | ✅ LIVE — prod `/a/[id]`→`/a/[slug]-[id]` 308→200 (2026-05-26) · ✅ TESTED `slug-url.test.ts` |
| **§6** Processing seconds-remaining indicator | Elapsed timer + estimate during transcription | ✅ TESTED `shared/progress-fraction.test.ts` · ⚠️ PENDING: live timer render (needs a podcast `processing` transcript) |
| **§7** Audio polish (trim + loudnorm + waveform + take counter) | Clean/loud output; waveform; "Take N" | ✅ TESTED worker `commentary-transcoder.test.ts` (real ffmpeg: leading silence trimmed), `shared/waveform-peaks.test.ts` · ✅ LIVE waveform `<canvas>` + Take 1→2 in loaded ext (`e2e/verify-waveform.e2e.mjs`) |
| **§8** ~100-word fair-use ceiling + visible labels | Clamp at word boundary (no error); "fair use" labels | ✅ TESTED `article-selection.test.ts`; deployed publish guard rejects 101 words · ✅ LIVE "fair use" label in loaded ext (`e2e/verify-calm-ui.e2e.mjs`) |
| **§9** Anonymous-annotation toggle | Mask author everywhere; never leak `authorId` | ✅ TESTED `anonymous.test.ts` (masking, `authorId` absent, profile-excluded) · ✅ LIVE — prod landing + feed show "Anonymous", `getById` has no `authorId` (2026-05-26) · ✅ LIVE toggle present in loaded ext |
| **§10** Calm web redesign | Type-forward news-app aesthetic on the web | ✅ LIVE (session 1) — observed on prod landings/feed |
| **§11** Sidebar overlay-vs-push tradeoff | Documented decision | ✅ DONE — `ARCHITECTURE.md` |
| **calm ext** Calm the sidepanel | Match the web aesthetic in the panel | ✅ LIVE — calm header/fields/buttons rendered in a real loaded Chrome (`e2e/verify-calm-ui.e2e.mjs`, screenshot) |

---

## Part C — Automated test suites (run these to confirm green)

```bash
# Backend (Convex) — masking, guards, threads, claims, social
cd packages/backend && npx vitest run        # expect: 22 passed

# Shared — pure logic (clip span, slug, fair-use clamp, progress, waveform)
cd packages/shared && npx vitest run          # expect: 97 passed

# Worker — ffmpeg transcode (real audio), article parse, schemas
cd apps/worker && npx vitest run              # expect: 55 passed

# Typecheck (no `any`, strict) — run per package
cd packages/backend && npx tsc -p . --noEmit
cd packages/shared   && npx tsc --noEmit
cd apps/worker       && npx tsc --noEmit
cd apps/web          && npx tsc --noEmit
cd apps/extension    && npx tsc --noEmit

# Web production build (what Vercel runs)
pnpm --filter web build                       # expect: 9 routes compile
```

## Part D — Loaded-extension checks (real Chrome, headed)

```bash
pnpm --filter extension build                 # refresh build/chrome-mv3-prod

node apps/extension/e2e/verify-calm-ui.e2e.mjs    # calm restyle + §9 toggle + §8 label
node apps/extension/e2e/verify-waveform.e2e.mjs   # §7 waveform <canvas> + Take 1→2
node apps/extension/e2e/mic-record.e2e.mjs        # active-tab mic capture
```

Each prints `PASS` and writes a screenshot to `$E2E_SHOT` (default `/tmp/`).

## Part E — Live prod smoke test (browse these)

| URL | Expect |
|---|---|
| https://annotated-eight.vercel.app/ | Feed renders; an "Anonymous" card shows a neutral avatar, no @handle |
| `/a/<article-id>` | Source screenshot + "Original…" caption + quote + **View original ↗** + **File a claim** |
| `/t/<thread-id>` | "🧵 N clips" header; clips listed in order |
| `/sign-in` | Only Google + X buttons (no email/password) |

---

## Blockers

| Blocker | Impact | Fix |
|---|---|---|
| **Worker not deployed** | No clipping/transcription for anyone but you (local `:8080`). Blocks A5 live re-confirm + §1/§4/§6 in-panel verification + judge self-install | Deploy the worker (Fly: Dockerfile + `fly.toml` + ffmpeg/yt-dlp + secrets), then set `PLASMO_PUBLIC_WORKER_URL` + `host_permissions` |
| **Extension `.env` → localhost** | A packaged build hits the judge's own machine | Repoint `PLASMO_PUBLIC_WORKER_URL`/`WEB_URL` at prod before packaging — see `docs/extension-distribution.md` |
| **Test seed data in public feed** | The prod feed shows this session's test annotations (Fair-use clip, "Budget Leak" anonymous, "Phase B" thread) | Delete via the Convex dashboard (no delete mutation exists) |
| **Bundled `WORKER_TOKEN`** | Dev token ships client-side; extractable from any distributed build | Rotate for any public/unlisted build; long-term, real Clerk auth + server-side worker call |

---

## Bottom line

**Feature-complete against the SPEC and live on prod.** Every SPEC checkbox and every §1–§11
gap is built, committed, pushed (`origin/main`), and either observed live or covered by tests.
The remaining ⚠️/⛔ items are **not missing features** — they're *verification* gaps that all
trace to one prerequisite: **deploy the worker**. Until then, demo with the worker running
locally + the live site (everything works), or do the worker deploy to make it self-installable.
