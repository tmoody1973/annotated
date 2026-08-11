# Extension Four-Screen UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-scroll side panel with a staged four-screen flow — Source → Clip → Take → Published — so each screen does one thing and gets the whole panel to do it.

**Architecture:** `sidepanel.tsx` becomes a router over a small state machine. One component per screen; the Clip screen swaps its body by source type (YouTube scrubber / podcast transcript drag / article highlight mirror) behind a common interface. Design tokens move to one shared module that both the panel and the web app import, and the panel gains the dark variant it never had.

**Tech Stack:** Plasmo MV3 side panel, React 19, TypeScript strict, Convex client, Playwright loaded-extension E2E.

**Spec:** `docs/superpowers/specs/2026-08-11-extension-experience-design.md`

## Dependency

**This plan requires Plan A (`2026-08-11-extension-foundation.md`) to have landed.** It builds on:

- `publishYoutubeAuthed` / `publishPodcastAuthed` / `publishArticleAuthed` taking **no** `clipStorageId` — publish returns a real annotation id in ~2s
- `mediaState` on annotations, so the Published screen can show "clip processing…"
- `take*` field names throughout (not `commentary*`)
- `uploadTakeAudio(blob)` replacing `transcodeCommentary`
- No worker token in the extension

If any of those are missing, stop and finish Plan A first.

## Global Constraints

- TypeScript strict mode. **No `any`**, no untyped casts.
- ESM only. Relative imports in the worker carry `.js`; the extension does not — match each package's existing style.
- File names kebab-case (`take-screen.tsx`); React components PascalCase.
- One responsibility per file; **split when a file exceeds ~200 lines**. `clip-composer.tsx` is currently 440 lines — this plan dismantles it.
- **Vocabulary is locked** (`docs/conceptual-model.md`): Annotation, Clip, **Take**, Comment, Vote, Remove. Never "commentary", never "like". User-facing copy follows `docs/annotated-improvements/annotated_product_strategy_final.md`: the sidebar frames clipping as an editorial act — **"Choose the evidence. State the claim. Publish the receipt."**
- **Never show internal vocabulary to the user.** No "Convex", no raw video ids, no storage ids. The panel describes the user's world.
- Fair-use framing is visible at the point of clipping, not in onboarding: "Up to 90 seconds · fair use" on the Clip screen, "n / ~100 words · fair use" on the article path.
- `MAX_CLIP_MS = 90_000`. Import from `@annotated/shared`; do not redefine.
- Accessibility is a requirement, not a polish pass: every control keyboard-operable, every state change announced (`aria-live`), focus moved to the new screen's heading on navigation, and **never state by colour alone**.
- Commit after every task. Conventional commit format.

## Design Decisions (already made — do not relitigate)

| Decision | Choice |
|---|---|
| Screens | Four: Source → Clip → Take → Published |
| Opening | One obvious action, pre-seeded from context. Never a form. |
| Topics | Pre-filled and editable. **Never blocks Publish.** |
| Publish | Optimistic (Plan A). URL auto-copied on arrival at Published. |
| Weight | Brutalist palette kept; hard shadow 6px → 3px, and only the primary action keeps one. |
| Dark mode | Added, using the web's existing tokens verbatim. |
| Labels | **Kept.** Section labels, the explicit step indicator, and the visible anonymous toggle all stay — the brutalist language is declarative, and explicit structure helps a newcomer build the model. |

## File Structure

**Create:**
| File | Responsibility |
|---|---|
| `packages/shared/src/brutalist-tokens.ts` | The single source of the `--b-*` palette in both light and dark, consumed by the panel and (later) the web app. Ends the two hand-maintained copies. |
| `apps/extension/lib/panel-theme.ts` | Turns the shared tokens into the panel's injected CSS, including the `prefers-color-scheme` dark block. |
| `apps/extension/lib/use-panel-flow.ts` | The state machine: which screen is active, the draft being built, and the transitions between them. Pure logic, unit-tested. |
| `apps/extension/components/panel-shell.tsx` | Header (mark, back, step indicator), focus management, and the `aria-live` region every screen renders into. |
| `apps/extension/components/screens/source-screen.tsx` | Screen 1 + the five non-clippable states. |
| `apps/extension/components/screens/clip-screen.tsx` | Screen 2 shell; selects a body by source type. |
| `apps/extension/components/screens/clip-body-youtube.tsx` | Scrubber with draggable handles and a live playhead. |
| `apps/extension/components/screens/clip-body-podcast.tsx` | Transcript drag → audio span. The differentiator. |
| `apps/extension/components/screens/clip-body-article.tsx` | Mirrors the page selection; clamps at ~100 words. |
| `apps/extension/components/screens/take-screen.tsx` | Screen 3. |
| `apps/extension/components/screens/published-screen.tsx` | Screen 4. |
| `apps/extension/e2e/four-screen-flow.e2e.mjs` | Loaded-extension E2E across all four screens. |
| `packages/backend/convex/topics-suggest.ts` | The pre-fill query. |

**Modify:**
| File | Change |
|---|---|
| `apps/extension/sidepanel.tsx` | Becomes the router. Loses all inline styling and the detection-branch ladder. |
| `apps/extension/lib/clip-styles.ts` | Reduced to a re-export of the shared tokens, then deleted once nothing imports it. |
| `apps/extension/components/clip-composer.tsx`, `podcast-clipper.tsx`, `article-panel.tsx` | Dismantled into the screen components; deleted when empty. |
| `apps/extension/lib/clip-draft.ts` | Persists the active screen alongside the draft content. |

---

### Task 1: Shared tokens + dark mode

The panel and the web app each hand-maintain a copy of the brutalist palette. They have already drifted: the web has a dark variant, the panel does not. One source, two consumers.

**Files:**
- Create: `packages/shared/src/brutalist-tokens.ts`, `packages/shared/src/brutalist-tokens.test.ts`
- Create: `apps/extension/lib/panel-theme.ts`
- Modify: `packages/shared/src/index.ts` (export), `apps/extension/lib/clip-styles.ts`

**Interfaces:**
- Produces: `BRUTALIST_LIGHT` and `BRUTALIST_DARK` (both `Record<TokenName, string>`), `type TokenName`, and `panelCss(): string` from `panel-theme.ts`.

- [ ] **Step 1: Write the failing test**

Create `packages/shared/src/brutalist-tokens.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { BRUTALIST_DARK, BRUTALIST_LIGHT } from "./brutalist-tokens";

describe("brutalist tokens", () => {
  it("defines the same token names in both themes", () => {
    expect(Object.keys(BRUTALIST_LIGHT).sort()).toEqual(Object.keys(BRUTALIST_DARK).sort());
  });

  it("matches the web app's light values exactly", () => {
    // Sourced from apps/web/app/globals.css:57-67 — these must not drift.
    expect(BRUTALIST_LIGHT.bg).toBe("#f4f1e8");
    expect(BRUTALIST_LIGHT.card).toBe("#ffffff");
    expect(BRUTALIST_LIGHT.ink).toBe("#0a0a0a");
    expect(BRUTALIST_LIGHT.acid).toBe("#e1ff00");
    expect(BRUTALIST_LIGHT.shadow).toBe("#0a0a0a");
  });

  it("matches the web app's dark values exactly", () => {
    // Sourced from apps/web/app/globals.css:70-80. Note the two surprises that
    // make this theme work: cards stay LIGHT in dark mode, and the shadow
    // becomes acid rather than ink.
    expect(BRUTALIST_DARK.bg).toBe("#0b0b0c");
    expect(BRUTALIST_DARK.card).toBe("#fbfbf7");
    expect(BRUTALIST_DARK.ink).toBe("#0a0a0a");
    expect(BRUTALIST_DARK.shadow).toBe("#e1ff00");
  });

  it("keeps dim text legible against its own background in both themes", () => {
    expect(BRUTALIST_LIGHT.dimOnBg).toBe("#555049");
    expect(BRUTALIST_DARK.dimOnBg).toBe("#a9a9a1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && npx vitest run src/brutalist-tokens.test.ts`
Expected: FAIL — cannot resolve `./brutalist-tokens`

- [ ] **Step 3: Write the implementation**

Read `apps/web/app/globals.css:54-80` first and copy the values from it — do not retype them from this plan, so a later change to the CSS is caught as a test failure rather than silently diverging.

Create `packages/shared/src/brutalist-tokens.ts`:

```ts
/**
 * The brutalist palette, in one place.
 *
 * Previously duplicated by hand in apps/web/app/globals.css and
 * apps/extension/lib/clip-styles.ts. They drifted: the web gained a dark
 * variant and the panel never did, which is why the side panel glows cream
 * beside a dark YouTube page.
 *
 * Two things about the dark theme are deliberate and look like mistakes:
 * cards stay light paper on a near-black page, and the hard offset shadow
 * becomes acid instead of ink. Both come from the web app's shipped theme.
 */
export type TokenName =
  | "bg" | "onBg" | "card" | "ink" | "acid" | "acidInk"
  | "line" | "dim" | "dimOnBg" | "shadow" | "chrome";

export const BRUTALIST_LIGHT: Record<TokenName, string> = {
  bg: "#f4f1e8",
  onBg: "#0a0a0a",
  card: "#ffffff",
  ink: "#0a0a0a",
  acid: "#e1ff00",
  acidInk: "#0a0a0a",
  line: "#0a0a0a",
  dim: "#5f5f59",
  dimOnBg: "#555049",
  shadow: "#0a0a0a",
  chrome: "#000000",
};

export const BRUTALIST_DARK: Record<TokenName, string> = {
  bg: "#0b0b0c",
  onBg: "#fbfbf7",
  card: "#fbfbf7",
  ink: "#0a0a0a",
  acid: "#e1ff00",
  acidInk: "#0a0a0a",
  line: "#000000",
  dim: "#5f5f59",
  dimOnBg: "#a9a9a1",
  shadow: "#e1ff00",
  chrome: "#000000",
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/shared && npx vitest run src/brutalist-tokens.test.ts`
Expected: PASS — 4 tests

- [ ] **Step 5: Build the panel stylesheet**

Create `apps/extension/lib/panel-theme.ts`. It emits CSS custom properties for the light theme on `:root` and redefines only the changed tokens inside `@media (prefers-color-scheme: dark)`, then expresses every panel style in terms of those variables.

Weight rules from the spec, applied here once rather than per-component:
- hard offset shadow is **3px**, not 6px
- **only** `.ann-publish` (the primary action on a screen) carries a shadow; cards do not
- borders stay 2px, corners stay square

```ts
import { BRUTALIST_DARK, BRUTALIST_LIGHT, type TokenName } from "@annotated/shared";

const varName = (t: TokenName): string => `--b-${t.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

function block(tokens: Record<TokenName, string>): string {
  return (Object.keys(tokens) as TokenName[])
    .map((t) => `  ${varName(t)}: ${tokens[t]};`)
    .join("\n");
}

/** The panel's entire stylesheet. Injected once by the router. */
export function panelCss(): string {
  return `
:root {
${block(BRUTALIST_LIGHT)}
}
@media (prefers-color-scheme: dark) {
  :root {
${block(BRUTALIST_DARK)}
  }
}
html, body { margin: 0; background: var(--b-bg); color: var(--b-on-bg); }
.ann-root * { box-sizing: border-box; }
.ann-card { border: 2px solid var(--b-line); background: var(--b-card); color: var(--b-ink); }
.ann-publish {
  border: 2px solid var(--b-line); background: var(--b-acid); color: var(--b-acid-ink);
  box-shadow: 3px 3px 0 0 var(--b-shadow);
}
.ann-press { transition: transform 80ms ease, box-shadow 80ms ease; }
.ann-press:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 0 var(--b-shadow); }
:focus-visible { outline: 3px solid var(--b-acid); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .ann-press { transition: none; } }
`;
}
```

- [ ] **Step 6: Verify both themes render**

Run `pnpm --filter extension build`, load the unpacked build, open the panel, and toggle the OS appearance between light and dark. Confirm: the page background follows, cards stay light paper in dark mode, and the primary button's shadow turns acid. Screenshot both.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/brutalist-tokens.ts packages/shared/src/brutalist-tokens.test.ts packages/shared/src/index.ts apps/extension/lib/panel-theme.ts
git commit -m "feat(extension): shared brutalist tokens + the dark mode the panel never had

One source for the palette instead of two hand-maintained copies that had
already drifted. Shadow weight dialed 6px -> 3px and reserved for the primary
action, per the 380px design review."
```

---

### Task 2: The flow state machine

The panel has no stages, which is why it has no back button, no orientation, and no finish line. The machine is the fix; everything else in this plan hangs off it. Pure logic, tested without React.

**Files:**
- Create: `apps/extension/lib/use-panel-flow.ts`, `apps/extension/lib/panel-flow.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type Screen = "source" | "clip" | "take" | "published";
  type Draft = {
    spanMs: { startMs: number; endMs: number } | null;
    selectedText: string | null;
    takeText: string;
    takeAudio: Blob | null;
    topicIds: string[];
    isAnonymous: boolean;
  };
  type FlowState = { screen: Screen; draft: Draft; annotationId: string | null };
  function flowReducer(state: FlowState, action: FlowAction): FlowState;
  const EMPTY_DRAFT: Draft;
  ```

- [ ] **Step 1: Write the failing test**

Create `apps/extension/lib/panel-flow.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { EMPTY_DRAFT, flowReducer, type FlowState } from "./use-panel-flow";

const initial: FlowState = { screen: "source", draft: EMPTY_DRAFT, annotationId: null };

describe("flowReducer", () => {
  it("starts a clip with a seeded span and advances to the clip screen", () => {
    const next = flowReducer(initial, {
      type: "startClip",
      spanMs: { startMs: 240_000, endMs: 300_000 },
    });
    expect(next.screen).toBe("clip");
    expect(next.draft.spanMs).toEqual({ startMs: 240_000, endMs: 300_000 });
  });

  it("going back from take to clip keeps the take text", () => {
    let s = flowReducer(initial, { type: "startClip", spanMs: { startMs: 0, endMs: 60_000 } });
    s = flowReducer(s, { type: "confirmSpan" });
    s = flowReducer(s, { type: "setTakeText", text: "This is exactly backwards" });
    s = flowReducer(s, { type: "back" });
    expect(s.screen).toBe("clip");
    expect(s.draft.takeText).toBe("This is exactly backwards");
  });

  it("back from the clip screen returns to source and discards the span", () => {
    let s = flowReducer(initial, { type: "startClip", spanMs: { startMs: 0, endMs: 60_000 } });
    s = flowReducer(s, { type: "back" });
    expect(s.screen).toBe("source");
    expect(s.draft.spanMs).toBeNull();
  });

  it("never goes back from published — that clip is finished", () => {
    let s = flowReducer(initial, { type: "published", annotationId: "k9f2" });
    s = flowReducer(s, { type: "back" });
    expect(s.screen).toBe("published");
  });

  it("continuing a thread returns to clip with an empty draft but keeps nothing stale", () => {
    let s = flowReducer(initial, { type: "startClip", spanMs: { startMs: 0, endMs: 60_000 } });
    s = flowReducer(s, { type: "setTakeText", text: "first take" });
    s = flowReducer(s, { type: "published", annotationId: "k9f2" });
    s = flowReducer(s, { type: "addAnotherClip" });
    expect(s.screen).toBe("source");
    expect(s.draft).toEqual(EMPTY_DRAFT);
    expect(s.annotationId).toBeNull();
  });

  it("a source change resets everything — you are on a different page now", () => {
    let s = flowReducer(initial, { type: "startClip", spanMs: { startMs: 0, endMs: 60_000 } });
    s = flowReducer(s, { type: "setTakeText", text: "about the old page" });
    s = flowReducer(s, { type: "sourceChanged" });
    expect(s).toEqual(initial);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/extension && npx vitest run lib/panel-flow.test.ts`
Expected: FAIL — cannot resolve `./use-panel-flow`

> The extension has no vitest config yet (its tests are Playwright `.e2e.mjs` files). Adding `vitest` + a `vitest.config.ts` with `environment: "node"` is part of this task — the flow machine is pure logic and must not need a browser to test.

- [ ] **Step 3: Write the implementation**

Create `apps/extension/lib/use-panel-flow.ts` with the types from the Interfaces block, a `flowReducer` implementing exactly the transitions the tests assert, and a `usePanelFlow()` hook wrapping `useReducer`. Keep the reducer pure — no storage writes inside it; the hook persists via `clip-draft.ts` in an effect.

Transition rules, stated once:
- `back` from `clip` → `source`, clearing `spanMs` (you are re-choosing the evidence)
- `back` from `take` → `clip`, **keeping** `takeText` and `takeAudio` (never destroy typed work)
- `back` from `published` → no-op
- `sourceChanged` → full reset to `initial`
- `addAnotherClip` → `source` with `EMPTY_DRAFT` and `annotationId: null`, but the caller keeps the thread id outside this machine

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/extension && npx vitest run lib/panel-flow.test.ts`
Expected: PASS — 6 tests

- [ ] **Step 5: Commit**

```bash
git add apps/extension/lib/use-panel-flow.ts apps/extension/lib/panel-flow.test.ts apps/extension/vitest.config.ts apps/extension/package.json
git commit -m "feat(extension): the panel flow state machine

Four screens with explicit transitions. Back never destroys typed work; a
source change resets everything. Pure reducer, tested without a browser."
```

---

### Task 3: Panel shell and router

**Files:**
- Create: `apps/extension/components/panel-shell.tsx`
- Modify: `apps/extension/sidepanel.tsx`

**Interfaces:**
- Consumes: `panelCss()` (Task 1), `usePanelFlow()` (Task 2).
- Produces: `<PanelShell screen onBack heading>{children}</PanelShell>`; `sidepanel.tsx` renders the active screen.

- [ ] **Step 1: Build the shell**

`PanelShell` renders the black chrome bar (mark + Back + step indicator), an `<h1>` for the current screen that receives focus on every screen change, and a visually-hidden `aria-live="polite"` region announcing the new screen. Back is absent on `source` and `published`.

Accessibility requirements, all testable:
- the heading is focused on transition (`ref.current?.focus()` with `tabIndex={-1}`)
- the step indicator conveys position in **text** for screen readers (`aria-label="Step 2 of 3"`) as well as visually
- Back is a real `<button>`, reachable by keyboard, labelled "Back"

- [ ] **Step 2: Rewrite the router**

`sidepanel.tsx` keeps the Convex provider and the source-detection hooks, injects `panelCss()` once, and switches on `flow.screen`. Everything it currently renders inline — the "YouTube clip" label, the raw `<code>{videoId}</code>`, the `SourceNote` reading "Checking Convex…" — is **deleted**, not moved. Screen 1 replaces it in Task 4.

The detection ladder (`youtube → explicit podcast → article → generic RSS`) moves into a single `useDetectedSource()` hook returning one discriminated union, so the panel has one source of truth instead of three racing hooks (this also closes debt (m), the article-vs-RSS first-paint flicker).

- [ ] **Step 3: Verify it compiles and loads**

Run: `cd apps/extension && pnpm typecheck && pnpm build`, then load the unpacked build and confirm the panel opens without console errors. It will look unfinished — the screens land in Tasks 4–7.

- [ ] **Step 4: Commit**

```bash
git add apps/extension/components/panel-shell.tsx apps/extension/sidepanel.tsx apps/extension/lib/use-detected-source.ts
git commit -m "feat(extension): panel shell + router over the four screens

Single detection hook replaces three racing ones (closes the article-vs-RSS
first-paint flicker). Focus moves to each screen's heading; step position is
announced, not just drawn."
```

---

### Task 4: Screen 1 — Source, and the five dead ends

Arriving must never present a form. One obvious action, pre-seeded from context — and when there is nothing to clip, a dead end that explains itself.

**Files:**
- Create: `apps/extension/components/screens/source-screen.tsx`
- Create: `apps/extension/e2e/source-states.e2e.mjs`

**Interfaces:**
- Consumes: `useDetectedSource()` (Task 3), `requestPlayerTimeMs()` (`lib/player-time.ts`).
- Produces: `<SourceScreen detection onStartClip />`.

- [ ] **Step 1: Build the detected state**

A source card (title, show/channel, type) and **one** primary action, seeded from context:

| Source | Primary action | Seed |
|---|---|---|
| YouTube | "Clip last 60s" | `requestPlayerTimeMs()` → `{ start: max(0, now - 60_000), end: now }` |
| Podcast | "Clip from the transcript" | no span; the transcript screen sets it |
| Article | "Highlight on the page" | no span; the page selection sets it |

Secondary affordances ("Pick a chapter", "Set manually") are a ghost row beneath. A quiet line reads "Up to 90 seconds · fair use".

If the playhead cannot be read, the button reads "Clip from the start" and seeds `{0, 60_000}` — **never** disable the primary action for a failed read.

- [ ] **Step 2: Build the five non-clippable states**

Copy is specified here because it is the product's voice, not filler. Use it verbatim.

| State | Heading | Body |
|---|---|---|
| First run | "Clip it. Say why. Share the link." | "Grab up to 90 seconds from any video, podcast or article — add your take — get a page you can paste anywhere." + Continue with X / Continue with Google + "Fair use, always linked back" |
| Detecting | "Looking at this page…" | "Works on YouTube, podcast pages and articles." |
| Nothing clippable | "Nothing to clip on this page" | "This looks like a plain web page — no video, audio or article body." + the three supported types + "See what others clipped ⟶" |
| Can't be clipped | "This episode can't be clipped" | "Spotify-exclusive shows don't publish an audio feed, so there's no file to clip from." + "Find it on Apple Podcasts ⟶" |
| Signed out | "Sign in to publish" | X and Google only, returning to the action that triggered the gate |

First run is **one screen, hard limit** — no carousel, no second step.

- [ ] **Step 3: Write the E2E**

`source-states.e2e.mjs` loads the unpacked extension and asserts, for each of: a YouTube watch page, a podcast page, an article, and `example.com` — that the panel shows the right heading and that a primary action exists exactly where one should. Follow the existing harness in `apps/extension/e2e/verify-detection-fallback.e2e.mjs`; read it before writing, it already solves the "chrome.sidePanel can't be opened programmatically" problem.

- [ ] **Step 4: Run it**

Run: `cd apps/extension && node e2e/source-states.e2e.mjs`
Expected: PASS on all four pages

- [ ] **Step 5: Commit**

```bash
git add apps/extension/components/screens/source-screen.tsx apps/extension/e2e/source-states.e2e.mjs
git commit -m "feat(extension): source screen with one obvious action + five real dead ends

Arriving offers a single seeded action instead of a form. Every non-clippable
state now names its cause and offers a next move; none falls through to a blank
panel or shows internal vocabulary."
```

---

### Task 5: Screen 2 — Clip, YouTube and article

**Files:**
- Create: `apps/extension/components/screens/clip-screen.tsx`, `clip-body-youtube.tsx`, `clip-body-article.tsx`
- Modify: `packages/shared/src/` — add `MAX_QUOTE_WORDS` and clamping to `selectArticleHighlight`

**Interfaces:**
- Consumes: the flow machine's `confirmSpan` / `setSelectedText`.
- Produces: `<ClipScreen detection draft onChange onNext />`; `MAX_QUOTE_WORDS = 100`; `selectArticleHighlight(...)` returns `{ …, clamped: boolean }`.

- [ ] **Step 1: Write the failing test for the word ceiling**

The persona's named friction-killer is a text selector that errors instead of stopping. Add to `packages/shared/src/article-highlight.test.ts`:

```ts
it("clamps a selection at the word ceiling instead of rejecting it", () => {
  const text = Array.from({ length: 300 }, (_, i) => `word${i}`).join(" ");
  const result = selectArticleHighlight(text, 0, text.length);
  expect(result.valid).toBe(true);
  expect(result.clamped).toBe(true);
  expect(result.selectedText.split(/\s+/).length).toBeLessThanOrEqual(MAX_QUOTE_WORDS);
});

it("clamps on a word boundary, never mid-word", () => {
  const text = Array.from({ length: 300 }, (_, i) => `word${i}`).join(" ");
  const result = selectArticleHighlight(text, 0, text.length);
  expect(result.selectedText.endsWith("-")).toBe(false);
  expect(text.startsWith(result.selectedText)).toBe(true);
});

it("leaves a short selection untouched and unclamped", () => {
  const result = selectArticleHighlight("a short quote from the piece", 2, 13);
  expect(result.clamped).toBe(false);
});
```

- [ ] **Step 2: Run it, watch it fail, implement the clamp**

Run: `cd packages/shared && npx vitest run src/article-highlight.test.ts` → FAIL (`clamped` undefined), then implement and re-run → PASS.

- [ ] **Step 3: Build the YouTube body**

A scrubber that fills the panel width: draggable in/out handles over the video's duration, a live playhead, and the duration reading large with `/ 1:30 max`. The existing `mm:ss` fields survive **as readouts you can still type into** — they update from the drag and the drag updates from them.

Keyboard parity is required, not optional: each handle is a `role="slider"` with `aria-valuemin/max/now`, moved by arrow keys (1s) and shift-arrow (10s).

Reuse `evaluateClipSpan` from `@annotated/shared` for validation — do not re-implement the 90s rule.

- [ ] **Step 4: Build the article body**

The panel mirrors the page's live selection (existing `contents/article.ts` messaging), renders it as a quote, and shows `n / ~100 words · fair use`. On hitting the ceiling it stops extending and shows "Clipped to ~100 words (fair use)" — **no error, no toast**. The fair-use screenshot is captured here silently, as today.

- [ ] **Step 5: Verify**

Run: `cd packages/shared && npx vitest run && cd ../../apps/extension && pnpm typecheck`, then load the build and confirm on a real YouTube video that dragging a handle updates the readout, typing in the readout moves the handle, and arrow keys move the focused handle.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src apps/extension/components/screens
git commit -m "feat(extension): clip screen — youtube scrubber + article word ceiling

Drag is primary; the mm:ss fields survive as two-way readouts. Handles are
keyboard-operable sliders. Article selection clamps at ~100 words on a word
boundary with a visible label instead of erroring."
```

---

### Task 6: Screen 2 — the podcast transcript drag

This is the interaction the product is built around and the reason screen 2 exists at all. It gets the whole panel.

**Files:**
- Create: `apps/extension/components/screens/clip-body-podcast.tsx`
- Modify: `apps/extension/components/transcript-canvas.tsx` (absorb into the new body, then delete)

**Interfaces:**
- Consumes: `transcripts.getBySource`, `selectClipSpan` from `@annotated/shared`.
- Produces: `<ClipBodyPodcast sourceId draft onChange />`.

- [ ] **Step 1: Build the drag**

Speaker-grouped words filling the panel height, scrollable. Pointer-down on a word starts a selection, drag extends it, release commits — and `selectClipSpan` derives the audio span and the quote. The current implementation is tap-to-select; **drag is the specified interaction** and tap-to-start/tap-to-end must remain as the touch and keyboard fallback.

Keyboard path: words are focusable; Enter sets the start, Enter again sets the end, Escape clears.

- [ ] **Step 2: Build the not-ready state**

When the transcript status is `pending`/`processing`, render an elapsed counter against an estimate — "22s elapsed · ~35s for a 48-min episode" — using the existing `ProgressIndicator`, **and** a "Write the take first →" action that jumps to screen 3 and returns. A dead wait here is the podcast path's biggest threat to the 90-second target.

Estimate: scale from the episode duration if known (`~0.75s per minute of audio`), else a flat 40s. Never show a bare spinner.

On status `failed`, show the error and a Retry — never an infinite "transcribing".

- [ ] **Step 3: Verify against a real episode**

Load the build, open a real podcast episode page with an existing transcript, and confirm: dragging across words highlights them contiguously, releasing fills the quote, the derived span is ≤90s, and "Preview the audio" plays the right segment.

- [ ] **Step 4: Commit**

```bash
git add apps/extension/components/screens/clip-body-podcast.tsx
git commit -m "feat(extension): transcript drag gets the whole panel

Drag across words -> audio span, with tap and keyboard as equal fallbacks. The
not-ready state now shows an honest elapsed estimate and offers something to do
inside the wait instead of blocking."
```

---

### Task 7: Screen 3 — Take, with the topic pre-fill

Publish must never be dead because a topic is missing. `clip-composer.tsx:415` currently disables it on `topicIds.length === 0` and renders the reason *below* the disabled button.

**Files:**
- Create: `apps/extension/components/screens/take-screen.tsx`
- Create: `packages/backend/convex/topics-suggest.ts`, `packages/backend/convex/topics-suggest.test.ts`

**Interfaces:**
- Produces: `api.topicsSuggest.forSource({ sourceId?, title }) → Id<"topics">[]` (0 or 1 element).

- [ ] **Step 1: Write the failing test for pre-fill**

Create `packages/backend/convex/topics-suggest.test.ts` asserting the fallback chain in order:

1. the topic this **source** was last tagged with, if the source exists and has one
2. else a keyword match on the source title against topic slugs/labels
3. else the caller's **most-used** topic
4. else empty (the UI shows "+ add topic" and Publish still works)

Each rung gets its own test, plus one asserting an unauthenticated call returns `[]` rather than throwing — pre-fill is an enhancement and must never break publish.

- [ ] **Step 2: Run it, watch it fail, implement**

Use a `by_source` index on `annotationTopics`/`annotations` rather than `.filter()`. No model call — the common case must be free.

- [ ] **Step 3: Build the screen**

Top to bottom: the **clip chip** (`▶ 4:19–5:19 · 1:00`) with an **Edit** link back to screen 2 that keeps the take text; the take field labelled "Your take" with placeholder **"BS or brilliant? Say why."**; "🎙 Record it instead"; the pre-filled topic chip; the "Publish anonymously" toggle, default off; Publish.

Publish is disabled **only** while a publish is in flight or when both take text and take audio are empty. If it is ever disabled, the reason renders **above** it, not below.

- [ ] **Step 4: Verify**

Run the backend tests and `pnpm typecheck`, then load the build and confirm on a source you have clipped before that the topic arrives pre-filled and Publish is live with zero interaction.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/components/screens/take-screen.tsx packages/backend/convex/topics-suggest.ts packages/backend/convex/topics-suggest.test.ts
git commit -m "feat(extension): take screen; topics pre-fill instead of gating publish

Publish is never dead for a missing topic. The clip chip answers 'what am I
annotating' without a scroll, and Edit returns to the span without discarding
the take."
```

---

### Task 8: Screen 4 — Published

The URL is the payload. Plan A made it exist in ~2s; this screen makes that felt.

**Files:**
- Create: `apps/extension/components/screens/published-screen.tsx`

- [ ] **Step 1: Build it**

On arrival: copy `${webUrl}/a/${annotationId}` to the clipboard immediately and announce "URL copied" via the shell's `aria-live` region. Render the URL prominently, a "Copy again" control, and a preview card with the take, the source line, and — while `mediaState === "processing"` — a `◐ clip processing…` line with an elapsed count, subscribed live so it clears itself.

Actions, in this visual order: **"+ Add another clip → thread"** (primary, the loudest thing on screen), "Open the page ⟶", "New clip".

If the clipboard write fails (it can, without a user gesture in some contexts), fall back silently to showing the URL selected and focused — never surface a clipboard error.

- [ ] **Step 2: Verify the auto-copy and the live swap**

Publish a real YouTube clip. Confirm the URL is on the clipboard without clicking anything, and that the "clip processing…" line disappears on its own when the slice lands — no reload.

- [ ] **Step 3: Commit**

```bash
git add apps/extension/components/screens/published-screen.tsx
git commit -m "feat(extension): published screen — URL auto-copied, thread action loudest

Serves the megaphone reflex: the link is on the clipboard before you reach for
it. Processing state clears itself live."
```

---

### Task 9: Dismantle the old composers and prove the flow

**Files:**
- Delete: `apps/extension/components/clip-composer.tsx`, `podcast-clipper.tsx`, `article-panel.tsx`, `transcript-canvas.tsx`, `lib/clip-styles.ts`
- Modify: `apps/extension/lib/clip-draft.ts`
- Create: `apps/extension/e2e/four-screen-flow.e2e.mjs`

- [ ] **Step 1: Delete what the screens replaced**

Remove each file only once nothing imports it. `grep -rn "clip-composer\|clip-styles\|transcript-canvas\|podcast-clipper\|article-panel" apps/extension --include=*.tsx --include=*.ts` must return nothing but the deletions themselves.

- [ ] **Step 2: Persist the active screen**

`clip-draft.ts` stores `screen` alongside the draft so switching tabs and returning restores **position** as well as content. Restoring onto `published` is invalid — a restored draft always resumes at `clip` or `take`.

- [ ] **Step 3: Write the whole-flow E2E**

`four-screen-flow.e2e.mjs` drives a loaded extension through Source → Clip → Take → Published on a real YouTube page, asserting at each step: the heading, that Back exists (and doesn't on screen 1 and 4), that going back from Take preserves typed text, and that Published shows a `/a/` URL. Then assert the same span/take round-trip on an article page.

- [ ] **Step 4: Run everything**

```bash
cd packages/shared && npx vitest run
cd ../backend && npx vitest run && npx tsc -p convex --noEmit
cd ../../apps/extension && npx vitest run && pnpm typecheck && pnpm build
node e2e/four-screen-flow.e2e.mjs
node e2e/source-states.e2e.mjs
```
Expected: all green.

- [ ] **Step 5: Confirm no file regressed past the size rule**

Run `wc -l apps/extension/components/screens/*.tsx apps/extension/*.tsx` — nothing over ~200 lines. `clip-composer.tsx` was 440; if a screen has grown to replace it, the split was wrong.

- [ ] **Step 6: Commit**

```bash
git add -A apps/extension
git commit -m "refactor(extension): delete the single-scroll composers

The four screens replace clip-composer (440 lines), podcast-clipper,
article-panel, transcript-canvas and clip-styles. Draft persistence now
restores position as well as content. Whole-flow E2E covers both paths."
```

---

## Self-Review

**Spec coverage.** Every UI section of `2026-08-11-extension-experience-design.md` maps to a task:

| Spec section | Task |
|---|---|
| Screen 1 Source + one obvious action | 4 |
| Screen 2 YouTube / article | 5 |
| Screen 2 podcast transcript drag + not-ready | 6 |
| Screen 3 Take, clip chip, topic pre-fill, publish never dead | 7 |
| Screen 4 Published, auto-copy, thread action | 8 |
| The six states | 4 (five) + 8 (publish failed) |
| Visual treatment: dialed weight, dark mode, shared tokens | 1 |
| Extension file structure, ~200-line rule | 3, 9 |
| Acceptance criteria 1, 2, 3, 7, 8, 9 | 4, 5, 7, 6, 3, 4 |

Acceptance 4, 5, 6, 10, 11 belong to Plan A. Acceptance 11's E2E half lands here in Task 9.

**Placeholder scan.** Three steps direct the implementer to read source rather than transcribe code: Task 1 Step 3 (copy the palette from `globals.css` so drift fails a test rather than passing silently), Task 4 Step 3 (read the existing E2E harness, which already solves opening the side panel), and Task 6 Step 1 (the existing transcript canvas). Each names the file and the reason. No "TBD", no "add error handling", no "similar to Task N". Copy for all five dead-end states is given verbatim because it is product voice, not filler.

**Type consistency.** `Screen`, `Draft`, `FlowState` and `flowReducer` are defined in Task 2 and used with those exact names in Tasks 3–9. `panelCss()` is produced in Task 1 and consumed in Task 3. `MAX_QUOTE_WORDS` and `clamped` are introduced in Task 5 and referenced nowhere earlier. `api.topicsSuggest.forSource` returns `Id<"topics">[]` in Task 7 and is consumed as an array there only.

**Known gaps carried forward.** Podcast transcription remains synchronous (debt j) — Task 6 makes the wait honest and occupied, not shorter. The native side panel still resizes the page rather than overlaying; that tradeoff is documented as deliberate in `jason-gap-specs.md` §11 and is not revisited here.

**One deliberate divergence from the spec, flagged.** The spec's Take placeholder is "BS or brilliant? Say why." — Jason-persona language. `docs/annotated-improvements/annotated_product_strategy_final.md` frames the sidebar as *"Choose the evidence. State the claim. Publish the receipt."* and deliberately moves the product away from Jason-as-judge toward "the evidence network for the open web". Task 7 keeps the spec's placeholder because it is concrete and specific at the moment of writing, while the strategy phrasing is adopted for the screen **headings**. If the strategy doc is meant to supersede the persona wholesale, this is the line to change, and it is one string.
