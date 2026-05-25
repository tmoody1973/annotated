import { useEffect } from "react";
import { formatClipTimestamp } from "@annotated/shared";
import { useVoiceRecorder, MAX_RECORDING_MS } from "../lib/use-voice-recorder";
import { accent, monoStack, muted, sansStack, valid } from "../lib/clip-styles";

const labelStyle: React.CSSProperties = {
  fontFamily: monoStack,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: muted,
  marginBottom: 6,
};

const recordButton: React.CSSProperties = {
  width: "100%",
  padding: "10px 4px",
  fontSize: 12,
};

/**
 * Shared commentary input across all three clip paths: a text take, a recorded
 * voice note, or both (SPEC: "commentary supports text and recorded audio").
 * Owns the MediaRecorder lifecycle and lifts the recorded blob up via
 * `onAudioChange` so the parent can transcode + publish it.
 */
export function CommentaryComposer({
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
      <div style={labelStyle}>Commentary</div>
      <textarea
        className="ann-textarea ann-shadow"
        placeholder="Add your take (text), record a voice note, or both"
        value={text}
        onChange={(event) => onTextChange(event.target.value)}
        disabled={disabled}
        aria-label="Commentary text"
      />

      <div style={{ marginTop: 10 }}>
        {recorder.state === "recording" ? (
          <button
            type="button"
            className="ann-capture ann-press"
            style={{ ...recordButton, background: accent, color: "#FBFAF7" }}
            onClick={recorder.stop}
          >
            ■ Stop · {formatClipTimestamp(recorder.elapsedMs)} /{" "}
            {formatClipTimestamp(MAX_RECORDING_MS)}
          </button>
        ) : recorder.state === "recorded" && recorder.previewUrl ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <audio
              controls
              src={recorder.previewUrl}
              style={{ width: "100%" }}
              aria-label="Recorded commentary preview"
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
          <p style={{ color: valid, fontFamily: sansStack, fontSize: 12, fontWeight: 700, marginTop: 6 }}>
            Voice note attached.
          </p>
        )}
        {recorder.state === "denied" && recorder.error && (
          <p style={{ color: accent, fontFamily: sansStack, fontSize: 12, marginTop: 8 }}>
            {recorder.error}
          </p>
        )}
      </div>
    </div>
  );
}
