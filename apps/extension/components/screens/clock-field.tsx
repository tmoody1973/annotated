import { useState } from "react";
import { clockToMs, formatClipTimestamp } from "@annotated/shared";

/**
 * A readout you can type into. It shows the handle's value except while being
 * edited — otherwise a drag would fight the caret mid-keystroke.
 */
export function ClockField({
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
