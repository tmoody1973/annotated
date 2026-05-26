import { useEffect, useState } from "react";
import { progressFraction } from "@annotated/shared";
import { accent, ink, monoStack, muted } from "../lib/clip-styles";

/**
 * A determinate-feeling progress bar for an operation with no measurable percent
 * (a Deepgram sync transcription reports no real progress). Shows the label, a
 * live elapsed counter against the estimate, and a bar that fills toward — but
 * never reaches — 100%, so it never claims "done" early. Render only while the
 * work is in flight; unmount it when the operation completes.
 */
export function ProgressIndicator({
  label,
  estimateMs,
  startedAt,
}: {
  label: string;
  estimateMs: number;
  startedAt: number;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const elapsedMs = Math.max(0, now - startedAt);
  const fraction = progressFraction(elapsedMs, estimateMs);
  const elapsedSec = Math.floor(elapsedMs / 1000);
  const estimateSec = Math.round(estimateMs / 1000);

  return (
    <section style={{ margin: "10px 0 0" }} role="status" aria-live="polite">
      <div style={{ fontFamily: monoStack, fontSize: 12, fontWeight: 700, color: ink }}>
        {label}
      </div>
      <div
        style={{
          marginTop: 6,
          height: 8,
          border: `2px solid ${ink}`,
          background: "transparent",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${Math.round(fraction * 100)}%`,
            background: accent,
            transition: "width 250ms linear",
          }}
        />
      </div>
      <div style={{ fontFamily: monoStack, fontSize: 11, color: muted, marginTop: 4 }}>
        {elapsedSec}s elapsed · ~{estimateSec}s expected
      </div>
    </section>
  );
}
