/**
 * The side panel router.
 *
 * This file used to be the panel: a detection ladder in JSX, three racing hooks,
 * inline brutalist styling, a raw video id printed on screen and a note that
 * read "Checking Convex…". All of it is gone. What remains is a Convex
 * provider, one detection hook, one state machine, and a switch.
 */
import { useEffect, useRef } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { PanelShell } from "./components/panel-shell";
import { SourceScreen } from "./components/screens/source-screen";
import { ClipScreen } from "./components/screens/clip-screen";
import { TakeScreen } from "./components/screens/take-screen";
import { panelCss } from "./lib/panel-theme";
import { sourceHeading } from "./lib/source-states";
import { useAuthState } from "./lib/use-auth-state";
import { usePublish } from "./lib/use-publish";
import { useThread } from "./lib/use-thread";
import { detectionKey, useDetectedSource } from "./lib/use-detected-source";
import { usePanelFlow } from "./lib/use-panel-flow";

const convexUrl = process.env.PLASMO_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  throw new Error("Missing PLASMO_PUBLIC_CONVEX_URL");
}
const convex = new ConvexReactClient(convexUrl);

/** Removed as each screen lands (Tasks 5–8). */
function ComingNext({ label }: { label: string }) {
  return <p className="ann-dim">{label} is being rebuilt.</p>;
}

function Sidepanel() {
  const detected = useDetectedSource();
  const auth = useAuthState();
  const thread = useThread();
  const publisher = usePublish();
  const flow = usePanelFlow();
  const sourceKey = detectionKey(detected);

  // A different page is a different clip. Only a move between two *known*
  // sources counts: the first detection isn't a change, and a transient null
  // must never reset a screen the user is typing into.
  const lastSourceKey = useRef<string | null>(null);
  const { dispatch } = flow;
  useEffect(() => {
    if (sourceKey === null) return;
    const previous = lastSourceKey.current;
    lastSourceKey.current = sourceKey;
    if (previous !== null && previous !== sourceKey) dispatch({ type: "sourceChanged" });
  }, [sourceKey, dispatch]);

  const heading =
    flow.screen === "source"
      ? sourceHeading(detected, auth.status)
      : flow.screen === "clip"
        ? "Choose the evidence"
        : flow.screen === "take"
          ? "State the claim"
          : "Published";

  return (
    <ConvexProvider client={convex}>
      <style>{panelCss()}</style>
      <PanelShell
        screen={flow.screen}
        heading={heading}
        onBack={flow.canGoBack ? () => flow.dispatch({ type: "back" }) : null}
      >
        {flow.screen === "source" ? (
          <SourceScreen
            detected={detected}
            auth={auth}
            onStartClip={(spanMs) => flow.dispatch({ type: "startClip", spanMs })}
          />
        ) : flow.screen === "clip" ? (
          <ClipScreen
            detected={detected}
            draft={flow.draft}
            onSpanChange={(spanMs) => dispatch({ type: "setSpan", spanMs })}
            onHighlight={(highlight) =>
              dispatch({
                type: "setSelectedText",
                selectedText: highlight?.selectedText ?? null,
                textRange: highlight
                  ? { start: highlight.textStart, end: highlight.textEnd }
                  : null,
              })
            }
            onPodcastSelection={(quote, startMs, endMs, sourceId) =>
              dispatch({
                type: "setPodcastSelection",
                quote,
                spanMs: { startMs, endMs },
                sourceId,
              })
            }
            onNext={() => dispatch({ type: "confirmSpan" })}
          />
        ) : flow.screen === "take" ? (
          <TakeScreen
            detected={detected}
            draft={flow.draft}
            auth={auth}
            publishing={publisher.publishing}
            error={publisher.error}
            onTextChange={(text) => dispatch({ type: "setTakeText", text })}
            onAudioChange={(audio) => dispatch({ type: "setTakeAudio", audio })}
            onTopicsChange={(topicIds) => dispatch({ type: "setTopicIds", topicIds })}
            onAnonymousChange={(isAnonymous) => dispatch({ type: "setAnonymous", isAnonymous })}
            onEditClip={() => dispatch({ type: "back" })}
            onPublish={() => {
              void publisher
                .publish(detected, flow.draft, thread.threadId)
                .then((annotationId) => {
                  if (annotationId) dispatch({ type: "published", annotationId });
                });
            }}
          />
        ) : (
          <ComingNext label="The published screen" />
        )}
      </PanelShell>
    </ConvexProvider>
  );
}

export default Sidepanel;
