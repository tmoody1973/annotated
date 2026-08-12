/**
 * The scrubber. Two gestures, and they have to look like two gestures:
 * grab the middle of the acid band to **move** the clip, grab either end to
 * **stretch** it. The first build only had the second one — the band was inert
 * and the handles were 12px slivers, so "grab sixty seconds from over there"
 * meant dragging both ends across one at a time.
 *
 * The mm:ss fields survive as readouts you can still type into, and each handle
 * is a keyboard-operable slider. Drag, type and arrow keys all go through the
 * same two functions in lib/scrubber.ts, so none of them can produce a clip the
 * others would call invalid.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { formatClipTimestamp, MAX_CLIP_MS } from "@annotated/shared";
import {
  moveHandle,
  moveSpan,
  nudgeHandle,
  spanAtFraction,
  NUDGE_COARSE_MS,
  NUDGE_MS,
  type Handle,
  type Span,
} from "../../lib/scrubber";
import { requestPlayerState } from "../../lib/player-time";
import { ClockField } from "./clock-field";

const PLAYHEAD_POLL_MS = 500;
const TRACK_HEIGHT = 52;
const HANDLE_WIDTH = 18;

type Drag =
  | { kind: "handle"; handle: Handle }
  /** Where inside the band the pointer grabbed it, so it doesn't jump on grab. */
  | { kind: "band"; grabOffsetMs: number };

interface ClipBodyYoutubeProps {
  span: Span;
  onChange: (span: Span) => void;
}

export function ClipBodyYoutube({ span, onChange }: ClipBodyYoutubeProps) {
  const [durationMs, setDurationMs] = useState(0);
  const [playheadMs, setPlayheadMs] = useState<number | null>(null);
  const [dragKind, setDragKind] = useState<Drag["kind"] | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<Drag | null>(null);

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
      const drag = dragging.current;
      if (!drag) return;
      const at = pointerToMs(event.clientX);
      onChange(
        drag.kind === "handle"
          ? moveHandle(span, drag.handle, at, scale)
          : moveSpan(span, at - drag.grabOffsetMs, scale),
      );
    };
    const onUp = (): void => {
      dragging.current = null;
      setDragKind(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [span, scale, onChange, pointerToMs]);

  const beginDrag = (drag: Drag) => (event: React.PointerEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    dragging.current = drag;
    setDragKind(drag.kind);
  };

  const onHandleKeyDown = (handle: Handle) => (event: React.KeyboardEvent): void => {
    const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (direction === 0) return;
    event.preventDefault();
    onChange(
      nudgeHandle(span, handle, direction * (event.shiftKey ? NUDGE_COARSE_MS : NUDGE_MS), scale),
    );
  };

  return (
    <section>
      <div
        ref={trackRef}
        className="ann-card"
        style={{ position: "relative", height: TRACK_HEIGHT, marginBottom: 6 }}
      >
        {/* The clip itself. Grab it anywhere in the middle to slide it. */}
        <div
          onPointerDown={(event) =>
            beginDrag({ kind: "band", grabOffsetMs: pointerToMs(event.clientX) - span.startMs })(
              event,
            )
          }
          title="Drag to move the clip"
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: percent(span.startMs),
            width: percent(span.endMs - span.startMs),
            background: "var(--b-acid)",
            cursor: dragKind === "band" ? "grabbing" : "grab",
            touchAction: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <GripDots />
        </div>

        {playheadMs !== null ? (
          <div
            aria-hidden="true"
            title="Where the video is playing"
            style={{
              position: "absolute",
              top: -2,
              bottom: -2,
              left: percent(playheadMs),
              width: 2,
              background: "var(--b-ink)",
              opacity: 0.5,
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
              title={handle === "start" ? "Drag to change where it starts" : "Drag to change where it ends"}
              onKeyDown={onHandleKeyDown(handle)}
              onPointerDown={beginDrag({ kind: "handle", handle })}
              style={{
                position: "absolute",
                top: -4,
                bottom: -4,
                left: percent(value),
                width: HANDLE_WIDTH,
                marginLeft: -HANDLE_WIDTH / 2,
                // Light bar, dark outline — the one combination that reads
                // against the acid band, the pale track, and (in dark mode) the
                // near-black page the handle overhangs at either extreme.
                background: "var(--b-card)",
                border: "2px solid var(--b-ink)",
                cursor: "ew-resize",
                touchAction: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
              }}
            >
              <GripLines />
            </div>
          );
        })}
      </div>

      {/* The scale, so the band's position on the track means something. */}
      <div
        className="ann-dim ann-mono"
        style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 12 }}
      >
        <span>0:00</span>
        <span>{durationMs > 0 ? formatClipTimestamp(durationMs) : "…"}</span>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
        <strong className="ann-mono" style={{ fontSize: 26, fontWeight: 900, lineHeight: 1 }}>
          {formatClipTimestamp(span.endMs - span.startMs)}
        </strong>
        <span className="ann-dim ann-mono" style={{ fontSize: 12 }}>
          / {formatClipTimestamp(MAX_CLIP_MS)} max
        </span>
      </div>
      <p className="ann-dim" style={{ fontSize: 11, margin: "0 0 12px" }}>
        Drag the middle to move it · drag an end to stretch it
      </p>

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

/** Three dots: the universal "this thing is draggable" mark. */
function GripDots() {
  return (
    <span aria-hidden="true" style={{ display: "flex", gap: 3, pointerEvents: "none" }}>
      {[0, 1, 2].map((dot) => (
        <span key={dot} style={{ width: 3, height: 3, background: "var(--b-ink)", opacity: 0.55 }} />
      ))}
    </span>
  );
}

/** Two rules down the middle of a handle — the resize grip. */
function GripLines() {
  return (
    <span aria-hidden="true" style={{ display: "flex", gap: 2, pointerEvents: "none" }}>
      {[0, 1].map((line) => (
        <span key={line} style={{ width: 1, height: 12, background: "var(--b-ink)", opacity: 0.5 }} />
      ))}
    </span>
  );
}
