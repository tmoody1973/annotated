/**
 * The frame every screen renders into: chrome bar, back, step position, and the
 * one live region the whole panel announces through.
 *
 * The panel is 380px of browser chrome with no page around it, so the usual
 * landmarks a screen-reader user navigates by are absent. Two things stand in
 * for them: focus moves to the new screen's heading on every transition, and
 * the transition is announced. Neither is optional.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { AuthSlot } from "./auth-slot";
import type { Screen } from "../lib/use-panel-flow";

/** Published is an outcome, not a step — the indicator counts the three you walk. */
const STEP_ORDER: readonly Screen[] = ["source", "clip", "take"];
const STEP_COUNT = STEP_ORDER.length;

function stepPosition(screen: Screen): number | null {
  const index = STEP_ORDER.indexOf(screen);
  return index === -1 ? null : index + 1;
}

interface PanelShellProps {
  screen: Screen;
  heading: string;
  onBack: (() => void) | null;
  /** Extra text to announce beyond the heading — "URL copied", say. */
  announcement?: string;
  children: ReactNode;
}

export function PanelShell({
  screen,
  heading,
  onBack,
  announcement,
  children,
}: PanelShellProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const step = stepPosition(screen);

  useEffect(() => {
    headingRef.current?.focus();
  }, [screen]);

  return (
    <div
      className="ann-root"
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
    >
      <header
        className="ann-chrome"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "10px 14px",
          borderBottom: "3px solid var(--b-line)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="ann-press"
              style={{
                background: "none",
                border: "none",
                color: "#ffffff",
                cursor: "pointer",
                font: "inherit",
                fontWeight: 800,
                fontSize: 12,
                padding: "2px 4px",
              }}
            >
              ← Back
            </button>
          ) : (
            <span
              aria-hidden="true"
              style={{
                width: 22,
                height: 22,
                background: "var(--b-acid)",
                color: "var(--b-acid-ink)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                fontSize: 13,
              }}
            >
              A
            </span>
          )}
          {step !== null ? (
            <span
              aria-label={`Step ${step} of ${STEP_COUNT}`}
              style={{ display: "flex", alignItems: "center", gap: 4 }}
            >
              {STEP_ORDER.map((name, index) => (
                <span
                  key={name}
                  aria-hidden="true"
                  style={{
                    width: index + 1 === step ? 16 : 6,
                    height: 6,
                    background: index + 1 <= step ? "var(--b-acid)" : "#4a4a44",
                  }}
                />
              ))}
            </span>
          ) : null}
        </div>
        <AuthSlot />
      </header>

      <main style={{ flex: 1, padding: "14px 16px 18px" }}>
        <h1
          ref={headingRef}
          tabIndex={-1}
          style={{
            margin: "0 0 12px",
            fontWeight: 900,
            fontSize: 17,
            lineHeight: 1.2,
            letterSpacing: "-0.01em",
            color: "var(--b-on-bg)",
            outline: "none",
          }}
        >
          {heading}
        </h1>
        {children}
      </main>

      {/* One region for the whole panel. Screens pass `announcement`; the
          heading covers navigation on its own. */}
      <div className="ann-sr" role="status" aria-live="polite">
        {announcement ?? `${heading}${step === null ? "" : `, step ${step} of ${STEP_COUNT}`}`}
      </div>
    </div>
  );
}
