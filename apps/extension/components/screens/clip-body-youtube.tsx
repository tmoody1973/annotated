/**
 * The scrubber. Two gestures that have to look like two gestures: grab the
 * middle of the acid band to **move** the clip, grab either end to **stretch**
 * it. Clicking anywhere else on the track jumps the clip there.
 *
 * The track draws a *window* around the clip rather than the whole video. The
 * first version drew the whole thing, which collapsed the moment a video got
 * long: a 90-second clip inside a 64-minute talk is 2.3% of the track — about
 * eight pixels — and the handles, centred on its edges, covered it completely.
 * Nothing was grabbable and one pixel meant eleven seconds.
 *
 * The handles now sit *outside* the band rather than straddling it, so the band
 * always keeps its full width no matter how tight the clip gets.
 *
 * The mm:ss fields survive as readouts you can still type into, and each handle
 * is a keyboard-operable slider. Drag, click, type and arrow keys all route
 * through lib/scrubber.ts, so none of them can build a clip the others reject.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { formatClipTimestamp, MAX_CLIP_MS } from "@annotated/shared";
import {
  keepInView,
  moveHandle,
  moveSpan,
  nudgeHandle,
  viewFor,
  NUDGE_COARSE_MS,
  NUDGE_MS,
  type Handle,
  type Span,
  type View,
} from "../../lib/scrubber";
import { requestPlayerState } from "../../lib/player-time";
import { ClockField } from "./clock-field";

const PLAYHEAD_POLL_MS = 500;
const TRACK_HEIGHT = 52;
const HANDLE_WIDTH = 16;
/** How far past each track edge a drag may reach, as a fraction of the window. */
const OVERSHOOT = 0.08;

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
  const [view, setView] = useState<View>(() => viewFor(span, 0));
  const [dragKind, setDragKind] = useState<Drag["kind"] | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<Drag | null>(null);

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

  // The window sits still while the clip has room, then pans by the smallest
  // distance that keeps it in frame. Re-centring instead made a drag past the
  // edge lurch: the band jumped back to the middle, out from under the cursor.
  useEffect(() => {
    setView((current) => keepInView(current, span, durationMs));
  }, [span.startMs, span.endMs, durationMs]);

  const viewMs = Math.max(1, view.endMs - view.startMs);
  const percent = (ms: number): string => `${((ms - view.startMs) / viewMs) * 100}%`;
  const widthPercent = (ms: number): string => `${(ms / viewMs) * 100}%`;

  const pointerToMs = useCallback(
    (clientX: number): number => {
      const track = trackRef.current;
      if (!track) return view.startMs;
      const box = track.getBoundingClientRect();
      // A little overshoot past each edge is allowed on purpose: hard-clamping
      // at the track edge pinned the clip there, so a drag that kept going did
      // nothing until the window jumped. With overshoot the target keeps
      // advancing and the window pans smoothly to follow. Bounded so a wide
      // flick scrolls rather than teleports. Kept small: the window pans to follow,
      // so overshoot compounds across pointer events and a generous value turns a
      // drag past the edge into a scrub through half the video.
      const raw = (clientX - box.left) / box.width;
      const fraction = Math.max(-OVERSHOOT, Math.min(1 + OVERSHOOT, raw));
      return Math.round(view.startMs + fraction * viewMs);
    },
    [view.startMs, viewMs],
  );

  useEffect(() => {
    const onMove = (event: PointerEvent): void => {
      const drag = dragging.current;
      if (!drag) return;
      const at = pointerToMs(event.clientX);
      onChange(
        drag.kind === "handle"
          ? moveHandle(span, drag.handle, at, durationMs || view.endMs)
          : moveSpan(span, at - drag.grabOffsetMs, durationMs || view.endMs),
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
  }, [span, durationMs, view.endMs, onChange, pointerToMs]);

  const beginDrag = (drag: Drag) => (event: React.PointerEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    dragging.current = drag;
    setDragKind(drag.kind);
  };

  /** Anywhere on the bare track: bring the clip here, then keep dragging it. */
  const onTrackPointerDown = (event: React.PointerEvent): void => {
    event.preventDefault();
    const clipMs = span.endMs - span.startMs;
    const at = pointerToMs(event.clientX);
    onChange(moveSpan(span, at - clipMs / 2, durationMs || view.endMs));
    dragging.current = { kind: "band", grabOffsetMs: clipMs / 2 };
    setDragKind("band");
  };

  const onHandleKeyDown = (handle: Handle) => (event: React.KeyboardEvent): void => {
    const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (direction === 0) return;
    event.preventDefault();
    const step = event.shiftKey ? NUDGE_COARSE_MS : NUDGE_MS;
    onChange(nudgeHandle(span, handle, direction * step, durationMs || view.endMs));
  };

  const playheadInView =
    playheadMs !== null && playheadMs >= view.startMs && playheadMs <= view.endMs;

  return (
    <section>
      <div
        ref={trackRef}
        className="ann-card"
        onPointerDown={onTrackPointerDown}
        title="Click to bring the clip here"
        style={{ position: "relative", height: TRACK_HEIGHT, marginBottom: 6, cursor: "pointer" }}
      >
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
            width: widthPercent(span.endMs - span.startMs),
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

        {playheadInView ? (
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
              aria-valuemax={Math.round((durationMs || view.endMs) / 1000)}
              aria-valuenow={Math.round(value / 1000)}
              aria-valuetext={formatClipTimestamp(value)}
              title={
                handle === "start" ? "Drag to change where it starts" : "Drag to change where it ends"
              }
              onKeyDown={onHandleKeyDown(handle)}
              onPointerDown={beginDrag({ kind: "handle", handle })}
              style={{
                position: "absolute",
                top: -4,
                bottom: -4,
                left: percent(value),
                width: HANDLE_WIDTH,
                // Outside the band, not straddling it: a handle that overlaps
                // the selection eats the very area you move the clip by.
                marginLeft: handle === "start" ? -HANDLE_WIDTH : 0,
                background: "var(--b-card)",
                border: "2px solid var(--b-ink)",
                cursor: "ew-resize",
                touchAction: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <GripLines />
            </div>
          );
        })}
      </div>

      <div
        className="ann-dim ann-mono"
        style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}
      >
        <span>{formatClipTimestamp(view.startMs)}</span>
        <span>{formatClipTimestamp(view.endMs)}</span>
      </div>

      {durationMs > view.endMs - view.startMs ? (
        <Overview view={view} durationMs={durationMs} />
      ) : null}

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
          onCommit={(ms) => onChange(moveHandle(span, "start", ms, durationMs || view.endMs))}
        />
        <ClockField
          label="Out"
          valueMs={span.endMs}
          onCommit={(ms) => onChange(moveHandle(span, "end", ms, durationMs || view.endMs))}
        />
      </div>
    </section>
  );
}

/** Where the zoomed window sits in the whole video — the context zooming costs. */
function Overview({ view, durationMs }: { view: View; durationMs: number }) {
  const left = (view.startMs / durationMs) * 100;
  const width = Math.max(1.5, ((view.endMs - view.startMs) / durationMs) * 100);
  return (
    <div style={{ margin: "8px 0 12px" }}>
      <div
        aria-hidden="true"
        style={{ position: "relative", height: 4, background: "var(--b-card)", border: "1px solid var(--b-line)" }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${left}%`,
            width: `${width}%`,
            background: "var(--b-acid)",
          }}
        />
      </div>
      <p className="ann-dim ann-mono" style={{ fontSize: 10, margin: "3px 0 0" }}>
        zoomed · {formatClipTimestamp(durationMs)} total
      </p>
    </div>
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
