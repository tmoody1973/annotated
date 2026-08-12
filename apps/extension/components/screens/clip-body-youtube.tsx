/**
 * The scrubber. Drag is the primary way to choose a clip; the mm:ss fields
 * survive as readouts you can still type into, and each handle is a real
 * keyboard-operable slider.
 *
 * The three inputs are one value seen three ways — drag moves the fields, the
 * fields move the handles, arrow keys move whichever handle has focus. All of
 * them go through `moveHandle`, so none of them can produce a clip the others
 * would consider invalid.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { clockToMs, formatClipTimestamp, MAX_CLIP_MS } from "@annotated/shared";
import {
  moveHandle,
  nudgeHandle,
  spanAtFraction,
  NUDGE_COARSE_MS,
  NUDGE_MS,
  type Handle,
  type Span,
} from "../../lib/scrubber";
import { requestPlayerState } from "../../lib/player-time";

const PLAYHEAD_POLL_MS = 500;

interface ClipBodyYoutubeProps {
  span: Span;
  onChange: (span: Span) => void;
}

export function ClipBodyYoutube({ span, onChange }: ClipBodyYoutubeProps) {
  const [durationMs, setDurationMs] = useState(0);
  const [playheadMs, setPlayheadMs] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<Handle | null>(null);

  // The playhead is live, so the track keeps meaning something while the video
  // plays underneath the panel.
  useEffect(() => {
    let cancelled = false;
    const read = async (): Promise<void> => {
      const state = await requestPlayerState();
      if (cancelled || !state) return;
      setDurationMs(state.durationMs);
      setPlayheadMs(state.currentTimeMs);
    };
    void read();
    const timer = setInterval(() => void read(), PLAYHEAD_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const scale = durationMs > 0 ? durationMs : Math.max(span.endMs, MAX_CLIP_MS);
  const percent = (ms: number): string => `${(ms / scale) * 100}%`;

  const pointerToMs = useCallback(
    (clientX: number): number => {
      const track = trackRef.current;
      if (!track) return 0;
      const box = track.getBoundingClientRect();
      return spanAtFraction((clientX - box.left) / box.width, scale);
    },
    [scale],
  );

  useEffect(() => {
    const onMove = (event: PointerEvent): void => {
      const handle = dragging.current;
      if (handle) onChange(moveHandle(span, handle, pointerToMs(event.clientX), scale));
    };
    const onUp = (): void => {
      dragging.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [span, scale, onChange, pointerToMs]);

  const onHandleKeyDown = (handle: Handle) => (event: React.KeyboardEvent): void => {
    const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (direction === 0) return;
    event.preventDefault();
    const step = event.shiftKey ? NUDGE_COARSE_MS : NUDGE_MS;
    onChange(nudgeHandle(span, handle, direction * step, scale));
  };

  const durationLabel = formatClipTimestamp(span.endMs - span.startMs);

  return (
    <section>
      <div
        ref={trackRef}
        className="ann-card"
        style={{ position: "relative", height: 44, marginBottom: 12, cursor: "pointer" }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: percent(span.startMs),
            width: percent(span.endMs - span.startMs),
            background: "var(--b-acid)",
          }}
        />
        {playheadMs !== null ? (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: percent(playheadMs),
              width: 2,
              background: "var(--b-ink)",
              opacity: 0.55,
            }}
          />
        ) : null}
        {(["start", "end"] as const).map((handle) => {
          const value = handle === "start" ? span.startMs : span.endMs;
          return (
            <div
              key={handle}
              role="slider"
              tabIndex={0}
              aria-label={handle === "start" ? "Clip start" : "Clip end"}
              aria-valuemin={0}
              aria-valuemax={Math.round(scale / 1000)}
              aria-valuenow={Math.round(value / 1000)}
              aria-valuetext={formatClipTimestamp(value)}
              onKeyDown={onHandleKeyDown(handle)}
              onPointerDown={(event) => {
                event.preventDefault();
                dragging.current = handle;
              }}
              style={{
                position: "absolute",
                top: -3,
                bottom: -3,
                left: percent(value),
                width: 12,
                marginLeft: -6,
                // Light bar, dark outline — the one combination that reads
                // against the acid band, the pale track, and (in dark mode) the
                // near-black page the handle overhangs at either extreme.
                background: "var(--b-card)",
                border: "2px solid var(--b-ink)",
                cursor: "ew-resize",
                touchAction: "none",
              }}
            />
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
        <strong className="ann-mono" style={{ fontSize: 26, fontWeight: 900, lineHeight: 1 }}>
          {durationLabel}
        </strong>
        <span className="ann-dim ann-mono" style={{ fontSize: 12 }}>
          / {formatClipTimestamp(MAX_CLIP_MS)} max
        </span>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <ClockField
          label="In"
          valueMs={span.startMs}
          onCommit={(ms) => onChange(moveHandle(span, "start", ms, scale))}
        />
        <ClockField
          label="Out"
          valueMs={span.endMs}
          onCommit={(ms) => onChange(moveHandle(span, "end", ms, scale))}
        />
      </div>
    </section>
  );
}

/**
 * A readout you can type into. It shows the handle's value except while being
 * edited — otherwise a drag would fight the caret mid-keystroke.
 */
function ClockField({
  label,
  valueMs,
  onCommit,
}: {
  label: string;
  valueMs: number;
  onCommit: (ms: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? formatClipTimestamp(valueMs);

  const commit = (): void => {
    if (draft !== null) {
      const ms = clockToMs(draft);
      if (ms !== null) onCommit(ms);
    }
    setDraft(null);
  };

  return (
    <label style={{ flex: 1 }}>
      <span
        className="ann-dim"
        style={{
          display: "block",
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          marginBottom: 3,
        }}
      >
        {label}
      </span>
      <input
        className="ann-field"
        inputMode="numeric"
        value={shown}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") setDraft(null);
        }}
      />
    </label>
  );
}
