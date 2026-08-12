/**
 * The two things the transcript screen shows when it has no transcript: an
 * honest wait, and a way out of a failure. Small, but they are most of what a
 * user on a slow episode actually sees.
 */
import { useRef } from "react";
import { ProgressIndicator } from "../progress-indicator";

export function Waiting({
  label,
  estimateMs,
  startedAt,
}: {
  label: string;
  estimateMs: number;
  startedAt?: number;
}) {
  const fallback = useRef(Date.now());
  return (
    <ProgressIndicator label={label} estimateMs={estimateMs} startedAt={startedAt ?? fallback.current} />
  );
}

export function Retry({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert">
      <p style={{ fontSize: 14, margin: "0 0 10px" }}>{message}</p>
      <button type="button" className="ann-capture ann-press" style={{ padding: 10 }} onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
