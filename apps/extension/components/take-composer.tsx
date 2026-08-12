import { useEffect } from "react";
import { formatClipTimestamp } from "@annotated/shared";
import { SANS_STACK, STATUS_BAD, STATUS_OK } from "../lib/panel-theme";
import { useVoiceRecorder, MAX_RECORDING_MS } from "../lib/use-voice-recorder";
import { WaveformPreview } from "./waveform-preview";

const labelStyle: React.CSSProperties = {
  fontFamily: SANS_STACK,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--b-dim)",
  marginBottom: 6,
};

const recordButton: React.CSSProperties = {
  width: "100%",
  padding: "10px 4px",
  fontSize: 12,
};

/**
 * Shared take input across all three clip paths: a text take, a recorded
 * voice note, or both (SPEC: "commentary supports text and recorded audio").
 * Owns the MediaRecorder lifecycle and lifts the recorded blob up via
 * `onAudioChange` so the parent can transcode + publish it.
 */
export function TakeComposer({
  text,
  onTextChange,
  onAudioChange,
  disabled = false,
}: {
  text: string;
  onTextChange: (value: string) => void;
  onAudioChange: (blob: Blob | null) => void;
  disabled?: boolean;
}) {
  const recorder = useVoiceRecorder();

  useEffect(() => {
    onAudioChange(recorder.blob);
  }, [recorder.blob, onAudioChange]);

  return (
    <div>
      <div style={labelStyle}>Your take</div>
      <textarea
        className="ann-textarea ann-shadow"
        placeholder="BS or brilliant? Say why."
        value={text}
        onChange={(event) => onTextChange(event.target.value)}
        disabled={disabled}
        aria-label="Take text"
      />

      <div style={{ marginTop: 10 }}>
        {recorder.state === "recording" ? (
          <button
            type="button"
            className="ann-capture ann-press"
            style={{ ...recordButton, background: "var(--b-acid)", color: "var(--b-ink)", border: "2px solid var(--b-ink)" }}
            onClick={recorder.stop}
          >
            ■ Stop · {formatClipTimestamp(recorder.elapsedMs)} /{" "}
            {formatClipTimestamp(MAX_RECORDING_MS)}
          </button>
        ) : recorder.state === "recorded" && recorder.previewUrl ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recorder.blob && <WaveformPreview blob={recorder.blob} />}
            <audio
              controls
              src={recorder.previewUrl}
              style={{ width: "100%" }}
              aria-label="Recorded take preview"
            />
            <button
              type="button"
              className="ann-capture ann-press"
              style={recordButton}
              onClick={recorder.clear}
              disabled={disabled}
            >
              ↺ Re-record
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="ann-capture ann-press"
            style={recordButton}
            onClick={() => void recorder.start()}
            disabled={disabled}
          >
            ● Record voice
          </button>
        )}

        {recorder.state === "recorded" && (
          <p style={{ color: STATUS_OK, fontFamily: SANS_STACK, fontSize: 12, fontWeight: 700, marginTop: 6 }}>
            Voice note attached
            {recorder.takeCount > 0 ? ` · Take ${recorder.takeCount}` : ""}.
          </p>
        )}
        {recorder.state === "denied" && recorder.error && (
          <p style={{ color: STATUS_BAD, fontFamily: SANS_STACK, fontSize: 12, marginTop: 8 }}>
            {recorder.error}
          </p>
        )}
      </div>
    </div>
  );
}
