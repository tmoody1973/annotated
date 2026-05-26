import { useState } from "react";
import { useMutation } from "convex/react";
import { makeFunctionReference } from "convex/server";
import {
  clockToMs,
  evaluateClipSpan,
  formatClipTimestamp,
  type ClipSpanResult,
} from "@annotated/shared";
import { requestPlayerTimeMs, getActiveVideoTitle } from "../lib/player-time";
import {
  clipYoutube,
  getWorkerToken,
  getWebUrl,
  transcodeCommentary,
} from "../lib/worker-client";
import { accent, danger, hair, ink, muted, monoStack, panel, sansStack, surface, valid } from "../lib/clip-styles";
import { CommentaryComposer } from "./commentary-composer";
import { AnonymousToggle } from "./anonymous-toggle";
import { useThread } from "../lib/use-thread";

const publishYoutubeClipDev = makeFunctionReference<
  "mutation",
  {
    videoId: string;
    title: string;
    clipStorageId: string;
    clipStartMs: number;
    clipEndMs: number;
    commentaryText?: string;
    commentaryAudioStorageId?: string;
    commentaryAudioTranscript?: string;
    isAnonymous?: boolean;
    threadId?: string;
    workerToken: string;
  },
  string
>("testing:publishYoutubeClipDev");

type Status = "idle" | "clipping" | "publishing" | "done" | "error";

/** Maps the span result to a colored status line (narrows the union cleanly). */
function describeSpan(span: ClipSpanResult | null): { color: string; text: string } {
  if (span === null) return { color: muted, text: "SPAN —:— · enter start and end" };
  if (span.ok) {
    return { color: valid, text: `SPAN ${formatClipTimestamp(span.durationMs)} · ✓ under 90s` };
  }
  return { color: accent, text: span.error };
}

const label: React.CSSProperties = {
  fontFamily: sansStack,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: muted,
  marginBottom: 6,
};

function TimeColumn({
  heading,
  value,
  onChange,
  onCapture,
}: {
  heading: string;
  value: string;
  onChange: (v: string) => void;
  onCapture: () => void;
}) {
  return (
    <div style={{ flex: 1 }}>
      <div style={label}>{heading}</div>
      <input
        className="ann-field ann-shadow"
        value={value}
        placeholder="0:00"
        inputMode="numeric"
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className="ann-capture ann-press"
        style={{ width: "100%", marginTop: 8, padding: "8px 4px", fontSize: 11 }}
        onClick={onCapture}
      >
        Use playback
      </button>
    </div>
  );
}

export function ClipComposer({ videoId }: { videoId: string }) {
  const publish = useMutation(publishYoutubeClipDev);
  const thread = useThread();
  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");
  const [commentary, setCommentary] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [annotationId, setAnnotationId] = useState<string | null>(null);
  const [captureHint, setCaptureHint] = useState<string | null>(null);

  const startMs = clockToMs(startInput);
  const endMs = clockToMs(endInput);
  const span = startMs !== null && endMs !== null ? evaluateClipSpan(startMs, endMs) : null;
  const commentaryOk = commentary.trim().length > 0 || audioBlob !== null;
  const busy = status === "clipping" || status === "publishing";
  const canPublish = (span?.ok ?? false) && commentaryOk && !busy;

  async function capture(target: "start" | "end") {
    const ms = await requestPlayerTimeMs();
    if (ms === null) {
      setCaptureHint("Couldn't read the player — type the time, or reload the video tab.");
      return;
    }
    setCaptureHint(null);
    const formatted = formatClipTimestamp(ms);
    if (target === "start") setStartInput(formatted);
    else setEndInput(formatted);
  }

  async function handlePublish() {
    if (startMs === null || endMs === null) return;
    setStatus("clipping");
    setErrorMsg(null);
    try {
      const title = await getActiveVideoTitle();
      const { storageId } = await clipYoutube({ videoId, startMs, endMs });
      const commentaryAudio = audioBlob
        ? await transcodeCommentary(audioBlob)
        : null;
      setStatus("publishing");
      const id = await publish({
        videoId,
        title,
        clipStorageId: storageId,
        clipStartMs: startMs,
        clipEndMs: endMs,
        commentaryText: commentary.trim(),
        commentaryAudioStorageId: commentaryAudio?.storageId,
        commentaryAudioTranscript: commentaryAudio?.transcript ?? undefined,
        isAnonymous,
        threadId: thread.threadId ?? undefined,
        workerToken: getWorkerToken(),
      });
      setAnnotationId(id);
      setStatus("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Publish failed");
      setStatus("error");
    }
  }

  const clearClipFields = (): void => {
    setStatus("idle");
    setStartInput("");
    setEndInput("");
    setCommentary("");
    setAudioBlob(null);
    setIsAnonymous(false);
    setAnnotationId(null);
  };

  if (status === "done" && annotationId) {
    const publishedId = annotationId;
    return (
      <section className="ann-shadow" style={{ border: `1px solid ${hair}`, borderRadius: 10, background: panel, padding: 16 }}>
        <div style={{ ...label, color: valid }}>Published</div>
        <a className="ann-link" href={`${getWebUrl()}/a/${publishedId}`} target="_blank" rel="noreferrer">
          View annotation ⟶
        </a>
        <button
          type="button"
          className="ann-publish ann-press ann-shadow"
          style={{ marginTop: 14 }}
          onClick={() => {
            void thread.continueThread(publishedId).then(clearClipFields);
          }}
        >
          + Add another clip to this thread
        </button>
        <button
          type="button"
          className="ann-capture ann-press"
          style={{ width: "100%", marginTop: 10, padding: "10px" }}
          onClick={() => {
            thread.reset();
            clearClipFields();
          }}
        >
          New clip
        </button>
      </section>
    );
  }

  return (
    <section>
      <div style={{ display: "flex", gap: 12 }}>
        <TimeColumn heading="In" value={startInput} onChange={setStartInput} onCapture={() => capture("start")} />
        <TimeColumn heading="Out" value={endInput} onChange={setEndInput} onCapture={() => capture("end")} />
      </div>

      {captureHint && (
        <p style={{ fontSize: 12, color: accent, marginTop: 8 }}>{captureHint}</p>
      )}

      <div style={{ ...label, marginTop: 10, marginBottom: 0 }}>
        Clip up to 90 seconds (fair use)
      </div>

      {(() => {
        const s = describeSpan(span);
        return (
          <div style={{ fontFamily: monoStack, fontSize: 13, fontWeight: 700, marginTop: 12, color: s.color }}>
            {s.text}
          </div>
        );
      })()}

      <div style={{ marginTop: 16 }}>
        <CommentaryComposer
          text={commentary}
          onTextChange={setCommentary}
          onAudioChange={setAudioBlob}
          disabled={busy}
        />
      </div>

      <AnonymousToggle
        checked={isAnonymous}
        onChange={setIsAnonymous}
        disabled={busy}
      />

      <button
        type="button"
        className="ann-publish ann-press ann-shadow"
        style={{ marginTop: 16 }}
        disabled={!canPublish}
        onClick={handlePublish}
      >
        {status === "clipping" ? "Clipping… (~2s)" : status === "publishing" ? "Saving annotation…" : "Publish clip →"}
      </button>

      {status === "error" && errorMsg && (
        <p style={{ marginTop: 14, border: `1px solid ${hair}`, borderRadius: 7, background: surface, color: danger, padding: 10, fontSize: 13 }}>
          {errorMsg}
        </p>
      )}
    </section>
  );
}
