# Extension Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make publishing optimistic (the `/a/[id]` URL exists in ~2s), cut YouTube slice time by ~85%, and remove the worker credential from the extension bundle entirely.

**Architecture:** Worker calls move from the extension into Convex actions. The publish mutation creates the annotation row immediately with `mediaState: "processing"` and schedules an action; the action calls the Fly worker with the token held server-side, then patches `clipStorageId` and flips `mediaState` to `"ready"`. This follows the pattern `convex/articles.ts` already uses. Once every worker call runs server-side, `PLASMO_PUBLIC_WORKER_TOKEN` is deleted rather than rotated.

**Tech Stack:** Convex (schema, mutations, actions, `convex-test` + vitest), Fastify + Node worker (yt-dlp, ffmpeg, vitest), Plasmo MV3 extension (React 19, TypeScript strict), Next.js 16 web app.

**Spec:** `docs/superpowers/specs/2026-08-11-extension-experience-design.md`

## Global Constraints

- TypeScript strict mode everywhere. **No `any`** — use `QueryCtx` / `MutationCtx` / `ActionCtx` from `./_generated/server` for Convex contexts.
- ESM only in source. pnpm for all package operations.
- File names kebab-case; React components PascalCase; Convex functions camelCase.
- **Read `packages/backend/convex/_generated/ai/guidelines.md` before writing any Convex code.** Its rules override training data.
- Every Convex function **must** have argument validators, including internal ones.
- Never accept a user id as a function argument for authorization. Derive identity server-side.
- Actions have no `ctx.db`. Use `ctx.runMutation` / `ctx.runQuery`.
- Do not use `.filter()` in Convex queries — define an index and use `.withIndex()`.
- `MAX_CLIP_MS = 90_000`. This value is currently duplicated in shared / convex / worker (debt e); do not add a fourth copy.
- One responsibility per file; split when a file exceeds ~200 lines.
- Immutability: never mutate objects in place; return new ones.
- Commit after every task. Conventional commit format (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`).

## Scope Note

The approved spec covers two dependent bodies of work. This plan is **Plan A — foundation**: the backend, worker, and architecture changes. It ships working software on its own (publish becomes optimistic, no credential ships) without touching the panel's screen structure.

**Plan B — the four-screen UI** (router, Source/Clip/Take/Published screens, the six states, dialed weight, dark mode) depends on this plan's publish API and will be written after Plan A lands.

## File Structure

**Create:**
| File | Responsibility |
|---|---|
| `apps/worker/src/youtube-clipper-args.ts` | Pure builders for the yt-dlp and ffmpeg argument arrays. Extracted so slice behaviour is unit-testable without spawning processes. |
| `apps/worker/src/youtube-clipper-args.test.ts` | Tests for the above. |
| `packages/backend/convex/clips.ts` | The slice pipeline: internal actions that call the worker, internal mutations that patch results back. No queries/mutations that clients call directly. |
| `packages/backend/convex/clips.test.ts` | convex-test coverage of the processing → ready → failed lifecycle. |
| `packages/backend/convex/media.ts` | Server-side proxies for the remaining worker endpoints the extension calls (chapters, commentary transcode, transcription). Public actions, auth-gated. |
| `apps/web/components/clip-media.tsx` | Single component that renders a clip as player / processing skeleton / failed notice. Used by both the feed card and the landing page so the three states can't diverge. |

**Modify:**
| File | Change |
|---|---|
| `apps/worker/src/youtube-clipper.ts:45-95` | Use the extracted builders; drop `--force-keyframes-at-cuts`; pad the download and trim in the ffmpeg pass. |
| `packages/backend/convex/schema.ts:107-161` | Add `mediaState`; add `takeText` / `takeAudioStorageId` / `takeAudioTranscript`. |
| `packages/backend/convex/annotations.ts` | `clipStorageId` mutation args become optional; `insertAnnotation` accepts `mediaState`; publish mutations schedule the slice action; projections read `take*` with a `commentary*` fallback. |
| `packages/backend/convex/files.ts:9-20` | Add an identity-authed `generateUploadUrlForUser` beside the token-guarded one. |
| `apps/extension/lib/worker-client.ts` | Every worker call replaced by a Convex call; file ends with no token and no worker URL. |
| `apps/extension/lib/convex-publish.ts` | `clipStorageId` removed from publish args; `commentary*` renamed to `take*`. |
| `apps/extension/components/clip-composer.tsx` | Publish first, slice after. |
| `apps/extension/components/podcast-clipper.tsx`, `article-panel.tsx`, `commentary-composer.tsx` | Same rename and publish-order change. |
| `apps/extension/.env`, `.env.example`, `package.json` manifest | Remove `PLASMO_PUBLIC_WORKER_TOKEN` and the worker host permission. |
| `apps/web/app/a/[id]/page.tsx`, the feed card component | Use `ClipMedia`. |

---

### Task 1: Worker — kill the keyframe flag

`--force-keyframes-at-cuts` costs 19–27s of a 24–32s YouTube slice (measured in `docs/interaction-flow.md:176-184`). It forces a re-encode inside yt-dlp purely for a frame-exact start — but `youtube-clipper.ts:74-95` already re-encodes for the 240p downscale. Download a padded section without the flag, then trim to the exact start in the ffmpeg pass that was happening anyway.

**Files:**
- Create: `apps/worker/src/youtube-clipper-args.ts`
- Create: `apps/worker/src/youtube-clipper-args.test.ts`
- Modify: `apps/worker/src/youtube-clipper.ts:31-102`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `buildYtDlpArgs(videoId: string, startMs: number, endMs: number, outputTemplate: string): string[]`, `buildFfmpegArgs(inputPath: string, outputPath: string, seekMs: number, durationMs: number): string[]`, and the exported constant `PAD_MS: number`.

- [ ] **Step 1: Write the failing test**

Create `apps/worker/src/youtube-clipper-args.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildFfmpegArgs, buildYtDlpArgs, PAD_MS } from "./youtube-clipper-args.js";

describe("buildYtDlpArgs", () => {
  it("does not force keyframes at cuts", () => {
    const args = buildYtDlpArgs("abc123", 60_000, 90_000, "/tmp/x/section.%(ext)s");
    expect(args).not.toContain("--force-keyframes-at-cuts");
  });

  it("downloads a padded section so ffmpeg can trim to the exact start", () => {
    const args = buildYtDlpArgs("abc123", 60_000, 90_000, "/tmp/x/section.%(ext)s");
    const section = args[args.indexOf("--download-sections") + 1];
    // 60s - 3s pad = 57s = 00:00:57.000 ; end 90s + 3s = 93s = 00:01:33.000
    expect(section).toBe("*00:00:57.000-00:01:33.000");
  });

  it("clamps the leading pad at the start of the video", () => {
    const args = buildYtDlpArgs("abc123", 1_000, 30_000, "/tmp/x/section.%(ext)s");
    const section = args[args.indexOf("--download-sections") + 1];
    expect(section).toBe("*00:00:00.000-00:00:33.000");
  });

  it("keeps the 360p format cap and mp4 merge", () => {
    const args = buildYtDlpArgs("abc123", 0, 30_000, "/tmp/x/section.%(ext)s");
    expect(args).toContain("bv*[height<=360]+ba/b[height<=360]/b");
    expect(args).toContain("--merge-output-format");
  });
});

describe("buildFfmpegArgs", () => {
  it("seeks by the actual pad that was applied, not the nominal pad", () => {
    // startMs 1_000 < PAD_MS, so only 1s of pad exists in the downloaded file
    const args = buildFfmpegArgs("/tmp/in.mp4", "/tmp/out.mp4", 1_000, 29_000);
    expect(args[args.indexOf("-ss") + 1]).toBe("1.000");
  });

  it("puts -ss before -i so the seek is fast", () => {
    const args = buildFfmpegArgs("/tmp/in.mp4", "/tmp/out.mp4", PAD_MS, 30_000);
    expect(args.indexOf("-ss")).toBeLessThan(args.indexOf("-i"));
  });

  it("caps duration at the 90s clip limit", () => {
    const args = buildFfmpegArgs("/tmp/in.mp4", "/tmp/out.mp4", PAD_MS, 120_000);
    expect(args[args.indexOf("-t") + 1]).toBe("90.000");
  });

  it("keeps the 240p downscale and faststart", () => {
    const args = buildFfmpegArgs("/tmp/in.mp4", "/tmp/out.mp4", PAD_MS, 30_000);
    expect(args).toContain("scale=-2:240");
    expect(args).toContain("+faststart");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/worker && npx vitest run src/youtube-clipper-args.test.ts`
Expected: FAIL — `Failed to resolve import "./youtube-clipper-args.js"`

- [ ] **Step 3: Write minimal implementation**

Create `apps/worker/src/youtube-clipper-args.ts`:

```ts
/**
 * Pure argument builders for the YouTube slice pipeline, extracted from
 * youtube-clipper.ts so the slice contract is testable without spawning
 * yt-dlp or ffmpeg.
 *
 * Why the pad: `--force-keyframes-at-cuts` gave yt-dlp a frame-exact start at
 * the cost of a full re-encode inside yt-dlp (~19-27s of a ~30s slice). The
 * ffmpeg pass below already re-encodes for the 240p downscale, so we download a
 * slightly padded section at keyframe granularity (fast, no re-encode) and let
 * ffmpeg seek past the pad to the exact start in work it was already doing.
 */

/** Seconds of extra media downloaded either side of the requested span. */
export const PAD_MS = 3_000;

/** SPEC: clips are capped at 90 seconds. */
const MAX_CLIP_MS = 90_000;

const CLIP_HEIGHT = 240;

function toTimestamp(totalMs: number): string {
  const totalSeconds = Math.max(0, totalMs) / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number): string => String(Math.floor(n)).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${seconds.toFixed(3).padStart(6, "0")}`;
}

/** The pad actually available before `startMs` — clamped at the video start. */
export function leadingPadMs(startMs: number): number {
  return Math.min(PAD_MS, Math.max(0, startMs));
}

export function buildYtDlpArgs(
  videoId: string,
  startMs: number,
  endMs: number,
  outputTemplate: string
): string[] {
  const sectionStartMs = startMs - leadingPadMs(startMs);
  const sectionEndMs = endMs + PAD_MS;
  return [
    "--no-playlist",
    "--quiet",
    "--no-warnings",
    "--download-sections",
    `*${toTimestamp(sectionStartMs)}-${toTimestamp(sectionEndMs)}`,
    "-f",
    "bv*[height<=360]+ba/b[height<=360]/b",
    "--merge-output-format",
    "mp4",
    "-o",
    outputTemplate,
    `https://www.youtube.com/watch?v=${videoId}`,
  ];
}

export function buildFfmpegArgs(
  inputPath: string,
  outputPath: string,
  seekMs: number,
  durationMs: number
): string[] {
  const cappedMs = Math.min(durationMs, MAX_CLIP_MS);
  return [
    "-y",
    // -ss before -i: ffmpeg seeks the input rather than decoding and discarding.
    "-ss",
    (Math.max(0, seekMs) / 1000).toFixed(3),
    "-i",
    inputPath,
    "-t",
    (cappedMs / 1000).toFixed(3),
    "-vf",
    `scale=-2:${CLIP_HEIGHT}`,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    outputPath,
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/worker && npx vitest run src/youtube-clipper-args.test.ts`
Expected: PASS — 7 tests

- [ ] **Step 5: Wire the builders into the clipper**

Replace the body of `clipYoutubeVideo` in `apps/worker/src/youtube-clipper.ts` (lines 31-102) with:

```ts
export async function clipYoutubeVideo(
  videoId: string,
  startMs: number,
  endMs: number
): Promise<ClipFile> {
  const workDir = await mkdtemp(join(tmpdir(), "clip-"));
  const cleanup = (): Promise<void> =>
    rm(workDir, { recursive: true, force: true });

  try {
    await execFileAsync(
      "yt-dlp",
      buildYtDlpArgs(videoId, startMs, endMs, join(workDir, "section.%(ext)s")),
      { maxBuffer: BIG_BUFFER }
    );

    const downloaded = (await readdir(workDir)).find((f) =>
      /\.(mp4|mkv|webm)$/i.test(f)
    );
    if (!downloaded) {
      throw new Error("yt-dlp produced no output file");
    }

    const output = join(workDir, "clip.mp4");
    await execFileAsync(
      "ffmpeg",
      buildFfmpegArgs(
        join(workDir, downloaded),
        output,
        leadingPadMs(startMs),
        endMs - startMs
      ),
      { maxBuffer: BIG_BUFFER }
    );

    return { filePath: output, cleanup };
  } catch (err) {
    await cleanup();
    throw err;
  }
}
```

Add the import at the top of the file:

```ts
import {
  buildFfmpegArgs,
  buildYtDlpArgs,
  leadingPadMs,
} from "./youtube-clipper-args.js";
```

Delete the now-unused local `toTimestamp`, `MAX_CLIP_SECONDS`, and `CLIP_HEIGHT` if nothing else in the file references them.

- [ ] **Step 6: Verify the whole worker suite and types still pass**

Run: `cd apps/worker && npx vitest run && pnpm typecheck`
Expected: all tests PASS, `tsc --noEmit` exits 0

- [ ] **Step 7: Measure the real improvement**

Run, with `yt-dlp` and `ffmpeg` on PATH:

```bash
cd apps/worker && time npx tsx -e "
import { clipYoutubeVideo } from './src/youtube-clipper.js';
const c = await clipYoutubeVideo('dQw4w9WgXcQ', 60000, 120000);
console.log(c.filePath);
await c.cleanup();
"
```

Expected: under 10s locally (was 24–32s). Record the number — Task 6 needs it for the progress estimate. If it is not materially faster, stop and re-check that `--force-keyframes-at-cuts` is actually gone from the built args.

- [ ] **Step 8: Commit**

```bash
git add apps/worker/src/youtube-clipper-args.ts apps/worker/src/youtube-clipper-args.test.ts apps/worker/src/youtube-clipper.ts
git commit -m "perf(worker): drop --force-keyframes-at-cuts, trim in the existing ffmpeg pass

yt-dlp was re-encoding purely for a frame-exact start (~85% of slice time).
The ffmpeg 240p pass already re-encodes, so download a padded section and
seek past the pad there instead. Arg builders extracted and unit-tested."
```

---

### Task 2: Convex — `mediaState` and optional clip storage

A row must be creatable before its clip exists. `clipStorageId` is already `v.optional` in the schema (`schema.ts:114`) and both read paths already guard it (`annotations.ts:30`, `:556`) because articles have no clip — so only the **mutation arguments** change, plus one new column.

**Files:**
- Modify: `packages/backend/convex/schema.ts:107-161`
- Modify: `packages/backend/convex/annotations.ts:109-126` (`assertPublishable`), `:149-221` (`AnnotationInsert` / `insertAnnotation`), `:230-334` (`createYoutube` / `createPodcast`)
- Create: `packages/backend/convex/clips.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `mediaState` on `annotations` with values `"processing" | "ready" | "failed"` (absent = ready); `AnnotationInsert.mediaState?: "processing" | "ready" | "failed"`; `createYoutube` and `createPodcast` accept `clipStorageId?: Id<"_storage">`.

- [ ] **Step 1: Write the failing test**

Create `packages/backend/convex/clips.test.ts`:

```ts
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const IDENTITY = { subject: "user_clips", name: "Clip Tester", email: "clips@example.com" };

/** Signs in, ensures the users row, and creates one topic to publish against. */
async function setup() {
  const t = convexTest(schema, modules);
  const asUser = t.withIdentity(IDENTITY);
  await asUser.mutation(api.users.ensureCurrentUser, {});
  const topicId = await t.run(async (ctx) =>
    ctx.db.insert("topics", { slug: "ai", label: "AI", createdAt: Date.now() })
  );
  return { t, asUser, topicId };
}

describe("optimistic publish", () => {
  test("creates a YouTube annotation with no clip yet, marked processing", async () => {
    const { t, asUser, topicId } = await setup();

    const annotationId = await asUser.mutation(api.annotations.createYoutube, {
      videoId: "abc123",
      title: "The AI capex bubble",
      clipStartMs: 60_000,
      clipEndMs: 120_000,
      commentaryText: "This is exactly backwards.",
      topicIds: [topicId],
    });

    const row = await t.run(async (ctx) => ctx.db.get(annotationId));
    expect(row?.mediaState).toBe("processing");
    expect(row?.clipStorageId).toBeUndefined();
    expect(row?.isPublic).toBe(true);
  });

  test("still rejects a publish with no commentary", async () => {
    const { asUser, topicId } = await setup();
    await expect(
      asUser.mutation(api.annotations.createYoutube, {
        videoId: "abc123",
        title: "No take",
        clipStartMs: 0,
        clipEndMs: 30_000,
        topicIds: [topicId],
      })
    ).rejects.toThrow(/Commentary is required/);
  });

  test("still rejects a span over 90 seconds", async () => {
    const { asUser, topicId } = await setup();
    await expect(
      asUser.mutation(api.annotations.createYoutube, {
        videoId: "abc123",
        title: "Too long",
        clipStartMs: 0,
        clipEndMs: 120_000,
        commentaryText: "Nope",
        topicIds: [topicId],
      })
    ).rejects.toThrow(/Invalid clip span/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && npx vitest run convex/clips.test.ts`
Expected: FAIL — the first test errors because `clipStorageId` is a required argument.

- [ ] **Step 3: Add the schema column**

In `packages/backend/convex/schema.ts`, inside the `annotations` table definition, after the `clipStorageId` line (`:114`):

```ts
    // Optimistic publish: the row is created the moment the user hits Publish,
    // before the worker has sliced anything, so a shareable URL exists in ~2s.
    // A Convex action patches `clipStorageId` and flips this to "ready" when the
    // slice lands, or to "failed" if it doesn't. Absent means "ready" — every
    // pre-existing row was created with its clip already attached, so there is
    // no backfill.
    mediaState: v.optional(
      v.union(v.literal("processing"), v.literal("ready"), v.literal("failed"))
    ),
```

- [ ] **Step 4: Make the clip storage id optional on the publish path**

In `packages/backend/convex/annotations.ts`:

1. `AnnotationInsert` (`:149`) — add one field:

```ts
  mediaState?: "processing" | "ready" | "failed";
```

2. `insertAnnotation` (`:196`) — add it to the insert object, after `clipStorageId`:

```ts
    mediaState: input.mediaState,
```

3. `assertPublishable` (`:109`) — its `clipStartMs` / `clipEndMs` checks are unchanged, but it must no longer imply a clip exists. Replace the signature's use only; the body stays as written. No edit needed here — confirm by reading it.

4. `createYoutube` args (`:238`) — change:

```ts
    clipStorageId: v.optional(v.id("_storage")),
```

5. `createPodcast` args (`:290`) — the same change.

6. In both handlers, pass the media state through to `insertAnnotation`:

```ts
      clipStorageId: args.clipStorageId,
      mediaState: args.clipStorageId === undefined ? "processing" : "ready",
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/backend && npx vitest run convex/clips.test.ts`
Expected: PASS — 3 tests

- [ ] **Step 6: Verify nothing else broke**

Run: `cd packages/backend && npx vitest run && npx tsc -p convex --noEmit`
Expected: all existing suites PASS (`authed-publish`, `threads`, `topics`, `votes`, `anonymous`, …), tsc exits 0

- [ ] **Step 7: Commit**

```bash
git add packages/backend/convex/schema.ts packages/backend/convex/annotations.ts packages/backend/convex/clips.test.ts
git commit -m "feat(backend): mediaState column, clip storage optional at publish

An annotation row can now be created before its clip exists, so publish can
return a real /a/[id] URL in ~2s. Absent mediaState means ready — no backfill."
```

---

### Task 3: Convex — the slice action

The publish mutation schedules an action; the action calls the worker with the token held server-side and patches the result back.

**Files:**
- Create: `packages/backend/convex/clips.ts`
- Modify: `packages/backend/convex/annotations.ts` (`createYoutube`, `createPodcast` handlers)
- Modify: `packages/backend/convex/clips.test.ts`

**Interfaces:**
- Consumes: `mediaState` and optional `clipStorageId` from Task 2.
- Produces: `internal.clips.sliceYoutube({ annotationId, videoId, startMs, endMs })`, `internal.clips.slicePodcast({ annotationId, sourceId, startMs, endMs })`, `internal.clips.attachClip({ annotationId, clipStorageId })`, `internal.clips.markFailed({ annotationId, reason })`.

- [ ] **Step 1: Write the failing test**

Append to `packages/backend/convex/clips.test.ts`:

```ts
import { internal } from "./_generated/api";

describe("slice lifecycle", () => {
  test("attachClip moves a processing row to ready", async () => {
    const { t, asUser, topicId } = await setup();
    const annotationId = await asUser.mutation(api.annotations.createYoutube, {
      videoId: "abc123",
      title: "Ready flow",
      clipStartMs: 0,
      clipEndMs: 30_000,
      commentaryText: "Take",
      topicIds: [topicId],
    });

    const storageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob(["fake-mp4"], { type: "video/mp4" }))
    );
    await t.mutation(internal.clips.attachClip, { annotationId, clipStorageId: storageId });

    const row = await t.run(async (ctx) => ctx.db.get(annotationId));
    expect(row?.mediaState).toBe("ready");
    expect(row?.clipStorageId).toBe(storageId);
  });

  test("markFailed records the reason and does not unpublish the row", async () => {
    const { t, asUser, topicId } = await setup();
    const annotationId = await asUser.mutation(api.annotations.createYoutube, {
      videoId: "abc123",
      title: "Failed flow",
      clipStartMs: 0,
      clipEndMs: 30_000,
      commentaryText: "Take",
      topicIds: [topicId],
    });

    await t.mutation(internal.clips.markFailed, {
      annotationId,
      reason: "Clip generation failed",
    });

    const row = await t.run(async (ctx) => ctx.db.get(annotationId));
    expect(row?.mediaState).toBe("failed");
    expect(row?.isPublic).toBe(true);
  });

  test("attachClip on an already-failed row still succeeds (late worker reply)", async () => {
    const { t, asUser, topicId } = await setup();
    const annotationId = await asUser.mutation(api.annotations.createYoutube, {
      videoId: "abc123",
      title: "Late reply",
      clipStartMs: 0,
      clipEndMs: 30_000,
      commentaryText: "Take",
      topicIds: [topicId],
    });
    await t.mutation(internal.clips.markFailed, { annotationId, reason: "timeout" });

    const storageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob(["fake-mp4"], { type: "video/mp4" }))
    );
    await t.mutation(internal.clips.attachClip, { annotationId, clipStorageId: storageId });

    const row = await t.run(async (ctx) => ctx.db.get(annotationId));
    expect(row?.mediaState).toBe("ready");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && npx vitest run convex/clips.test.ts`
Expected: FAIL — `internal.clips.attachClip` is not a function

- [ ] **Step 3: Write the implementation**

Create `packages/backend/convex/clips.ts`:

```ts
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation } from "./_generated/server";

/**
 * The slice pipeline. Publishing creates the annotation row immediately
 * (mediaState "processing") and schedules one of the actions here. The action
 * calls the Fly worker with WORKER_AUTH_TOKEN held server-side — the extension
 * never sees it — and patches the result back through the mutations below.
 *
 * Everything here is internal: no client calls these directly.
 */

/** Attaches a finished clip and flips the row to ready. */
export const attachClip = internalMutation({
  args: {
    annotationId: v.id("annotations"),
    clipStorageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const annotation = await ctx.db.get(args.annotationId);
    // The row can be gone if the author removed it while the slice ran. Drop
    // the orphaned blob rather than leaking it (closes debt d/i).
    if (!annotation) {
      await ctx.storage.delete(args.clipStorageId);
      return null;
    }
    await ctx.db.patch(args.annotationId, {
      clipStorageId: args.clipStorageId,
      mediaState: "ready",
    });
    return null;
  },
});

/**
 * Records a slice failure. Deliberately leaves `isPublic` alone: the URL may
 * already be pasted somewhere, so the page must resolve — it renders a "clip
 * couldn't be made" notice with the take and source intact.
 */
export const markFailed = internalMutation({
  args: {
    annotationId: v.id("annotations"),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const annotation = await ctx.db.get(args.annotationId);
    if (!annotation) return null;
    await ctx.db.patch(args.annotationId, { mediaState: "failed" });
    console.error(`clip slice failed for ${args.annotationId}: ${args.reason}`);
    return null;
  },
});

/** Reads the worker config, throwing a single clear error when unset. */
function workerConfig(): { url: string; token: string } {
  const url = process.env.WORKER_URL;
  const token = process.env.WORKER_AUTH_TOKEN;
  if (!url || !token) {
    throw new Error("Worker is not configured (WORKER_URL / WORKER_AUTH_TOKEN)");
  }
  return { url, token };
}

export const sliceYoutube = internalAction({
  args: {
    annotationId: v.id("annotations"),
    videoId: v.string(),
    startMs: v.number(),
    endMs: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const { url, token } = workerConfig();
      const response = await fetch(`${url}/clip-youtube`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          videoId: args.videoId,
          startMs: args.startMs,
          endMs: args.endMs,
        }),
      });
      if (!response.ok) {
        throw new Error(`Worker returned ${response.status}`);
      }
      const body = (await response.json()) as { storageId?: string };
      if (typeof body.storageId !== "string") {
        throw new Error("Worker returned no storageId");
      }
      await ctx.runMutation(internal.clips.attachClip, {
        annotationId: args.annotationId,
        clipStorageId: body.storageId as Id<"_storage">,
      });
    } catch (err) {
      await ctx.runMutation(internal.clips.markFailed, {
        annotationId: args.annotationId,
        reason: err instanceof Error ? err.message : "Unknown slice failure",
      });
    }
    return null;
  },
});

export const slicePodcast = internalAction({
  args: {
    annotationId: v.id("annotations"),
    // The FROZEN episode copy, not the live enclosure — see Step 5.
    episodeStorageId: v.id("_storage"),
    startMs: v.number(),
    endMs: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const { url, token } = workerConfig();
      const mp3Url = await ctx.storage.getUrl(args.episodeStorageId);
      if (!mp3Url) throw new Error("Frozen episode audio not found in storage");
      const response = await fetch(`${url}/clip-audio`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          mp3Url,
          startMs: args.startMs,
          endMs: args.endMs,
        }),
      });
      if (!response.ok) {
        throw new Error(`Worker returned ${response.status}`);
      }
      const body = (await response.json()) as { storageId?: string };
      if (typeof body.storageId !== "string") {
        throw new Error("Worker returned no storageId");
      }
      await ctx.runMutation(internal.clips.attachClip, {
        annotationId: args.annotationId,
        clipStorageId: body.storageId as Id<"_storage">,
      });
    } catch (err) {
      await ctx.runMutation(internal.clips.markFailed, {
        annotationId: args.annotationId,
        reason: err instanceof Error ? err.message : "Unknown slice failure",
      });
    }
    return null;
  },
});
```

> **Note on the cast:** the worker returns a plain string; Convex needs a branded `Id<"_storage">`. There is no runtime validator for a foreign id, and the value came from our own worker's `ctx.storage.store`. Import the type — `import type { Id } from "./_generated/dataModel";` — and cast to `Id<"_storage">`, never to `any` or `never`. If the codebase already has a helper for this, use it instead.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/backend && npx vitest run convex/clips.test.ts`
Expected: PASS — 6 tests

- [ ] **Step 5: Schedule the action from the publish mutations**

In `createYoutube`'s handler in `packages/backend/convex/annotations.ts`, replace the trailing `return await insertAnnotation(...)` with:

```ts
    const annotationId = await insertAnnotation(ctx, {
      authorId: user._id,
      sourceId,
      clipStorageId: args.clipStorageId,
      mediaState: args.clipStorageId === undefined ? "processing" : "ready",
      clipStartMs: args.clipStartMs,
      clipEndMs: args.clipEndMs,
      commentaryText: args.commentaryText,
      commentaryAudioStorageId: args.commentaryAudioStorageId,
      commentaryAudioTranscript: args.commentaryAudioTranscript,
      isAnonymous: args.isAnonymous,
      threadId: args.threadId,
      topicIds: args.topicIds,
    });

    // Optimistic publish: the row (and its URL) exist now; the slice happens
    // after. Skipped when the caller already supplied a clip.
    if (args.clipStorageId === undefined) {
      await ctx.scheduler.runAfter(0, internal.clips.sliceYoutube, {
        annotationId,
        videoId: args.videoId,
        startMs: args.clipStartMs,
        endMs: args.clipEndMs,
      });
    }
    return annotationId;
```

Add `import { internal } from "./_generated/api";` at the top of `annotations.ts` if it is not already imported.

Do the same in `createPodcast` — but **not** from `source.mp3Url`.

Commit `9cf7ac0` ("freeze episode so clip audio matches the transcript") exists because the live enclosure is re-stitched with dynamic ads, so its timeline drifts from the word timestamps the user dragged across. Podcast clips must be cut from the **frozen copy** at `transcripts.episodeStorageId` (`schema.ts:101`). Using `mp3Url` here would silently reintroduce the exact bug that fix closed.

```ts
    if (args.clipStorageId === undefined) {
      const transcript = await ctx.db
        .query("transcripts")
        .withIndex("by_source", (q) => q.eq("sourceId", args.sourceId))
        .unique();
      // The frozen episode is what the displayed word timestamps belong to.
      // Clipping the live enclosure would drift against ad insertion (9cf7ac0).
      if (!transcript?.episodeStorageId) {
        throw new Error(
          "This episode isn't ready to clip yet — its audio is still being prepared."
        );
      }
      await ctx.scheduler.runAfter(0, internal.clips.slicePodcast, {
        annotationId,
        episodeStorageId: transcript.episodeStorageId,
        startMs: args.clipStartMs,
        endMs: args.clipEndMs,
      });
    }
```

Change `slicePodcast`'s args in `clips.ts` to match — it takes `episodeStorageId: v.id("_storage")` rather than `mp3Url`, and resolves it with `await ctx.storage.getUrl(args.episodeStorageId)` before posting to the worker's `/clip-audio`:

```ts
export const slicePodcast = internalAction({
  args: {
    annotationId: v.id("annotations"),
    episodeStorageId: v.id("_storage"),
    startMs: v.number(),
    endMs: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const { url, token } = workerConfig();
      const mp3Url = await ctx.storage.getUrl(args.episodeStorageId);
      if (!mp3Url) throw new Error("Frozen episode audio not found in storage");
      const response = await fetch(`${url}/clip-audio`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mp3Url, startMs: args.startMs, endMs: args.endMs }),
      });
      // …identical body handling to sliceYoutube…
```

Check `packages/backend/convex/podcasts.ts` for how the existing clip path resolves this URL and match it exactly rather than diverging.

- [ ] **Step 6: Verify**

Run: `cd packages/backend && npx vitest run && npx tsc -p convex --noEmit`
Expected: all PASS, tsc exits 0

- [ ] **Step 7: Deploy the functions and smoke-test against the real worker**

`convex codegen` does **not** push functions. Run:

```bash
cd packages/backend && npx convex dev --once
```

Then publish one real clip from the extension and confirm the row transitions:

```bash
npx convex run annotations:getById '{"id":"<annotationId>"}'
```

Expected: `mediaState` is `"processing"` immediately, `"ready"` with a `clipUrl` within ~15s.

- [ ] **Step 8: Commit**

```bash
git add packages/backend/convex/clips.ts packages/backend/convex/clips.test.ts packages/backend/convex/annotations.ts
git commit -m "feat(backend): slice clips in a Convex action after optimistic publish

Publish now returns a real /a/[id] in ~2s and schedules the slice. The worker
token stays server-side, the job survives the panel closing, and a failed slice
leaves the page resolvable instead of broken."
```

---

### Task 4: Convex + web — server-side proxies for the remaining worker calls

`apps/extension/lib/worker-client.ts` calls the worker from seven functions. Task 3 covered slicing. This task moves the rest so the token can be deleted in Task 8.

**Files:**
- Create: `packages/backend/convex/media.ts`
- Modify: `packages/backend/convex/files.ts:9-20`

**Interfaces:**
- Consumes: `workerConfig()` pattern from Task 3 (duplicate it locally or export it from `clips.ts` — prefer exporting).
- Produces: `api.media.youtubeChapters({ videoId }) → Chapter[]`, `api.media.transcodeTake({ audioStorageId, mimeType }) → { storageId, transcript }`, `api.media.transcribeSource({ videoId }) → null` (proxies `/transcribe-youtube`), `api.media.transcribePodcast({ sourceId }) → null` (proxies `/transcribe`; reads `mp3Url` from the source row — never from the client), `api.files.generateUploadUrlForUser({}) → string`.

> **Corrected 2026-08-11 during execution.** This block originally said
> `transcribeSource({ sourceId })` while the code sample below implemented
> `{ videoId }` → `/transcribe-youtube`. Those are different endpoints, and the
> conflation left `worker-client.ts`'s `transcribePodcast` → `/transcribe` with no
> proxy — which would have made Task 8's "no token in the bundle" acceptance
> criterion unreachable. **All seven** worker-calling functions in
> `worker-client.ts` need a server-side counterpart; count them before declaring
> this task done.

- [ ] **Step 1: Add an identity-authed upload URL**

`files.ts:9` currently guards `generateUploadUrl` with the shared worker token. The extension needs to upload a recorded take without holding that token. Add beside it:

```ts
/**
 * An upload URL for the signed-in user — used by the extension to put a
 * recorded take into storage before asking the worker (server-side) to
 * transcode it. Distinct from the token-guarded worker variant above.
 */
export const generateUploadUrlForUser = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Sign in to upload");
    }
    return await ctx.storage.generateUploadUrl();
  },
});
```

- [ ] **Step 2: Write the proxies**

Create `packages/backend/convex/media.ts`:

```ts
import { v } from "convex/values";
import { action } from "./_generated/server";

/**
 * Server-side proxies for the worker endpoints the extension used to call
 * directly with a bundled bearer token. Every one of these is auth-gated on the
 * Clerk identity — the worker token lives only here.
 */

function workerConfig(): { url: string; token: string } {
  const url = process.env.WORKER_URL;
  const token = process.env.WORKER_AUTH_TOKEN;
  if (!url || !token) {
    throw new Error("Worker is not configured (WORKER_URL / WORKER_AUTH_TOKEN)");
  }
  return { url, token };
}

async function requireIdentity(ctx: { auth: { getUserIdentity: () => Promise<unknown> } }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Sign in to continue");
}

const chapterValidator = v.object({
  title: v.string(),
  startMs: v.number(),
  endMs: v.number(),
});

export const youtubeChapters = action({
  args: { videoId: v.string() },
  returns: v.array(chapterValidator),
  handler: async (ctx, args) => {
    await requireIdentity(ctx);
    const { url, token } = workerConfig();
    const response = await fetch(`${url}/youtube-chapters`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ videoId: args.videoId }),
    });
    // Chapters are an enhancement: a failure must never block clipping.
    if (!response.ok) return [];
    const body = (await response.json()) as { chapters?: unknown };
    if (!Array.isArray(body.chapters)) return [];
    return body.chapters as { title: string; startMs: number; endMs: number }[];
  },
});

export const transcodeTake = action({
  args: { audioStorageId: v.id("_storage"), mimeType: v.string() },
  returns: v.object({
    storageId: v.id("_storage"),
    transcript: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    await requireIdentity(ctx);
    const { url, token } = workerConfig();
    const sourceUrl = await ctx.storage.getUrl(args.audioStorageId);
    if (!sourceUrl) throw new Error("Recorded take not found in storage");
    const response = await fetch(`${url}/transcode-commentary`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ audioUrl: sourceUrl, mimeType: args.mimeType }),
    });
    if (!response.ok) {
      throw new Error("Couldn't process that recording. Try again.");
    }
    const body = (await response.json()) as {
      storageId?: string;
      transcript?: string | null;
    };
    if (typeof body.storageId !== "string") {
      throw new Error("Worker returned no storageId for the recorded take");
    }
    return {
      storageId: body.storageId as Id<"_storage">,
      transcript: body.transcript ?? null,
    };
  },
});

export const transcribeSource = action({
  args: { videoId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireIdentity(ctx);
    const { url, token } = workerConfig();
    // Fire-and-forget backfill: never surface a failure to the clipper.
    try {
      await fetch(`${url}/transcribe-youtube`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ videoId: args.videoId }),
      });
    } catch {
      // intentionally ignored
    }
    return null;
  },
});
```

- [ ] **Step 3: Teach the worker to fetch audio by URL**

`/transcode-commentary` currently accepts `audioBase64`. Add an `audioUrl` alternative so Convex can hand it a storage URL instead of round-tripping a megabyte of base64 through an action argument.

In `apps/worker/src/routes/transcode-commentary.ts`, extend the body schema to accept **either** `audioBase64` or `audioUrl` (exactly one), and when `audioUrl` is present, fetch it into the temp file instead of decoding base64. Keep the base64 branch — the existing test `apps/worker/src/routes/transcode-commentary.test.ts` covers it and must keep passing.

- [ ] **Step 4: Write a test for the new worker branch**

Add to `apps/worker/src/routes/transcode-commentary.test.ts` a case that posts `{ audioUrl }` pointing at a local fixture served over `http://127.0.0.1`, and asserts the same mp3 output and transcript shape the base64 case asserts. Reuse the existing fixture.

- [ ] **Step 5: Run the tests**

Run: `cd apps/worker && npx vitest run src/routes/transcode-commentary.test.ts`
Expected: PASS — the original base64 case plus the new url case

- [ ] **Step 6: Verify Convex types and deploy**

Run: `cd packages/backend && npx tsc -p convex --noEmit && npx convex dev --once`
Expected: exits 0, functions pushed

- [ ] **Step 7: Commit**

```bash
git add packages/backend/convex/media.ts packages/backend/convex/files.ts apps/worker/src/routes/transcode-commentary.ts apps/worker/src/routes/transcode-commentary.test.ts
git commit -m "feat(backend): server-side proxies for chapters, take transcode, transcription

Every worker endpoint the extension used to call directly now has an
auth-gated Convex action in front of it, so the bundle needs no worker token.
/transcode-commentary also accepts an audioUrl to avoid base64 in action args."
```

---

### Task 5: `commentary` → `take` rename

The conceptual model locks the vocabulary as Annotation / Take / Comment / Vote. Every publish call site is already being rewritten in this plan, so the rename is nearly free now and expensive later. `likes` → `votes` is **not** in scope.

**Files:**
- Modify: `packages/backend/convex/schema.ts` (annotations table)
- Modify: `packages/backend/convex/annotations.ts` (insert, args, projections)
- Modify: `apps/extension/lib/convex-publish.ts`, `apps/extension/components/commentary-composer.tsx` (→ rename file to `take-composer.tsx`)
- Modify: `apps/web` components reading `commentaryText`

**Interfaces:**
- Consumes: everything from Tasks 2–4.
- Produces: `takeText`, `takeAudioStorageId`, `takeAudioTranscript` on `annotations` and across all publish args; projections expose `takeText` regardless of which column the row was written with.

- [ ] **Step 1: Write the failing test**

Create `packages/backend/convex/take-rename.test.ts`:

```ts
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("a row written with the legacy commentaryText still projects as takeText", async () => {
  const t = convexTest(schema, modules);
  const asUser = t.withIdentity({ subject: "user_rename", name: "R", email: "r@example.com" });
  await asUser.mutation(api.users.ensureCurrentUser, {});

  const { annotationId } = await t.run(async (ctx) => {
    const authorId = await ctx.db.insert("users", {
      clerkId: "legacy", username: "legacy", displayName: "Legacy", createdAt: Date.now(),
    });
    const sourceId = await ctx.db.insert("sources", {
      type: "youtube", canonicalUrl: "https://youtu.be/x", title: "Legacy", createdAt: Date.now(),
    });
    const annotationId = await ctx.db.insert("annotations", {
      authorId, sourceId,
      commentaryText: "written before the rename",
      isPublic: true, publishedAt: Date.now(), commentCount: 0, likeCount: 0,
    });
    return { annotationId };
  });

  const projected = await t.query(api.annotations.getById, { id: annotationId });
  expect(projected?.takeText).toBe("written before the rename");
});

test("a newly published annotation stores takeText", async () => {
  const t = convexTest(schema, modules);
  const asUser = t.withIdentity({ subject: "user_new", name: "N", email: "n@example.com" });
  await asUser.mutation(api.users.ensureCurrentUser, {});
  const topicId = await t.run(async (ctx) =>
    ctx.db.insert("topics", { slug: "ai", label: "AI", createdAt: Date.now() })
  );

  const annotationId = await asUser.mutation(api.annotations.createYoutube, {
    videoId: "abc123", title: "New", clipStartMs: 0, clipEndMs: 30_000,
    takeText: "written after the rename", topicIds: [topicId],
  });

  const row = await t.run(async (ctx) => ctx.db.get(annotationId));
  expect(row?.takeText).toBe("written after the rename");
  expect(row?.commentaryText).toBeUndefined();
});
```

> The `users` and `sources` insert shapes above are illustrative. Read `schema.ts` and use the real required fields for those tables — a missing required field fails schema validation, not the assertion you care about.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && npx vitest run convex/take-rename.test.ts`
Expected: FAIL — `takeText` is not a valid field

- [ ] **Step 3: Add the new columns, keep the old ones**

In `schema.ts`'s `annotations` table, alongside the existing `commentaryText` / `commentaryAudioStorageId` / `commentaryAudioTranscript`:

```ts
    // The Take — the user's argument about the clip. Named per the locked
    // conceptual model. The `commentary*` fields above are the pre-rename
    // names, kept so existing rows validate; projections read take* ?? commentary*.
    takeText: v.optional(v.string()),
    takeAudioStorageId: v.optional(v.id("_storage")),
    takeAudioTranscript: v.optional(v.string()),
```

- [ ] **Step 4: Write to the new fields, read from both**

In `annotations.ts`:

1. `AnnotationInsert` — rename the three `commentary*` fields to `take*`.
2. `insertAnnotation` — write `takeText`, `takeAudioStorageId`, `takeAudioTranscript`; stop writing the `commentary*` fields.
3. `assertPublishable` — change the parameter names to `takeText` / `takeAudioStorageId`; the error message stays user-facing and becomes `"A take is required (text or recorded audio)"`.
4. All three `create*` mutation arg validators — rename `commentaryText` → `takeText`, `commentaryAudioStorageId` → `takeAudioStorageId`, `commentaryAudioTranscript` → `takeAudioTranscript`.
5. Every projection (`getById` at `:30` and the feed projection at `:556`, plus profile/thread projections) — read with a fallback:

```ts
    takeText: annotation.takeText ?? annotation.commentaryText,
    takeAudioTranscript:
      annotation.takeAudioTranscript ?? annotation.commentaryAudioTranscript,
```

and resolve the audio URL from `annotation.takeAudioStorageId ?? annotation.commentaryAudioStorageId`.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/backend && npx vitest run convex/take-rename.test.ts`
Expected: PASS — 2 tests

- [ ] **Step 6: Update every consumer**

Find them all, then fix each:

```bash
grep -rn "commentaryText\|commentaryAudioStorageId\|commentaryAudioTranscript" \
  apps/web apps/extension packages --include=*.ts --include=*.tsx \
  | grep -v node_modules
```

Rename `apps/extension/components/commentary-composer.tsx` → `take-composer.tsx` and its exported component `CommentaryComposer` → `TakeComposer`, updating the three importers (`clip-composer.tsx`, `podcast-clipper.tsx`, `article-panel.tsx`).

- [ ] **Step 7: Verify everything**

Run:
```bash
cd packages/backend && npx vitest run && npx tsc -p convex --noEmit
cd ../../apps/web && npx tsc --noEmit
cd ../extension && pnpm typecheck
```
Expected: all suites PASS, all three `tsc` runs exit 0

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: rename commentary -> take across schema, backend, web and extension

Matches the vocabulary locked in docs/conceptual-model.md. New rows write take*;
projections fall back to commentary* so pre-rename rows keep rendering.
likes -> votes stays out of scope."
```

---

### Task 6: Web — render processing and failed clips

Optimistic publish puts rows in the feed with no clip yet. Both surfaces must handle that, and neither may show a broken player.

**Files:**
- Create: `apps/web/components/clip-media.tsx`
- Modify: `apps/web/app/a/[id]/page.tsx`
- Modify: the feed card component (find it: `grep -rln "clipUrl" apps/web/components apps/web/app`)

**Interfaces:**
- Consumes: `mediaState` from Task 2, `takeText` from Task 5.
- Produces: `<ClipMedia mediaState={…} clipUrl={…} sourceType={…} />`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/components/clip-media.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ClipMedia } from "./clip-media";

describe("ClipMedia", () => {
  it("renders a video player when ready", () => {
    const { container } = render(
      <ClipMedia mediaState="ready" clipUrl="https://example.com/c.mp4" sourceType="youtube" />
    );
    expect(container.querySelector("video")).not.toBeNull();
  });

  it("renders an audio player for podcasts", () => {
    const { container } = render(
      <ClipMedia mediaState="ready" clipUrl="https://example.com/c.mp3" sourceType="podcast" />
    );
    expect(container.querySelector("audio")).not.toBeNull();
  });

  it("shows a processing notice and no player while slicing", () => {
    const { container } = render(
      <ClipMedia mediaState="processing" clipUrl={null} sourceType="youtube" />
    );
    expect(screen.getByText(/clip processing/i)).toBeTruthy();
    expect(container.querySelector("video")).toBeNull();
  });

  it("shows a failure notice and no player when the slice failed", () => {
    const { container } = render(
      <ClipMedia mediaState="failed" clipUrl={null} sourceType="youtube" />
    );
    expect(screen.getByText(/couldn't be made/i)).toBeTruthy();
    expect(container.querySelector("video")).toBeNull();
  });

  it("treats an absent mediaState with a clipUrl as ready (pre-migration rows)", () => {
    const { container } = render(
      <ClipMedia mediaState={undefined} clipUrl="https://example.com/c.mp4" sourceType="youtube" />
    );
    expect(container.querySelector("video")).not.toBeNull();
  });

  it("renders nothing for an article, which has no clip", () => {
    const { container } = render(
      <ClipMedia mediaState={undefined} clipUrl={null} sourceType="article" />
    );
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run components/clip-media.test.tsx`
Expected: FAIL — cannot resolve `./clip-media`

> If `apps/web` has no vitest setup yet, add `vitest`, `@testing-library/react`, `jsdom` as devDependencies and a `vitest.config.ts` with `environment: "jsdom"`, mirroring `packages/backend/vitest.config.ts`. That setup belongs to this task.

- [ ] **Step 3: Write the implementation**

Create `apps/web/components/clip-media.tsx`:

```tsx
export type MediaState = "processing" | "ready" | "failed" | undefined;

/**
 * The single place a clip becomes a player. Optimistic publish means a row can
 * exist before its media does, so every surface that shows a clip must handle
 * three states — rendering them here keeps the feed and the landing page from
 * drifting. An absent mediaState means "ready": every row created before
 * optimistic publish had its clip attached at insert time.
 */
export function ClipMedia({
  mediaState,
  clipUrl,
  sourceType,
}: {
  mediaState: MediaState;
  clipUrl: string | null;
  sourceType: "youtube" | "podcast" | "article";
}) {
  if (sourceType === "article") return null;

  if (mediaState === "failed") {
    return (
      <div className="b-card b-card--notice">
        <p className="b-notice-title">This clip couldn&apos;t be made</p>
        <p className="b-notice-body">
          The take and the source link below are intact. Try clipping it again.
        </p>
      </div>
    );
  }

  if (mediaState === "processing" || !clipUrl) {
    return (
      <div className="b-card b-card--notice" aria-live="polite">
        <p className="b-notice-title">Clip processing…</p>
        <p className="b-notice-body">This page updates itself when it&apos;s ready.</p>
      </div>
    );
  }

  return sourceType === "podcast" ? (
    <audio controls src={clipUrl} className="b-media" />
  ) : (
    <video controls playsInline src={clipUrl} className="b-media" />
  );
}
```

Match the real class names to the existing brutalist utility classes in `apps/web/app/globals.css`. Read that file first; do not invent class names.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run components/clip-media.test.tsx`
Expected: PASS — 6 tests

- [ ] **Step 5: Use it on both surfaces**

Replace the inline `<video>` / `<audio>` blocks in `apps/web/app/a/[id]/page.tsx` and in the feed card with `<ClipMedia />`, passing `mediaState` from the projection. Because the landing page and the feed both subscribe through Convex, `mediaState` flipping to `"ready"` re-renders the player with no reload — verify this rather than assuming it.

- [ ] **Step 6: Verify in a browser**

Run `pnpm dev`, publish a YouTube clip from the extension, and watch `/a/[id]`:
- the page resolves immediately with the take and source link
- "Clip processing…" is visible
- the player appears **without a reload** when the slice lands

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/clip-media.tsx apps/web/components/clip-media.test.tsx apps/web/app/a/\[id\]/page.tsx
git add -A apps/web
git commit -m "feat(web): render processing and failed clips

One ClipMedia component for both the feed and the landing page, so the three
media states can't diverge. Absent mediaState still means ready."
```

---

### Task 7: Extension — publish first, slice after

**Files:**
- Modify: `apps/extension/lib/convex-publish.ts`
- Modify: `apps/extension/lib/worker-client.ts`
- Modify: `apps/extension/components/clip-composer.tsx:269-317`
- Modify: `apps/extension/components/podcast-clipper.tsx`, `apps/extension/components/article-panel.tsx`

**Interfaces:**
- Consumes: `api.media.*` and `api.files.generateUploadUrlForUser` from Task 4; the `take*` arg names from Task 5.
- Produces: `publishYoutubeAuthed` and `publishPodcastAuthed` no longer take `clipStorageId`; `uploadTakeAudio(blob) → { storageId, transcript }` replaces `transcodeCommentary`.

- [ ] **Step 1: Remove `clipStorageId` from the publish args**

In `apps/extension/lib/convex-publish.ts`, delete `clipStorageId: string;` from `YoutubePublishArgs` and `PodcastPublishArgs`, and rename the three `commentary*` fields to `take*` in all three arg types.

- [ ] **Step 2: Replace the worker calls**

Rewrite `apps/extension/lib/worker-client.ts` so it contains **no** `workerUrl`, no `workerToken`, and no `fetch` to a `fly.dev` host. Each former export becomes a Convex call through the authed client helper already in `convex-publish.ts` (export `buildAuthedClient` from there, or move it to a shared `lib/convex-client.ts` — prefer the latter, since two modules now need it).

```ts
import { makeFunctionReference } from "convex/server";
import type { Chapter } from "@annotated/shared";
import { buildAuthedClient } from "./convex-client";

const youtubeChapters = makeFunctionReference<
  "action", { videoId: string }, Chapter[]
>("media:youtubeChapters");

const transcodeTake = makeFunctionReference<
  "action",
  { audioStorageId: string; mimeType: string },
  { storageId: string; transcript: string | null }
>("media:transcodeTake");

const generateUploadUrlForUser = makeFunctionReference<
  "mutation", Record<string, never>, string
>("files:generateUploadUrlForUser");

/** Chapters are an enhancement — a failure must never block clipping. */
export async function fetchYoutubeChapters(videoId: string): Promise<Chapter[]> {
  try {
    const client = await buildAuthedClient();
    return await client.action(youtubeChapters, { videoId });
  } catch {
    return [];
  }
}

/**
 * Puts a recorded take into Convex storage, then asks the server to transcode
 * it to mp3 and transcribe it. The blob goes straight to storage rather than
 * through an action argument — a 90s recording exceeds Convex's argument size
 * limit as base64.
 */
export async function uploadTakeAudio(
  blob: Blob
): Promise<{ storageId: string; transcript: string | null }> {
  const client = await buildAuthedClient();
  const uploadUrl = await client.mutation(generateUploadUrlForUser, {});
  const uploaded = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": blob.type || "audio/webm" },
    body: blob,
  });
  if (!uploaded.ok) {
    throw new Error("Couldn't upload that recording. Try again.");
  }
  const { storageId } = (await uploaded.json()) as { storageId: string };
  return await client.action(transcodeTake, {
    audioStorageId: storageId,
    mimeType: blob.type || "audio/webm",
  });
}
```

Keep `getWebUrl()` — it reads `PLASMO_PUBLIC_WEB_URL`, not a secret. Delete `getWorkerToken()`, `clipYoutube`, `clipAudio`, `transcodeCommentary`, `transcribePodcast`, `transcribeYoutube`, and `extractArticle`, updating each caller to the Convex equivalent (`api.articles.extractArticle` already exists for the last one).

- [ ] **Step 3: Reorder publish in the composer**

In `apps/extension/components/clip-composer.tsx`, replace `handlePublish` (`:269-317`) with:

```ts
  async function handlePublish() {
    if (startMs === null || endMs === null) return;
    setStatus("publishing");
    setProcessingStartedAt(Date.now());
    setErrorMsg(null);
    try {
      const fresh = await getActiveVideoMeta();
      const captured = {
        title: fresh.title || source?.title || (await getActiveVideoTitle()),
        channelName: fresh.channelName ?? source?.channelName ?? null,
        channelUrl: fresh.channelUrl ?? source?.channelUrl ?? null,
      };
      // A recorded take still has to reach storage before publish, because the
      // annotation row references it. Text-only takes skip this entirely.
      const takeAudio = audioBlob ? await uploadTakeAudio(audioBlob) : null;
      const id = await publishYoutubeAuthed({
        videoId,
        title: captured.title,
        author: captured.channelName ?? undefined,
        channelUrl: captured.channelUrl ?? undefined,
        clipStartMs: startMs,
        clipEndMs: endMs,
        takeText: commentary.trim(),
        takeAudioStorageId: takeAudio?.storageId,
        takeAudioTranscript: takeAudio?.transcript ?? undefined,
        isAnonymous,
        threadId: thread.threadId ?? undefined,
        topicIds,
      });
      setAnnotationId(id);
      setStatus("done");
      void clearClipDraft(videoId);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Publish failed");
      setStatus("error");
    }
  }
```

The `"clipping"` status value is now unreachable from this path — remove it from the `Status` union and from the button-label ternary at `:418`.

- [ ] **Step 4: Fix the lying progress estimate**

`ProgressIndicator` at `:424` is told `6000` / `9000` ms for work that used to take 24–32s. Publish is now just a mutation plus an optional upload, so replace the estimate with:

```tsx
      {busy && processingStartedAt !== null && (
        <ProgressIndicator
          label={audioBlob ? "Uploading your take…" : "Publishing…"}
          estimateMs={audioBlob ? 4000 : 1500}
          startedAt={processingStartedAt}
        />
      )}
```

- [ ] **Step 5: Apply the same changes to the other two composers**

`podcast-clipper.tsx` and `article-panel.tsx` follow the identical pattern: drop the worker clip call, publish first, use `uploadTakeAudio`, rename `commentary*` → `take*`. The article path has no slice at all, so it never enters `processing`.

- [ ] **Step 6: Verify types and build**

Run:
```bash
cd apps/extension && pnpm typecheck && pnpm build
```
Expected: `tsc --noEmit` exits 0; Plasmo build succeeds

- [ ] **Step 7: Run the loaded-extension E2E**

Run: `cd apps/extension && node e2e/mic-record.e2e.mjs`
Expected: PASS. If it references `transcodeCommentary`, update it to the new call.

- [ ] **Step 8: Commit**

```bash
git add apps/extension
git commit -m "feat(extension): publish first, slice after

The panel no longer calls the worker. Publish creates the row (URL exists in
~2s) and Convex slices behind it; recorded takes upload straight to Convex
storage. Progress estimates now match the work actually being done."
```

---

### Task 8: Delete the worker credential

The exposed token was rotated on 2026-08-11. This task removes the *class* of exposure: after it, no build can leak a worker credential because the extension holds none.

**Files:**
- Modify: `apps/extension/.env`, `apps/extension/.env.example`
- Modify: `apps/extension/package.json` (manifest `host_permissions`)
- Modify: `docs/extension-distribution.md`

**Interfaces:**
- Consumes: Task 7 (nothing in the extension calls the worker any more).
- Produces: a built bundle containing no worker token and no worker host.

- [ ] **Step 1: Remove the env vars**

Delete `PLASMO_PUBLIC_WORKER_TOKEN` and `PLASMO_PUBLIC_WORKER_URL` from `apps/extension/.env` and `apps/extension/.env.example`.

- [ ] **Step 2: Narrow the manifest**

`apps/extension/package.json`'s manifest has `"host_permissions": ["https://*/*"]`. That breadth exists partly to reach the worker. It is still needed for content-script injection on arbitrary article and podcast pages (the SPEC's "any website" requirement), so **keep it** — but add a comment in `docs/extension-distribution.md` recording that it is for page access, not for a backend host, since Chrome Web Store review asks about broad host permissions.

- [ ] **Step 3: Rebuild**

Run: `cd apps/extension && pnpm build`
Expected: build succeeds with no "Worker is not configured" errors at runtime

- [ ] **Step 4: Prove the bundle is clean**

Run:

```bash
cd apps/extension/build/chrome-mv3-prod
grep -rlE '[0-9a-f]{64}' . || echo "no 64-hex secrets in bundle"
grep -rl 'fly\.dev' . || echo "no worker host in bundle"
```

Expected: both lines print the "no …" message. If either matches, find the source and remove it before continuing — this is the acceptance criterion for the whole task.

- [ ] **Step 5: Verify the full flow against the deployed backend**

Load the unpacked build in Chrome, sign in, and publish one clip of each type (YouTube, podcast, article). Each must produce a working `/a/[id]`.

- [ ] **Step 6: Repackage and ship**

Regenerate the Web Store zip and the `/extension` sideload zip, then re-run Step 4's grep against the **zip contents**, not just the build directory:

```bash
cd /tmp && rm -rf zipcheck && mkdir zipcheck && \
  unzip -q /path/to/annotated-extension-webstore.zip -d zipcheck && \
  (grep -rlE '[0-9a-f]{64}' zipcheck || echo "zip is clean")
```

- [ ] **Step 7: Commit**

```bash
git add apps/extension/.env.example apps/extension/package.json docs/extension-distribution.md
git commit -m "fix(extension): remove the worker credential from the bundle

Every worker call now runs server-side through Convex, so PLASMO_PUBLIC_WORKER_TOKEN
and _URL are gone. Verified: no 64-hex secret and no fly.dev host in the built
bundle or the packaged zip."
```

---

## Self-Review

**Spec coverage.** Checked each section of `2026-08-11-extension-experience-design.md` against a task:

| Spec section | Task |
|---|---|
| Worker latency | 1 |
| `mediaState` schema | 2 |
| Worker calls move server-side | 3, 4 |
| `commentary` → `take` | 5 |
| Web minimum (processing/failed renderers) | 6 |
| Error paths (failed visible, blob cleanup) | 3 (`attachClip` deletes orphans, `markFailed` keeps the page resolvable), 6 |
| Security (token deleted, not rotated) | 8 |
| Acceptance #4, #5, #6, #10 | 3, 6, 1, 8 |
| **The four screens, six states, visual treatment, dark mode, topic pre-fill, extension file structure** | **Plan B — not this plan** |

Acceptance criteria 1, 2, 3, 7, 8, 9 are Plan B's; they are UI behaviours and cannot be met by backend work.

**Placeholder scan.** Two steps deliberately instruct the implementer to read source before writing rather than giving literal code: Task 5 Step 1 (the `users` / `sources` insert shapes in the test fixture) and Task 6 Step 3 (brutalist class names in `globals.css`). Each names the exact file to read and why guessing would be wrong. No "TBD", no "add error handling", no "similar to Task N".

A third was removed during review. Task 3's podcast branch originally said "use the source's `enclosureUrl`, confirm the field name". Checking `schema.ts` showed the field is `mp3Url` — and that using it would have silently reintroduced the ad-insertion drift that commit `9cf7ac0` fixed, because podcast clips must come from the frozen `transcripts.episodeStorageId` copy the word timestamps belong to. The step now specifies the frozen copy explicitly, and `slicePodcast` takes a storage id rather than a URL.

**Type consistency.** `mediaState` uses the same three literals in schema, `AnnotationInsert`, `ClipMedia`, and the tests. `attachClip` / `markFailed` names match between `clips.ts`, the scheduling call sites, and `clips.test.ts`. `uploadTakeAudio` returns `{ storageId, transcript }` in Task 7 and is consumed with those exact keys in the composer. `take*` field names are identical across schema, mutation args, publish args, and projections.

**Known gap carried forward.** Task 4 removes `transcribePodcast` from the extension, but podcast transcription remains a synchronous 20–40s worker call (debt j). This plan makes the wait honest, not shorter. The async Deepgram-callback move stays deferred — it is listed as a risk in the spec.
