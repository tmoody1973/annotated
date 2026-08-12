/**
 * Screen 3. The take is the product; everything else on this screen gets out of
 * its way.
 *
 * Publish is never dead for a missing topic. The old composer disabled it on
 * `topicIds.length === 0` and printed the reason *below* the dead button, where
 * you find it after wondering what you did wrong. The topic now arrives
 * pre-filled and editable, and on the rare occasion Publish is genuinely
 * unavailable the reason sits above it.
 */
import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { formatClipTimestamp } from "@annotated/shared";
import type { Draft } from "../../lib/use-panel-flow";
import type { DetectedSource } from "../../lib/use-detected-source";
import type { AuthState } from "../../lib/use-auth-state";
import { openSignIn } from "../../lib/use-auth-state";
import { TakeComposer } from "../take-composer";
import { TopicChips } from "./topic-chips";

const suggestTopics = makeFunctionReference<
  "query",
  { sourceId?: string; title: string },
  string[]
>("topicsSuggest:forSource");

interface TakeScreenProps {
  detected: DetectedSource;
  draft: Draft;
  auth: AuthState;
  publishing: boolean;
  error: string | null;
  onTextChange: (text: string) => void;
  onAudioChange: (audio: Blob | null) => void;
  onTopicsChange: (topicIds: string[]) => void;
  onAnonymousChange: (isAnonymous: boolean) => void;
  onEditClip: () => void;
  onPublish: () => void;
}

export function TakeScreen({
  detected,
  draft,
  auth,
  publishing,
  error,
  onTextChange,
  onAudioChange,
  onTopicsChange,
  onEditClip,
  onAnonymousChange,
  onPublish,
}: TakeScreenProps) {
  const title = sourceTitle(detected);
  const suggested = useQuery(suggestTopics, {
    ...(draft.sourceId ? { sourceId: draft.sourceId } : {}),
    title,
  });

  // Fill in once, and only into an empty selection — a suggestion that arrives
  // late must never overwrite a choice the user has already made.
  const [prefilled, setPrefilled] = useState(false);
  useEffect(() => {
    if (prefilled || !suggested?.length || draft.topicIds.length > 0) return;
    setPrefilled(true);
    onTopicsChange(suggested);
  }, [suggested, draft.topicIds.length, prefilled, onTopicsChange]);

  const hasTake = draft.takeText.trim().length > 0 || draft.takeAudio !== null;
  const signedOut = auth.status === "signed-out";
  const blockedReason = signedOut
    ? "Sign in to publish — your clip and take are kept."
    : !hasTake
      ? "Add a take, in text or your voice."
      : null;

  return (
    <>
      <ClipChip draft={draft} detected={detected} onEdit={onEditClip} />

      <TakeComposer
        text={draft.takeText}
        onTextChange={onTextChange}
        onAudioChange={onAudioChange}
        disabled={publishing}
      />

      <div style={{ marginTop: 14 }}>
        <TopicChips selected={draft.topicIds} onChange={onTopicsChange} />
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 14,
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={draft.isAnonymous}
          onChange={(event) => onAnonymousChange(event.target.checked)}
          disabled={publishing}
        />
        Publish anonymously
      </label>

      {error ? (
        <p role="alert" style={{ fontSize: 13, margin: "14px 0 0", fontWeight: 700 }}>
          {error}
        </p>
      ) : null}

      {/* Above the button, not below it. */}
      {blockedReason ? (
        <p className="ann-dim" style={{ fontSize: 12, margin: "14px 0 6px" }}>
          {blockedReason}
        </p>
      ) : null}

      {signedOut ? (
        <button type="button" className="ann-publish ann-press" onClick={openSignIn}>
          Sign in to publish
        </button>
      ) : (
        <button
          type="button"
          className="ann-publish ann-press"
          style={{ marginTop: blockedReason ? 0 : 16 }}
          disabled={publishing || !hasTake}
          onClick={onPublish}
        >
          {publishing ? "Publishing…" : "Publish"}
        </button>
      )}
    </>
  );
}

/** What am I annotating — answered without a scroll, and editable in one click. */
function ClipChip({
  draft,
  detected,
  onEdit,
}: {
  draft: Draft;
  detected: DetectedSource;
  onEdit: () => void;
}) {
  const label =
    draft.spanMs !== null
      ? `▶ ${formatClipTimestamp(draft.spanMs.startMs)}–${formatClipTimestamp(draft.spanMs.endMs)} · ${formatClipTimestamp(draft.spanMs.endMs - draft.spanMs.startMs)}`
      : draft.selectedText
        ? `“${truncate(draft.selectedText, 70)}”`
        : sourceTitle(detected);

  return (
    <div
      className="ann-card"
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 10,
        padding: "9px 11px",
        marginBottom: 14,
      }}
    >
      <span className={draft.spanMs ? "ann-mono" : undefined} style={{ fontSize: 13, lineHeight: 1.4 }}>
        {label}
      </span>
      <button type="button" className="ann-link" style={{ flexShrink: 0 }} onClick={onEdit}>
        Edit
      </button>
    </div>
  );
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function sourceTitle(detected: DetectedSource): string {
  switch (detected.kind) {
    case "article":
      return detected.article.title;
    case "podcast":
      return detected.podcast.kind === "enclosure" || detected.podcast.kind === "generic"
        ? detected.podcast.pageTitle
        : "";
    case "youtube":
    case "detecting":
    case "unsupported":
      return "";
  }
}
