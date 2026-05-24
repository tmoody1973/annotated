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
import { clipYoutube, getWorkerToken, getWebUrl } from "../lib/worker-client";
import { accent, ink, muted, monoStack, valid } from "../lib/clip-styles";

const publishYoutubeClipDev = makeFunctionReference<
  "mutation",
  {
    videoId: string;
    title: string;
    clipStorageId: string;
    clipStartMs: number;
    clipEndMs: number;
    commentaryText: string;
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
  fontFamily: monoStack,
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
  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");
  const [commentary, setCommentary] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [annotationId, setAnnotationId] = useState<string | null>(null);
  const [captureHint, setCaptureHint] = useState<string | null>(null);

  const startMs = clockToMs(startInput);
  const endMs = clockToMs(endInput);
  const span = startMs !== null && endMs !== null ? evaluateClipSpan(startMs, endMs) : null;
  const commentaryOk = commentary.trim().length > 0;
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
      setStatus("publishing");
      const id = await publish({
        videoId,
        title,
        clipStorageId: storageId,
        clipStartMs: startMs,
        clipEndMs: endMs,
        commentaryText: commentary.trim(),
        workerToken: getWorkerToken(),
      });
      setAnnotationId(id);
      setStatus("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Publish failed");
      setStatus("error");
    }
  }

  if (status === "done" && annotationId) {
    return (
      <section className="ann-shadow" style={{ border: `3px solid ${ink}`, background: "#EAFBF0", padding: 16 }}>
        <div style={{ ...label, color: valid }}>Published</div>
        <a className="ann-link" href={`${getWebUrl()}/a/${annotationId}`} target="_blank" rel="noreferrer">
          View annotation ⟶
        </a>
        <button
          type="button"
          className="ann-capture ann-press"
          style={{ width: "100%", marginTop: 14, padding: "10px" }}
          onClick={() => {
            setStatus("idle");
            setStartInput("");
            setEndInput("");
            setCommentary("");
            setAnnotationId(null);
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

      {(() => {
        const s = describeSpan(span);
        return (
          <div style={{ fontFamily: monoStack, fontSize: 13, fontWeight: 700, marginTop: 12, color: s.color }}>
            {s.text}
          </div>
        );
      })()}

      <div style={{ marginTop: 16 }}>
        <div style={label}>Commentary</div>
        <textarea
          className="ann-textarea ann-shadow"
          value={commentary}
          placeholder="Why does this clip matter?"
          onChange={(e) => setCommentary(e.target.value)}
        />
      </div>

      <button
        type="button"
        className="ann-publish ann-press ann-shadow"
        style={{ marginTop: 16 }}
        disabled={!canPublish}
        onClick={handlePublish}
      >
        {status === "clipping" ? "Clipping…" : status === "publishing" ? "Publishing…" : "Publish clip →"}
      </button>

      {status === "error" && errorMsg && (
        <p className="ann-shadow" style={{ marginTop: 14, border: `2px solid ${ink}`, background: "#FFE9E9", color: ink, padding: 10, fontSize: 13 }}>
          {errorMsg}
        </p>
      )}
    </section>
  );
}
