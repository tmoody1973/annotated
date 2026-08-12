/**
 * Screen 1. Arriving must never present a form: one obvious action, seeded from
 * whatever the page already tells us. When there is nothing to clip, a dead end
 * that names its cause and offers a next move — "can't" without "why" reads as
 * broken.
 *
 * The copy in DEAD_ENDS is product voice, not filler. Change it in the spec
 * first (docs/superpowers/specs/2026-08-11-extension-experience-design.md).
 */
import { useEffect, useState } from "react";
import { requestPlayerTimeMs } from "../../lib/player-time";
import { openSignIn, type AuthState } from "../../lib/use-auth-state";
import type { DetectedSource } from "../../lib/use-detected-source";
import type { SpanMs } from "../../lib/use-panel-flow";
import { DEAD_ENDS, primaryAction, type DeadEnd } from "../../lib/source-states";

function DeadEndBody({ state }: { state: DeadEnd }) {
  return (
    <>
      <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.5 }}>{state.body}</p>
      {state.bullets ? (
        <ul style={{ margin: "0 0 14px", paddingLeft: 18, fontSize: 13 }} className="ann-dim">
          {state.bullets.map((bullet) => (
            <li key={bullet} style={{ marginBottom: 2 }}>
              {bullet}
            </li>
          ))}
        </ul>
      ) : null}
      {state.link ? (
        <button
          type="button"
          className="ann-link"
          onClick={() => void chrome.tabs.create({ url: state.link!.href })}
        >
          {state.link.label}
        </button>
      ) : null}
    </>
  );
}

function SignInButtons() {
  return (
    <div style={{ display: "grid", gap: 8, marginTop: 4 }}>
      <button type="button" className="ann-publish ann-press" onClick={openSignIn}>
        Continue with X
      </button>
      <button type="button" className="ann-capture ann-press" style={{ padding: 12 }} onClick={openSignIn}>
        Continue with Google
      </button>
    </div>
  );
}

/** Title, show or channel, and type — what the user is looking at, in their words. */
function SourceCard({ detected }: { detected: DetectedSource }) {
  const described = describeSource(detected);
  if (!described) return null;
  return (
    <div className="ann-card" style={{ padding: "10px 12px", marginBottom: 12 }}>
      <div
        className="ann-dim"
        style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}
      >
        {described.type}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3, marginTop: 2 }}>
        {described.title}
      </div>
      {described.subtitle ? (
        <div className="ann-dim" style={{ fontSize: 12, marginTop: 2 }}>
          {described.subtitle}
        </div>
      ) : null}
    </div>
  );
}

function describeSource(
  detected: DetectedSource,
): { type: string; title: string; subtitle?: string } | null {
  switch (detected.kind) {
    case "youtube":
      return { type: "YouTube", title: "This video" };
    case "article":
      return { type: "Article", title: detected.article.title || "This page" };
    case "podcast": {
      const { podcast } = detected;
      if (podcast.kind === "enclosure") {
        return { type: "Podcast", title: podcast.pageTitle || "This episode", subtitle: podcast.showName };
      }
      if (podcast.kind === "generic") {
        return { type: "Podcast", title: podcast.pageTitle || "This episode" };
      }
      return { type: "Podcast", title: "This episode" };
    }
    case "detecting":
    case "unsupported":
      return null;
  }
}

interface SourceScreenProps {
  detected: DetectedSource;
  auth: AuthState;
  onStartClip: (spanMs: SpanMs | null) => void;
}

export function SourceScreen({ detected, auth, onStartClip }: SourceScreenProps) {
  const [playheadMs, setPlayheadMs] = useState<number | null>(null);

  const isYoutube = detected.kind === "youtube";
  useEffect(() => {
    if (!isYoutube) return;
    let cancelled = false;
    void requestPlayerTimeMs().then((ms) => {
      if (!cancelled) setPlayheadMs(ms);
    });
    return () => {
      cancelled = true;
    };
  }, [isYoutube, detected.kind === "youtube" ? detected.videoId : null]);

  if (detected.kind === "detecting") return <DeadEndBody state={DEAD_ENDS.detecting} />;
  if (detected.kind === "podcast" && detected.podcast.kind === "spotify") {
    return <DeadEndBody state={DEAD_ENDS.spotify} />;
  }

  // Signing in is only required to publish, so the gate lives on the take
  // screen. Here it doubles as the welcome — shown when there is nothing to
  // clip anyway, which is what a genuine first run looks like.
  //
  // Which of the two shows depends on an answer that arrives late: the auth
  // relay can take seconds to open its hidden tab. Guessing while it is in
  // flight greeted every newcomer with "Nothing to clip on this page", so we
  // hold on the neutral copy until we actually know.
  if (detected.kind === "unsupported") {
    if (auth.status === "loading") return <DeadEndBody state={DEAD_ENDS.detecting} />;
    return auth.status === "signed-out" ? (
      <>
        <DeadEndBody state={DEAD_ENDS.firstRun} />
        <SignInButtons />
      </>
    ) : (
      <DeadEndBody state={DEAD_ENDS.unsupported} />
    );
  }

  const action = primaryAction(detected, playheadMs);

  return (
    <>
      <SourceCard detected={detected} />
      <button
        type="button"
        className="ann-publish ann-press"
        onClick={() => onStartClip(action.spanMs)}
      >
        {action.label}
      </button>
      <p className="ann-dim" style={{ fontSize: 12, margin: "10px 0 0" }}>
        Up to 90 seconds · fair use
      </p>
    </>
  );
}

